/**
 * File responsibility:
 * Admin dashboard page for users, events/news, imports and audit logs.
 *
 * Main logic:
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
  getAdminEventDetails,
  getAdminEvents,
  getAdminLogs,
  getAdminUsers,
  importAdminData,
  updateAdminEvent,
  updateAdminUser,
} from "@/features/admin/client/admin-api"
import type {
  AdminAuditLog,
  AdminEvent,
  AdminEventDetails,
  AdminImportMode,
  AdminImportResult,
  AdminUser,
} from "@/features/admin/types"

type AdminTab = "users" | "events" | "import" | "logs"

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

const parseList = (value: string) =>
  value
    .split(/\r?\n/g)
    .flatMap((line) => line.split(/[|,;]/g))
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeDateValue = (value: string) => (value.includes("T") ? value.slice(0, 10) : value)

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

  const [activeTab, setActiveTab] = useState<AdminTab>("users")

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

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

  useEffect(() => {
    if (!canAccess) return
    if (activeTab === "users") void loadUsers()
    if (activeTab === "events") void loadEvents()
    if (activeTab === "logs") void loadLogs()
  }, [activeTab, canAccess, loadUsers, loadEvents, loadLogs])

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
      setEditingEvent(toEditableEvent(await getAdminEventDetails(event.id)))
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

  const tabs = useMemo(
    () =>
      [
        { id: "users", label: "Пользователи" },
        { id: "events", label: "Мероприятия/Новости" },
        { id: "import", label: "Импорт" },
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
        <div className="liquid-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-semibold">Нет доступа к админ-панели</h1>
          <Button variant="secondary" onClick={() => router.push("/")}>
            На главную
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container px-4 py-6 space-y-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="liquid-card p-6">
        <h1 className="text-2xl font-bold text-gray-900">Админ-панель</h1>
        <p className="text-sm text-gray-500">Управление пользователями, мероприятиями, новостями и аудитом</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
        {tabs.map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? "primary" : "secondary"} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "users" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="liquid-card p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
            <div className="liquid-card p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
            <div className="bg-white rounded-2xl shadow p-4 overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead><tr className="text-left text-gray-500"><th className="py-2">Название</th><th>Категория</th><th>Дата</th><th /></tr></thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t">
                      <td className="py-2">{event.title}</td><td>{CategoryDisplayMap[event.category] || event.category}</td><td>{new Date(event.date).toLocaleDateString("ru-RU")}</td>
                      <td className="text-right space-x-2 whitespace-nowrap"><button className="text-accent" onClick={() => void handleEditEvent(event)}>Редактировать</button><button className="text-red-600" onClick={() => void handleDeleteEvent(event.id)}>Удалить</button></td>
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

      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="liquid-card p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
