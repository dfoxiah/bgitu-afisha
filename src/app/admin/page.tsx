/**
 * File responsibility:
 * Admin dashboard page for metrics, users, events/news, imports and audit logs.
 *
 * Main logic:
 * - Show KPI analytics and Excel export entrypoint
 * - Manage users (search/create/update/delete)
 * - Manage events and news (search/update/delete + create news)
 * - Run bulk imports and inspect audit logs
 *
 * Integrations:
 * - src/features/admin/client/admin-api.ts
 * - src/app/api/admin/*
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import type { EventCategory, Role } from "@prisma/client"
import Button from "@/components/ui/Button"
import { showToast } from "@/lib/toast"
import { CategoryDisplayMap } from "@/types"
import {
  createAdminNews,
  createAdminUser,
  deleteAdminEvent,
  deleteAdminUser,
  downloadAdminEventExcel,
  getAdminEventDetails,
  getAdminEvents,
  getAdminLogs,
  getAdminMetrics,
  getAdminUsers,
  importAdminData,
  updateAdminEvent,
  updateAdminUser,
} from "@/features/admin/client/admin-api"
import AdminMetricsDashboard from "@/features/admin/components/AdminMetricsDashboard"
import type {
  AdminAuditLog,
  AdminDashboardMetrics,
  AdminEvent,
  AdminEventDetails,
  AdminImportMode,
  AdminImportResult,
  AdminUser,
} from "@/features/admin/types"

type AdminTab = "metrics" | "users" | "events" | "import" | "logs"
const LIVE_UPDATE_INTERVAL_MS = 15000

type EditableEvent = {
  id: string
  title: string
  category: EventCategory
  date: string
  time: string
  location: string
  description: string
  maxParticipants: number
  responsible: string
  responsibleId: string
  contact: string
  imagesText: string
  moderatorsText: string
  isNews: boolean
  reportSummary: string
  reportDate: string
  reportTasksText: string
  reportImagesText: string
  reportComment: string
}

type ResponsibleOption = {
  id: string
  name: string
  email: string
}

const parseList = (value: string) =>
  value
    .split(/\r?\n/g)
    .flatMap((line) => line.split(/[|,;]/g))
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeDateValue = (value: string) => (value.includes("T") ? value.slice(0, 10) : value)

const downloadJsonFile = (fileName: string, payload: unknown) => {
  const json = `${JSON.stringify(payload, null, 2)}\n`
  const blob = new Blob([json], { type: "application/json;charset=utf-8" })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

const toEditableEvent = (event: AdminEventDetails): EditableEvent => ({
  id: event.id,
  title: event.title || "",
  category: event.category,
  date: normalizeDateValue(event.date),
  time: event.time || "",
  location: event.location || "",
  description: event.description || "",
  maxParticipants: event.maxParticipants ?? 0,
  responsible: event.responsible || "",
  responsibleId: "",
  contact: event.contact || "",
  imagesText: (event.images || []).join("\n"),
  moderatorsText: (event.moderators || []).map((moderator) => moderator.email).join(", "),
  isNews: Boolean(event.isNews),
  reportSummary: event.report?.summary || "",
  reportDate: event.report?.reportDate ? normalizeDateValue(event.report.reportDate) : normalizeDateValue(event.date),
  reportTasksText: (event.report?.tasks || []).join("\n"),
  reportImagesText: (event.report?.images || []).join("\n"),
  reportComment: event.report?.comment || "",
})

const roleOptions: Array<{ value: "ALL" | Role; label: string }> = [
  { value: "ALL", label: "Все роли" },
  { value: "STUDENT", label: "Студент" },
  { value: "TEACHER", label: "Преподаватель" },
  { value: "ADMIN", label: "Администратор" },
]

const categoryOptions = (Object.entries(CategoryDisplayMap) as Array<[EventCategory, string]>).map(
  ([value, label]) => ({ value, label })
)

const renderImportResult = (result: AdminImportResult | null) => {
  if (!result) return null
  return (
    <div className="text-xs text-gray-600 space-y-1">
      <div>
        Создано: {result.created}, обновлено: {result.updated}, пропущено: {result.skipped}
      </div>
      <div>
        Ошибок: {result.errors.length}, предупреждений: {result.warnings.length}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const canAccess = session?.user?.role === "ADMIN"

  const [activeTab, setActiveTab] = useState<AdminTab>("metrics")
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsEvents, setMetricsEvents] = useState<AdminEvent[]>([])
  const [exportingEventId, setExportingEventId] = useState<string | null>(null)
  const [metricsPeriod, setMetricsPeriod] = useState(() => {
    const to = new Date()
    const from = new Date(to)
    from.setDate(to.getDate() - 30)
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }
  })

  const [users, setUsers] = useState<AdminUser[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [userRole, setUserRole] = useState<"ALL" | Role>("ALL")
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "STUDENT" as Role,
    department: "",
    group: "",
  })
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editingPassword, setEditingPassword] = useState("")

  const [events, setEvents] = useState<AdminEvent[]>([])
  const [eventSearch, setEventSearch] = useState("")
  const [eventCategory, setEventCategory] = useState<EventCategory | "ALL">("ALL")
  const [eventStatus, setEventStatus] = useState<"ALL" | "UPCOMING" | "PAST">("ALL")
  const [newsOnly, setNewsOnly] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null)
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([])
  const [savingEvent, setSavingEvent] = useState(false)
  const [newsDraft, setNewsDraft] = useState({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    content: "",
    imagesText: "",
    tasksText: "",
    comment: "",
  })

  const [logAction, setLogAction] = useState("")
  const [logEntityType, setLogEntityType] = useState("")
  const [logs, setLogs] = useState<AdminAuditLog[]>([])

  const [importUsersFile, setImportUsersFile] = useState<File | null>(null)
  const [importEventsFile, setImportEventsFile] = useState<File | null>(null)
  const [importNewsFile, setImportNewsFile] = useState<File | null>(null)
  const [importUsersMode, setImportUsersMode] = useState<AdminImportMode>("upsert")
  const [importEventsMode, setImportEventsMode] = useState<AdminImportMode>("upsert")
  const [importNewsMode, setImportNewsMode] = useState<AdminImportMode>("upsert")
  const [importUsersResult, setImportUsersResult] = useState<AdminImportResult | null>(null)
  const [importEventsResult, setImportEventsResult] = useState<AdminImportResult | null>(null)
  const [importNewsResult, setImportNewsResult] = useState<AdminImportResult | null>(null)
  const [exportingDataset, setExportingDataset] = useState<
    "users" | "events" | "news" | "logs" | null
  >(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    if (!canAccess) {
      setResponsibleOptions([])
      return
    }

    let active = true

    const loadResponsibleOptions = async () => {
      try {
        const rows = await getAdminUsers({ role: "ALL", limit: 500 })
        const options = rows
          .filter((user) => user.role === "TEACHER" || user.role === "ADMIN")
          .map((user) => ({
            id: user.id,
            name: user.name || user.email,
            email: user.email,
          }))
          .sort((left, right) => left.name.localeCompare(right.name, "ru-RU"))

        if (active) setResponsibleOptions(options)
      } catch {
        if (active) setResponsibleOptions([])
      }
    }

    void loadResponsibleOptions()

    return () => {
      active = false
    }
  }, [canAccess])

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await getAdminUsers({ search: userSearch, role: userRole, limit: 200 }))
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки пользователей", "error")
    }
  }, [userSearch, userRole])

  const loadEvents = useCallback(async () => {
    try {
      setEvents(
        await getAdminEvents({
          search: eventSearch,
          category: eventCategory,
          status: eventStatus,
          newsOnly,
          limit: 200,
        })
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки мероприятий", "error")
    }
  }, [eventSearch, eventCategory, eventStatus, newsOnly])

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await getAdminLogs({ action: logAction, entityType: logEntityType, limit: 100 }))
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки логов", "error")
    }
  }, [logAction, logEntityType])
  const loadMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true)
      const [nextMetrics, eventsForExport] = await Promise.all([
        getAdminMetrics({
          from: metricsPeriod.from,
          to: metricsPeriod.to,
        }),
        getAdminEvents({ limit: 200 }),
      ])
      setMetrics(nextMetrics)
      setMetricsEvents(eventsForExport)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось загрузить метрики", "error")
    } finally {
      setMetricsLoading(false)
    }
  }, [metricsPeriod.from, metricsPeriod.to])

  useEffect(() => {
    if (!canAccess) return
    if (activeTab === "metrics") void loadMetrics()
    if (activeTab === "users") void loadUsers()
    if (activeTab === "events") void loadEvents()
    if (activeTab === "logs") void loadLogs()
  }, [activeTab, canAccess, loadMetrics, loadUsers, loadEvents, loadLogs])

  useEffect(() => {
    if (!editingEvent || editingEvent.responsibleId || responsibleOptions.length === 0) return

    const matchedResponsible = responsibleOptions.find(
      (option) =>
        option.name.trim().toLowerCase() === editingEvent.responsible.trim().toLowerCase() ||
        option.email.trim().toLowerCase() === editingEvent.responsible.trim().toLowerCase()
    )
    if (!matchedResponsible) return

    setEditingEvent((previous) =>
      previous ? { ...previous, responsibleId: matchedResponsible.id } : previous
    )
  }, [editingEvent, responsibleOptions])

  useEffect(() => {
    if (!canAccess) return
    if (activeTab !== "metrics" && activeTab !== "events") return

    let refreshInFlight = false

    const refreshActiveData = async () => {
      if (document.visibilityState === "hidden" || refreshInFlight) return
      refreshInFlight = true
      try {
        if (activeTab === "metrics") {
          await loadMetrics()
        } else {
          await loadEvents()
        }
      } finally {
        refreshInFlight = false
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshActiveData()
    }, LIVE_UPDATE_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshActiveData()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [activeTab, canAccess, loadMetrics, loadEvents])

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      showToast("Заполните имя, email и пароль", "error")
      return
    }
    try {
      await createAdminUser(newUser)
      showToast("Пользователь создан", "success")
      setNewUser({ name: "", email: "", password: "", role: "STUDENT", department: "", group: "" })
      await loadUsers()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка создания пользователя", "error")
    }
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    try {
      await updateAdminUser(editingUser.id, {
        name: editingUser.name || "",
        email: editingUser.email,
        role: editingUser.role,
        department: editingUser.department,
        group: editingUser.group,
        groupChangeCount: editingUser.groupChangeCount,
        password: editingPassword || undefined,
      })
      showToast("Пользователь обновлен", "success")
      setEditingUser(null)
      setEditingPassword("")
      await loadUsers()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка обновления пользователя", "error")
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Удалить пользователя?")) return
    try {
      await deleteAdminUser(id)
      showToast("Пользователь удален", "success")
      await loadUsers()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка удаления пользователя", "error")
    }
  }

  const handleEditEvent = async (event: AdminEvent) => {
    try {
      const details = await getAdminEventDetails(event.id)
      const editable = toEditableEvent(details)
      const matchedResponsible = responsibleOptions.find(
        (option) =>
          option.name.trim().toLowerCase() === editable.responsible.trim().toLowerCase() ||
          option.email.trim().toLowerCase() === editable.responsible.trim().toLowerCase()
      )
      if (matchedResponsible) {
        editable.responsibleId = matchedResponsible.id
      }
      setEditingEvent(editable)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки мероприятия", "error")
    }
  }

  const handleSaveEvent = async () => {
    if (!editingEvent) return
    setSavingEvent(true)
    try {
      await updateAdminEvent(editingEvent.id, {
        title: editingEvent.title,
        category: editingEvent.category,
        date: editingEvent.date,
        time: editingEvent.time,
        location: editingEvent.location,
        description: editingEvent.description,
        maxParticipants: editingEvent.maxParticipants,
        responsible: editingEvent.responsible,
        responsibleId: editingEvent.responsibleId || undefined,
        contact: editingEvent.contact,
        isNews: editingEvent.isNews,
        images: parseList(editingEvent.imagesText),
        moderators: parseList(editingEvent.moderatorsText),
        report: {
          summary: editingEvent.reportSummary,
          reportDate: editingEvent.reportDate,
          tasks: parseList(editingEvent.reportTasksText),
          images: parseList(editingEvent.reportImagesText),
          comment: editingEvent.reportComment || null,
        },
      })
      showToast("Мероприятие обновлено", "success")
      setEditingEvent(null)
      await loadEvents()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка обновления мероприятия", "error")
    } finally {
      setSavingEvent(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Удалить запись?")) return
    try {
      await deleteAdminEvent(id)
      showToast("Запись удалена", "success")
      await loadEvents()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка удаления", "error")
    }
  }

  const handleCreateNews = async () => {
    if (!newsDraft.title.trim() || !newsDraft.content.trim()) {
      showToast("Укажите заголовок и текст новости", "error")
      return
    }
    try {
      await createAdminNews({
        title: newsDraft.title.trim(),
        content: newsDraft.content.trim(),
        date: newsDraft.date,
        images: parseList(newsDraft.imagesText),
        tasks: parseList(newsDraft.tasksText),
        reportComment: newsDraft.comment,
      })
      showToast("Новость создана", "success")
      setNewsDraft({
        title: "",
        date: new Date().toISOString().slice(0, 10),
        content: "",
        imagesText: "",
        tasksText: "",
        comment: "",
      })
      setNewsOnly(true)
      await loadEvents()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка создания новости", "error")
    }
  }

  const runImport = async (
    type: "users" | "events" | "news",
    mode: AdminImportMode,
    file: File | null,
    setResult: (value: AdminImportResult | null) => void
  ) => {
    if (!file) {
      showToast("Выберите файл импорта", "error")
      return
    }
    try {
      setResult(await importAdminData(type, mode, file))
      showToast("Импорт завершен", "success")
      if (type === "users") await loadUsers()
      if (type === "events" || type === "news") await loadEvents()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка импорта", "error")
    }
  }
  const handleExportDataset = async (dataset: "users" | "events" | "news" | "logs") => {
    try {
      setExportingDataset(dataset)
      const dateToken = new Date().toISOString().slice(0, 10)

      if (dataset === "users") {
        const result = await getAdminUsers({ role: "ALL", limit: 1000 })
        downloadJsonFile(`admin_users_${dateToken}.json`, result)
      }
      if (dataset === "events") {
        const result = await getAdminEvents({ limit: 1000 })
        downloadJsonFile(`admin_events_${dateToken}.json`, result)
      }
      if (dataset === "news") {
        const result = await getAdminEvents({ newsOnly: true, limit: 1000 })
        downloadJsonFile(`admin_news_${dateToken}.json`, result)
      }
      if (dataset === "logs") {
        const result = await getAdminLogs({ limit: 1000 })
        downloadJsonFile(`admin_logs_${dateToken}.json`, result)
      }

      showToast("Экспорт успешно завершен", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка экспорта", "error")
    } finally {
      setExportingDataset(null)
    }
  }

  const handleExportEventExcel = async (eventId: string) => {
    try {
      setExportingEventId(eventId)
      await downloadAdminEventExcel(eventId)
      showToast("Excel файл успешно выгружен", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось выгрузить Excel", "error")
    } finally {
      setExportingEventId(null)
    }
  }
  const tabs = useMemo(
    () =>
      [
        { id: "metrics", label: "Метрики" },
        { id: "users", label: "Пользователи" },
        { id: "events", label: "Мероприятия/Новости" },
        { id: "import", label: "Импорт/Экспорт" },
        { id: "logs", label: "Логи" },
      ] as Array<{ id: AdminTab; label: string }>,
    []
  )

  if (status === "loading") {
    return <div className="container py-10">Проверка доступа...</div>
  }

  if (!canAccess) {
    return (
      <div className="container py-10">
        <div className="admin-panel p-5 text-center space-y-3">
          <h1 className="text-2xl font-semibold">Нет доступа к админ-панели</h1>
          <Button variant="secondary" onClick={() => router.push("/")}>
            На главную
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-rework container px-4 py-4 space-y-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="admin-panel admin-hero p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Админ-панель</h1>
            <p className="text-sm text-gray-500">Управление пользователями, мероприятиями, новостями и аудитом</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="admin-pill admin-pill-live">
              Live events/applications: {LIVE_UPDATE_INTERVAL_MS / 1000}s
            </span>
            <span className="admin-pill admin-pill-live">Live notifications: 15s</span>
          </div>
        </div>
      </div>

      <div className="admin-tabs flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
        {tabs.map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? "primary" : "secondary"} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "metrics" && (
        <AdminMetricsDashboard
          metrics={metrics}
          isLoading={metricsLoading}
          exportEvents={metricsEvents}
          exportingEventId={exportingEventId}
          period={metricsPeriod}
          onPeriodChange={setMetricsPeriod}
          onRefresh={() => void loadMetrics()}
          onExportEvent={(eventId) => void handleExportEventExcel(eventId)}
        />
      )}
      {activeTab === "users" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="admin-panel p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input className="w-full px-3 py-2 border rounded sm:flex-1 sm:min-w-[220px]" placeholder="Поиск пользователей" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
              <select className="w-full px-3 py-2 border rounded sm:w-auto" value={userRole} onChange={(event) => setUserRole(event.target.value as "ALL" | Role)}>
                {roleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void loadUsers()}>Найти</Button>
            </div>
            <div className="bg-white rounded-2xl shadow p-4 overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead><tr className="text-left text-gray-500"><th className="py-2">Имя</th><th>Email</th><th>Роль</th><th /></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="py-2">{user.name || "—"}</td><td>{user.email}</td><td>{user.role}</td>
                      <td className="text-right space-x-2 whitespace-nowrap">
                        <button className="text-accent" onClick={() => setEditingUser(user)}>Редактировать</button>
                        <button className="text-red-600" onClick={() => void handleDeleteUser(user.id)}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-4 space-y-2">
              <h3 className="font-semibold">Создать пользователя</h3>
              <input className="w-full px-3 py-2 border rounded" placeholder="Имя" value={newUser.name} onChange={(event) => setNewUser((previous) => ({ ...previous, name: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Email" value={newUser.email} onChange={(event) => setNewUser((previous) => ({ ...previous, email: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Пароль" type="password" value={newUser.password} onChange={(event) => setNewUser((previous) => ({ ...previous, password: event.target.value }))} />
              <select className="w-full px-3 py-2 border rounded" value={newUser.role} onChange={(event) => setNewUser((previous) => ({ ...previous, role: event.target.value as Role }))}>
                <option value="STUDENT">Студент</option><option value="TEACHER">Преподаватель</option><option value="ADMIN">Администратор</option>
              </select>
              <Button variant="primary" onClick={() => void handleCreateUser()}>Создать</Button>
            </div>
            {editingUser && (
              <div className="bg-white rounded-2xl shadow p-4 space-y-2">
                <h3 className="font-semibold">Редактирование</h3>
                <input className="w-full px-3 py-2 border rounded" value={editingUser.name || ""} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, name: event.target.value } : previous))} />
                <input className="w-full px-3 py-2 border rounded" value={editingUser.email} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, email: event.target.value } : previous))} />
                <input className="w-full px-3 py-2 border rounded" type="password" placeholder="Новый пароль" value={editingPassword} onChange={(event) => setEditingPassword(event.target.value)} />
                <div className="flex flex-col gap-2 sm:flex-row"><Button variant="primary" onClick={() => void handleSaveUser()}>Сохранить</Button><Button variant="secondary" onClick={() => { setEditingUser(null); setEditingPassword("") }}>Отмена</Button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "events" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="admin-panel p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input className="w-full px-3 py-2 border rounded sm:flex-1 sm:min-w-[220px]" placeholder="Поиск мероприятий/новостей" value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} />
              <select className="w-full px-3 py-2 border rounded sm:w-auto" value={eventCategory} onChange={(event) => setEventCategory(event.target.value as EventCategory | "ALL")}>
                <option value="ALL">Все категории</option>
                {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select className="w-full px-3 py-2 border rounded sm:w-auto" value={eventStatus} onChange={(event) => setEventStatus(event.target.value as "ALL" | "UPCOMING" | "PAST")}>
                <option value="ALL">Все</option><option value="UPCOMING">Будущие</option><option value="PAST">Прошедшие</option>
              </select>
              <label className="text-xs text-gray-600 inline-flex items-center gap-2 sm:ml-auto"><input type="checkbox" checked={newsOnly} onChange={(event) => setNewsOnly(event.target.checked)} /> Только новости</label>
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void loadEvents()}>Найти</Button>
            </div>
            <div className="text-xs text-emerald-700">
              Live: обновление мероприятий и заявок каждые {LIVE_UPDATE_INTERVAL_MS / 1000} сек.
            </div>
            <div className="bg-white rounded-2xl shadow p-4 overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">Название</th>
                    <th>Категория</th>
                    <th>Дата</th>
                    <th>Участники / заявки</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t">
                      <td className="py-2">{event.title}</td>
                      <td>{CategoryDisplayMap[event.category] || event.category}</td>
                      <td>{new Date(event.date).toLocaleDateString("ru-RU")}</td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          OK: {event.confirmedParticipants ?? event.currentParticipants ?? 0}
                        </span>
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pending: {event.pendingParticipants ?? 0}
                        </span>
                      </td>
                      <td className="text-right space-x-2 whitespace-nowrap">
                        <button className="text-accent" onClick={() => void handleEditEvent(event)}>
                          Редактировать
                        </button>
                        <button className="text-red-600" onClick={() => void handleDeleteEvent(event.id)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-4 space-y-2">
              <h3 className="font-semibold">Создать новость</h3>
              <input className="w-full px-3 py-2 border rounded" placeholder="Заголовок" value={newsDraft.title} onChange={(event) => setNewsDraft((previous) => ({ ...previous, title: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" type="date" value={newsDraft.date} onChange={(event) => setNewsDraft((previous) => ({ ...previous, date: event.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded min-h-[90px]" placeholder="Текст" value={newsDraft.content} onChange={(event) => setNewsDraft((previous) => ({ ...previous, content: event.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded min-h-[70px]" placeholder="Изображения (URL)" value={newsDraft.imagesText} onChange={(event) => setNewsDraft((previous) => ({ ...previous, imagesText: event.target.value }))} />
              <Button variant="primary" onClick={() => void handleCreateNews()}>Создать новость</Button>
            </div>
            {editingEvent && (
              <div className="bg-white rounded-2xl shadow p-4 space-y-2">
                <h3 className="font-semibold">Редактор записи</h3>
                <input className="w-full px-3 py-2 border rounded" value={editingEvent.title} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, title: event.target.value } : previous)} />
                <textarea className="w-full px-3 py-2 border rounded min-h-[90px]" value={editingEvent.description} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, description: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" type="date" value={editingEvent.date} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, date: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" placeholder="Время HH:mm" value={editingEvent.time} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, time: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" placeholder="Место" value={editingEvent.location} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, location: event.target.value } : previous)} />
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={editingEvent.responsibleId}
                  onChange={(event) =>
                    setEditingEvent((previous) => {
                      if (!previous) return previous
                      const selected = responsibleOptions.find((option) => option.id === event.target.value)
                      return {
                        ...previous,
                        responsibleId: event.target.value,
                        responsible: selected?.name || previous.responsible,
                        contact: selected?.email || previous.contact,
                      }
                    })
                  }
                >
                  <option value="">Руководитель (по ФИО)</option>
                  {responsibleOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.email})
                    </option>
                  ))}
                </select>
                <input className="w-full px-3 py-2 border rounded" placeholder="ФИО руководителя" value={editingEvent.responsible} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, responsible: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" placeholder="Контакт руководителя" value={editingEvent.contact} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, contact: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" placeholder="Модераторы (email)" value={editingEvent.moderatorsText} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, moderatorsText: event.target.value } : previous)} />
                <div className="flex flex-col gap-2 sm:flex-row"><Button variant="primary" onClick={() => void handleSaveEvent()} disabled={savingEvent}>{savingEvent ? "Сохранение..." : "Сохранить"}</Button><Button variant="secondary" onClick={() => setEditingEvent(null)}>Отмена</Button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "import" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="bg-white rounded-2xl shadow p-4 space-y-2">
            <h3 className="font-semibold">Импорт пользователей</h3>
            <input type="file" accept=".csv,.json" className="w-full px-3 py-2 border rounded" onChange={(event) => setImportUsersFile(event.target.files?.[0] || null)} />
            <select className="w-full px-3 py-2 border rounded" value={importUsersMode} onChange={(event) => setImportUsersMode(event.target.value as AdminImportMode)}><option value="upsert">Обновлять</option><option value="create">Только новые</option></select>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void runImport("users", importUsersMode, importUsersFile, setImportUsersResult)}>Импорт</Button>
            {renderImportResult(importUsersResult)}
          </div>
          <div className="bg-white rounded-2xl shadow p-4 space-y-2">
            <h3 className="font-semibold">Импорт мероприятий</h3>
            <input type="file" accept=".csv,.json" className="w-full px-3 py-2 border rounded" onChange={(event) => setImportEventsFile(event.target.files?.[0] || null)} />
            <select className="w-full px-3 py-2 border rounded" value={importEventsMode} onChange={(event) => setImportEventsMode(event.target.value as AdminImportMode)}><option value="upsert">Обновлять</option><option value="create">Только новые</option></select>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void runImport("events", importEventsMode, importEventsFile, setImportEventsResult)}>Импорт</Button>
            {renderImportResult(importEventsResult)}
          </div>
          <div className="bg-white rounded-2xl shadow p-4 space-y-2">
            <h3 className="font-semibold">Импорт новостей</h3>
            <input type="file" accept=".csv,.json" className="w-full px-3 py-2 border rounded" onChange={(event) => setImportNewsFile(event.target.files?.[0] || null)} />
            <select className="w-full px-3 py-2 border rounded" value={importNewsMode} onChange={(event) => setImportNewsMode(event.target.value as AdminImportMode)}><option value="upsert">Обновлять</option><option value="create">Только новые</option></select>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void runImport("news", importNewsMode, importNewsFile, setImportNewsResult)}>Импорт</Button>
            {renderImportResult(importNewsResult)}
          </div>
        </div>
      )}

      {activeTab === "import" && (
        <div className="admin-panel p-4 space-y-3">
          <h3 className="text-base font-semibold text-gray-900">Экспорт данных (JSON)</h3>
          <p className="text-sm text-gray-500">
            Быстрая выгрузка для архивов, отчётности и дополнительной аналитики.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="secondary"
              loading={exportingDataset === "users"}
              onClick={() => void handleExportDataset("users")}
            >
              Пользователи
            </Button>
            <Button
              variant="secondary"
              loading={exportingDataset === "events"}
              onClick={() => void handleExportDataset("events")}
            >
              Мероприятия
            </Button>
            <Button
              variant="secondary"
              loading={exportingDataset === "news"}
              onClick={() => void handleExportDataset("news")}
            >
              Новости
            </Button>
            <Button
              variant="secondary"
              loading={exportingDataset === "logs"}
              onClick={() => void handleExportDataset("logs")}
            >
              Логи
            </Button>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="admin-panel p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input className="w-full px-3 py-2 border rounded sm:w-auto" placeholder="Action" value={logAction} onChange={(event) => setLogAction(event.target.value)} />
            <input className="w-full px-3 py-2 border rounded sm:w-auto" placeholder="EntityType" value={logEntityType} onChange={(event) => setLogEntityType(event.target.value)} />
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void loadLogs()}>Найти</Button>
          </div>
          <div className="bg-white rounded-2xl shadow p-4 space-y-3 max-h-[700px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString("ru-RU")}</div>
                <div className="font-medium">{log.action}</div>
                <div className="text-sm text-gray-600">{log.entityType}{log.entityId ? `: ${log.entityId}` : ""}</div>
                {log.actor && <div className="text-xs text-gray-500">Автор: {log.actor.name || log.actor.email || "—"} ({log.actor.role || "—"})</div>}
                {log.metadata && <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(log.metadata, null, 2)}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

