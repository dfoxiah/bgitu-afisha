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
  createAdminNewsTemplate,
  createAdminUser,
  deleteAdminEvent,
  deleteAdminNewsTemplate,
  deleteAdminUser,
  downloadAdminEventExcel,
  downloadAdminImportTemplate,
  getAdminDiagnostics,
  getAdminEventDetails,
  getAdminEvents,
  getAdminImportHistory,
  getAdminLogs,
  getAdminMetrics,
  getAdminNewsTemplates,
  getAdminStructure,
  getAdminUsers,
  generateAdminNewsDraft,
  importAdminData,
  promoteAdminGroupsAfterSummer,
  updateAdminEvent,
  updateAdminNewsTemplate,
  updateAdminStructure,
  updateAdminUser,
} from "@/features/admin/client/admin-api"
import AdminMetricsDashboard from "@/features/admin/components/AdminMetricsDashboard"
import { isModeratorRole, ROLE_OPTIONS, toRoleLabel } from "@/lib/roles"
import type {
  AdminAuditLog,
  AdminDashboardMetrics,
  AdminDiagnostics,
  AdminEvent,
  AdminEventDetails,
  AdminGroupPromotionResult,
  AdminImportJob,
  AdminImportMode,
  AdminImportResult,
  AdminNewsTemplate,
  AdminStructureField,
  AdminStructureSnapshot,
  AdminUser,
} from "@/features/admin/types"

type AdminTab = "metrics" | "users" | "events" | "templates" | "import" | "logs" | "diagnostics"
const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const LIVE_UPDATE_INTERVAL_MS = Math.max(
  parsePositiveInt(process.env.NEXT_PUBLIC_ADMIN_LIVE_INTERVAL_MS, 30000),
  15000
)

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

type LoadOptions = {
  silent?: boolean
  suppressErrorToast?: boolean
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
  ...ROLE_OPTIONS,
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
  const [compactMode, setCompactMode] = useState(false)
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsLoadError, setMetricsLoadError] = useState<string | null>(null)
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
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersVisibleCount, setUsersVisibleCount] = useState(60)
  const [userSearch, setUserSearch] = useState("")
  const [userRole, setUserRole] = useState<"ALL" | Role>("ALL")
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "STUDENT" as Role,
    department: "",
    group: "",
    admissionYear: "",
    acceptPrivacy: false,
    acceptTerms: false,
  })
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editingPassword, setEditingPassword] = useState("")
  const [structure, setStructure] = useState<AdminStructureSnapshot>({
    departments: [],
    groups: [],
  })
  const [structureLoading, setStructureLoading] = useState(false)
  const [structureField] = useState<AdminStructureField>("group")
  const [structureRoleFilter, setStructureRoleFilter] = useState<"ALL" | Role>("ALL")
  const [structureFromValue, setStructureFromValue] = useState("")
  const [structureToValue, setStructureToValue] = useState("")
  const [structureResetGroupCounter, setStructureResetGroupCounter] = useState(false)
  const [structureSaving, setStructureSaving] = useState(false)
  const [groupPromotion, setGroupPromotion] = useState<AdminGroupPromotionResult | null>(null)
  const [groupPromotionLoading, setGroupPromotionLoading] = useState(false)

  const [events, setEvents] = useState<AdminEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsVisibleCount, setEventsVisibleCount] = useState(60)
  const [eventSearch, setEventSearch] = useState("")
  const [eventCategory, setEventCategory] = useState<EventCategory | "ALL">("ALL")
  const [eventStatus, setEventStatus] = useState<"ALL" | "UPCOMING" | "PAST">("ALL")
  const [newsOnly, setNewsOnly] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null)
  const [adminEventImageUrl, setAdminEventImageUrl] = useState("")
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([])
  const [savingEvent, setSavingEvent] = useState(false)
  const [newsTemplates, setNewsTemplates] = useState<AdminNewsTemplate[]>([])
  const [newsTemplatesLoading, setNewsTemplatesLoading] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    body:
      "Мероприятие «{{title}}» прошло {{date}} на площадке {{location}}.\n\nУчастников: {{participantsCount}}.\nОтветственный: {{responsible}}.\n\nИтоги: {{summary}}",
    eventId: "",
    draftTitle: "",
  })
  const [generatingTemplateId, setGeneratingTemplateId] = useState<string | null>(null)
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
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsVisibleCount, setLogsVisibleCount] = useState(80)
  const [diagnostics, setDiagnostics] = useState<AdminDiagnostics | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)

  const [importUsersFile, setImportUsersFile] = useState<File | null>(null)
  const [importEventsFile, setImportEventsFile] = useState<File | null>(null)
  const [importNewsFile, setImportNewsFile] = useState<File | null>(null)
  const [importUsersMode, setImportUsersMode] = useState<AdminImportMode>("upsert")
  const [importEventsMode, setImportEventsMode] = useState<AdminImportMode>("upsert")
  const [importNewsMode, setImportNewsMode] = useState<AdminImportMode>("upsert")
  const [importUsersResult, setImportUsersResult] = useState<AdminImportResult | null>(null)
  const [importEventsResult, setImportEventsResult] = useState<AdminImportResult | null>(null)
  const [importNewsResult, setImportNewsResult] = useState<AdminImportResult | null>(null)
  const [importHistory, setImportHistory] = useState<AdminImportJob[]>([])
  const [importHistoryLoading, setImportHistoryLoading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState<"users" | "events" | "news" | null>(null)
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
          .filter((user) => isModeratorRole(user.role))
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
      setUsersLoading(true)
      setUsers(await getAdminUsers({ search: userSearch, role: userRole, limit: 200 }))
      setUsersVisibleCount(60)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки пользователей", "error")
    } finally {
      setUsersLoading(false)
    }
  }, [userSearch, userRole])

  const loadStructure = useCallback(async () => {
    try {
      setStructureLoading(true)
      setStructure(await getAdminStructure())
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки структуры", "error")
    } finally {
      setStructureLoading(false)
    }
  }, [])

  const loadEvents = useCallback(async (options: LoadOptions = {}) => {
    const { silent = false, suppressErrorToast = false } = options
    try {
      if (!silent) setEventsLoading(true)
      setEvents(
        await getAdminEvents({
          search: eventSearch,
          category: eventCategory,
          status: eventStatus,
          newsOnly,
          limit: 200,
        })
      )
      if (!silent) {
        setEventsVisibleCount(60)
      }
    } catch (error) {
      if (suppressErrorToast) return
      showToast(error instanceof Error ? error.message : "Ошибка загрузки мероприятий", "error")
    } finally {
      if (!silent) setEventsLoading(false)
    }
  }, [eventSearch, eventCategory, eventStatus, newsOnly])

  const loadNewsTemplates = useCallback(async () => {
    try {
      setNewsTemplatesLoading(true)
      setNewsTemplates(await getAdminNewsTemplates())
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки шаблонов новостей", "error")
    } finally {
      setNewsTemplatesLoading(false)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    try {
      setLogsLoading(true)
      setLogs(await getAdminLogs({ action: logAction, entityType: logEntityType, limit: 100 }))
      setLogsVisibleCount(80)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка загрузки логов", "error")
    } finally {
      setLogsLoading(false)
    }
  }, [logAction, logEntityType])

  const loadDiagnostics = useCallback(async () => {
    try {
      setDiagnosticsLoading(true)
      setDiagnosticsError(null)
      setDiagnostics(await getAdminDiagnostics())
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось выполнить диагностику"
      setDiagnosticsError(message)
      showToast(message, "error")
    } finally {
      setDiagnosticsLoading(false)
    }
  }, [])

  const loadImportHistory = useCallback(async () => {
    try {
      setImportHistoryLoading(true)
      setImportHistory(await getAdminImportHistory())
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось загрузить историю импорта", "error")
    } finally {
      setImportHistoryLoading(false)
    }
  }, [])

  const visibleUsers = useMemo(() => users.slice(0, usersVisibleCount), [users, usersVisibleCount])
  const visibleEvents = useMemo(() => events.slice(0, eventsVisibleCount), [events, eventsVisibleCount])
  const visibleLogs = useMemo(() => logs.slice(0, logsVisibleCount), [logs, logsVisibleCount])
  const loadMetrics = useCallback(async (options: LoadOptions = {}) => {
    const { silent = false, suppressErrorToast = false } = options
    try {
      if (!silent) setMetricsLoading(true)
      const nextMetrics = await getAdminMetrics({
        from: metricsPeriod.from,
        to: metricsPeriod.to,
      })
      setMetrics(nextMetrics)
      setMetricsLoadError(null)

      try {
        setMetricsEvents(await getAdminEvents({ limit: 200 }))
      } catch {
        setMetricsEvents([])
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить метрики"
      setMetricsLoadError(message)
      if (suppressErrorToast) return
      showToast(message, "error")
    } finally {
      if (!silent) setMetricsLoading(false)
    }
  }, [metricsPeriod.from, metricsPeriod.to])

  useEffect(() => {
    if (!canAccess) return
    if (activeTab === "metrics") void loadMetrics()
    if (activeTab === "users") {
      void Promise.all([loadUsers(), loadStructure()])
    }
    if (activeTab === "events") void loadEvents()
    if (activeTab === "templates") {
      void loadNewsTemplates()
      void loadEvents({ silent: true, suppressErrorToast: true })
    }
    if (activeTab === "import") void loadImportHistory()
    if (activeTab === "logs") void loadLogs()
    if (activeTab === "diagnostics") void loadDiagnostics()
  }, [activeTab, canAccess, loadMetrics, loadUsers, loadStructure, loadEvents, loadNewsTemplates, loadImportHistory, loadLogs, loadDiagnostics])

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

  const currentStructureValues = useMemo(
    () => (structureField === "department" ? structure.departments : structure.groups),
    [structureField, structure]
  )

  useEffect(() => {
    if (currentStructureValues.length === 0) {
      if (structureFromValue) setStructureFromValue("")
      return
    }

    const hasCurrent = currentStructureValues.some((item) => item.value === structureFromValue)
    if (!hasCurrent) {
      setStructureFromValue(currentStructureValues[0].value)
    }
  }, [currentStructureValues, structureFromValue])

  useEffect(() => {
    if (structureField !== "group" && structureResetGroupCounter) {
      setStructureResetGroupCounter(false)
    }
  }, [structureField, structureResetGroupCounter])

  useEffect(() => {
    if (!canAccess) return
    if (activeTab !== "metrics" && activeTab !== "events") return

    let refreshInFlight = false

    const refreshActiveData = async () => {
      if (document.visibilityState === "hidden" || refreshInFlight) return
      refreshInFlight = true
      try {
        if (activeTab === "metrics") {
          await loadMetrics({ silent: true, suppressErrorToast: true })
        } else {
          await loadEvents({ silent: true, suppressErrorToast: true })
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
      await createAdminUser({
        ...newUser,
        admissionYear: newUser.admissionYear ? Number(newUser.admissionYear) : null,
      })
      showToast("Пользователь создан", "success")
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "STUDENT",
        department: "",
        group: "",
        admissionYear: "",
        acceptPrivacy: false,
        acceptTerms: false,
      })
      await Promise.all([loadUsers(), loadStructure()])
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
        admissionYear: editingUser.admissionYear,
        groupChangeCount: editingUser.groupChangeCount,
        privacyConsentAt: editingUser.privacyConsentAt || null,
        termsConsentAt: editingUser.termsConsentAt || null,
        password: editingPassword || undefined,
      })
      showToast("Пользователь обновлен", "success")
      setEditingUser(null)
      setEditingPassword("")
      await Promise.all([loadUsers(), loadStructure()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка обновления пользователя", "error")
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Удалить пользователя?")) return
    try {
      await deleteAdminUser(id)
      showToast("Пользователь удален", "success")
      await Promise.all([loadUsers(), loadStructure()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка удаления пользователя", "error")
    }
  }

  const handleApplyStructureUpdate = async () => {
    const fromValue = structureFromValue.trim()
    if (!fromValue) {
      showToast("Выберите текущее значение для изменения", "error")
      return
    }

    const toValue = structureToValue.trim()
    if (toValue && toValue === fromValue) {
      showToast("Новое значение совпадает с текущим", "error")
      return
    }

    const fieldLabel =
      structureField === "department" ? "кафедру/факультет" : "группу/курс"
    const operationText = toValue
      ? `Изменить ${fieldLabel} "${fromValue}" на "${toValue}"?`
      : `Очистить ${fieldLabel} "${fromValue}" у выбранных пользователей?`
    if (!confirm(operationText)) return

    try {
      setStructureSaving(true)
      const result = await updateAdminStructure({
        field: structureField,
        fromValue,
        toValue: toValue || null,
        role: structureRoleFilter,
        resetGroupChangeCount:
          structureField === "group" ? structureResetGroupCounter : false,
      })
      const changedText =
        result.affectedUsers > 0
          ? `Обновлено пользователей: ${result.affectedUsers}`
          : "Совпадений не найдено, изменений нет"
      showToast(changedText, "success")
      setStructureToValue("")

      await Promise.all([loadUsers(), loadStructure()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка обновления структуры", "error")
    } finally {
      setStructureSaving(false)
    }
  }

  const handlePreviewGroupPromotion = async () => {
    try {
      setGroupPromotionLoading(true)
      const result = await promoteAdminGroupsAfterSummer(true)
      setGroupPromotion(result)
      showToast(`Найдено переходов групп: ${result.promotedGroups.length}`, "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка расчета перехода групп", "error")
    } finally {
      setGroupPromotionLoading(false)
    }
  }

  const handleApplyGroupPromotion = async () => {
    const previewCount = groupPromotion?.promotedGroups.length ?? 0
    if (!confirm(`Запустить ежегодный переход групп? Будет обработано групп: ${previewCount || "по расчету"}.`)) return

    try {
      setGroupPromotionLoading(true)
      const result = await promoteAdminGroupsAfterSummer(false)
      setGroupPromotion(result)
      showToast(`Автопереход выполнен. Обновлено пользователей: ${result.affectedUsers}`, "success")
      await Promise.all([loadUsers(), loadStructure()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка применения перехода групп", "error")
    } finally {
      setGroupPromotionLoading(false)
    }
  }

  const setEditingEventImages = (images: string[]) => {
    setEditingEvent((previous) =>
      previous ? { ...previous, imagesText: images.filter(Boolean).join("\n") } : previous
    )
  }

  const handleAddAdminEventImage = () => {
    if (!editingEvent) return
    const url = adminEventImageUrl.trim()
    if (!url) return

    const images = parseList(editingEvent.imagesText)
    if (images.length >= 10) {
      showToast("Можно добавить не больше 10 фото", "error")
      return
    }

    setEditingEventImages([...images, url])
    setAdminEventImageUrl("")
  }

  const handleUpdateAdminEventImage = (index: number, url: string) => {
    if (!editingEvent) return
    const images = parseList(editingEvent.imagesText)
    images[index] = url
    setEditingEventImages(images)
  }

  const handleRemoveAdminEventImage = (index: number) => {
    if (!editingEvent) return
    setEditingEventImages(parseList(editingEvent.imagesText).filter((_, imageIndex) => imageIndex !== index))
  }

  const handleMoveAdminEventImage = (index: number, direction: -1 | 1) => {
    if (!editingEvent) return
    const nextIndex = index + direction
    const images = parseList(editingEvent.imagesText)
    if (nextIndex < 0 || nextIndex >= images.length) return
    const current = images[index]
    images[index] = images[nextIndex]
    images[nextIndex] = current
    setEditingEventImages(images)
  }

  const handleSetAdminEventCover = (index: number) => {
    if (!editingEvent || index === 0) return
    const images = parseList(editingEvent.imagesText)
    const [cover] = images.splice(index, 1)
    setEditingEventImages([cover, ...images])
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
      setAdminEventImageUrl("")
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

  const resetTemplateForm = () => {
    setEditingTemplateId(null)
    setTemplateForm({
      name: "",
      description: "",
      body:
        "Мероприятие «{{title}}» прошло {{date}} на площадке {{location}}.\n\nУчастников: {{participantsCount}}.\nОтветственный: {{responsible}}.\n\nИтоги: {{summary}}",
      eventId: "",
      draftTitle: "",
    })
  }

  const handleEditTemplate = (template: AdminNewsTemplate) => {
    setEditingTemplateId(template.id)
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      body: template.body,
      eventId: "",
      draftTitle: "",
    })
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.body.trim()) {
      showToast("Укажите название и текст шаблона", "error")
      return
    }

    try {
      const payload = {
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || null,
        body: templateForm.body.trim(),
      }
      if (editingTemplateId) {
        await updateAdminNewsTemplate(editingTemplateId, payload)
        showToast("Шаблон обновлен", "success")
      } else {
        await createAdminNewsTemplate(payload)
        showToast("Шаблон создан", "success")
      }
      resetTemplateForm()
      await loadNewsTemplates()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка сохранения шаблона", "error")
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm("Удалить шаблон новости?")) return
    try {
      await deleteAdminNewsTemplate(templateId)
      showToast("Шаблон удален", "success")
      if (editingTemplateId === templateId) resetTemplateForm()
      await loadNewsTemplates()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка удаления шаблона", "error")
    }
  }

  const handleGenerateNewsDraft = async (templateId: string) => {
    if (!templateForm.eventId.trim()) {
      showToast("Укажите ID мероприятия для генерации", "error")
      return
    }

    try {
      setGeneratingTemplateId(templateId)
      const draft = await generateAdminNewsDraft(templateId, templateForm.eventId.trim(), templateForm.draftTitle.trim() || undefined)
      showToast("Черновик новости создан", "success")
      setTemplateForm((previous) => ({ ...previous, eventId: "", draftTitle: "" }))
      await loadEvents()
      router.push(draft.link)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка генерации черновика", "error")
    } finally {
      setGeneratingTemplateId(null)
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
      if (type === "users") await Promise.all([loadUsers(), loadStructure()])
      if (type === "events" || type === "news") await loadEvents()
      await loadImportHistory()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка импорта", "error")
    }
  }

  const handleDownloadImportTemplate = async (type: "users" | "events" | "news") => {
    try {
      setDownloadingTemplate(type)
      await downloadAdminImportTemplate(type)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не удалось скачать шаблон", "error")
    } finally {
      setDownloadingTemplate(null)
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
        { id: "templates", label: "Шаблоны новостей" },
        { id: "import", label: "Импорт/Экспорт" },
        { id: "logs", label: "Логи" },
        { id: "diagnostics", label: "Диагностика" },
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
    <div className={`admin-rework container px-3 py-2 space-y-2 sm:px-4 ${compactMode ? "admin-compact" : ""}`}>
      <div className="admin-panel admin-hero p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Админ-панель</h1>
            <p className="text-sm text-gray-500">Управление пользователями, мероприятиями, новостями и аудитом</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="admin-pill admin-pill-live">
              Автообновление: {Math.max(Math.floor(LIVE_UPDATE_INTERVAL_MS / 1000), 1)} сек.
            </span>
            <button
              type="button"
              className="admin-pill"
              onClick={() => setCompactMode((prev) => !prev)}
            >
              {compactMode ? "Компакт: Вкл" : "Компакт: Выкл"}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-tabs flex gap-2 overflow-x-auto no-scrollbar sm:flex-wrap">
        {tabs.map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? "primary" : "secondary"} onClick={() => setActiveTab(tab.id)} className="px-3 py-2 text-sm">
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "metrics" && (
        <AdminMetricsDashboard
          metrics={metrics}
          isLoading={metricsLoading}
          errorMessage={metricsLoadError}
          liveIntervalMs={LIVE_UPDATE_INTERVAL_MS}
          exportEvents={metricsEvents}
          exportingEventId={exportingEventId}
          period={metricsPeriod}
          onPeriodChange={setMetricsPeriod}
          onRefresh={() => void loadMetrics()}
          onExportEvent={(eventId) => void handleExportEventExcel(eventId)}
          onOpenDiagnostics={() => setActiveTab("diagnostics")}
        />
      )}
      {activeTab === "users" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="admin-panel admin-toolbar p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input className="w-full px-3 py-2 border rounded sm:flex-1 sm:min-w-[220px]" placeholder="Поиск пользователей" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
              <select className="w-full px-3 py-2 border rounded sm:w-auto" value={userRole} onChange={(event) => setUserRole(event.target.value as "ALL" | Role)}>
                {roleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void loadUsers()}>Найти</Button>
            </div>
            <div className="admin-panel admin-table-surface p-4 overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">Имя</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Кафедра/факультет</th>
                    <th>Группа/курс</th>
                    <th>Год поступления</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {usersLoading &&
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`users-skeleton-${index}`} className="border-t animate-pulse">
                        <td className="py-3"><div className="h-3 w-24 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-36 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-20 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-28 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-24 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-20 rounded bg-slate-200" /></td>
                        <td><div className="ml-auto h-3 w-28 rounded bg-slate-200" /></td>
                      </tr>
                    ))}
                  {!usersLoading && visibleUsers.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="py-2">
                        <div className="font-semibold text-slate-900">{user.name || "Без имени"}</div>
                        <div className="text-xs text-slate-500">Создан: {new Date(user.createdAt).toLocaleDateString("ru-RU")}</div>
                        {user.updatedAt && (
                          <div className="text-xs text-slate-500">
                            Активность: {new Date(user.updatedAt).toLocaleDateString("ru-RU")}
                          </div>
                        )}
                      </td>
                      <td className="text-slate-700">{user.email}</td>
                      <td>
                        <span className="rounded-full border border-primary/14 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                          {toRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="text-slate-700">{user.department || "Не указано"}</td>
                      <td className="text-slate-700">{user.group || "Не указана"}</td>
                      <td className="text-slate-700">{user.admissionYear || "Не указан"}</td>
                      <td className="text-right space-x-2 whitespace-nowrap">
                        <button className="text-primary" onClick={() => router.push(`/users/${user.id}`)}>Профиль</button>
                        <button className="text-accent" onClick={() => setEditingUser(user)}>Редактировать</button>
                        <button className="text-red-600" onClick={() => void handleDeleteUser(user.id)}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!usersLoading && users.length > usersVisibleCount && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" onClick={() => setUsersVisibleCount((prev) => prev + 60)}>
                    Показать ещё ({users.length - usersVisibleCount})
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="admin-panel p-4 space-y-2">
              <h3 className="font-semibold">Создать пользователя</h3>
              <input className="w-full px-3 py-2 border rounded" placeholder="Имя" value={newUser.name} onChange={(event) => setNewUser((previous) => ({ ...previous, name: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Email" value={newUser.email} onChange={(event) => setNewUser((previous) => ({ ...previous, email: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Пароль" type="password" value={newUser.password} onChange={(event) => setNewUser((previous) => ({ ...previous, password: event.target.value }))} />
              <select className="w-full px-3 py-2 border rounded" value={newUser.role} onChange={(event) => setNewUser((previous) => ({ ...previous, role: event.target.value as Role }))}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input className="w-full px-3 py-2 border rounded" placeholder="Кафедра/факультет (необязательно)" value={newUser.department} onChange={(event) => setNewUser((previous) => ({ ...previous, department: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Группа/курс (необязательно)" value={newUser.group} onChange={(event) => setNewUser((previous) => ({ ...previous, group: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" type="number" min={1990} max={new Date().getFullYear() + 1} placeholder="Год поступления (для студента)" value={newUser.admissionYear} onChange={(event) => setNewUser((previous) => ({ ...previous, admissionYear: event.target.value }))} />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={newUser.acceptPrivacy}
                  onChange={(event) =>
                    setNewUser((previous) => ({ ...previous, acceptPrivacy: event.target.checked }))
                  }
                />
                Подтверждена актуальная политика конфиденциальности
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={newUser.acceptTerms}
                  onChange={(event) =>
                    setNewUser((previous) => ({ ...previous, acceptTerms: event.target.checked }))
                  }
                />
                Подтверждено актуальное пользовательское соглашение
              </label>
              <Button variant="primary" onClick={() => void handleCreateUser()}>Создать</Button>
            </div>
            {editingUser && (
              <div className="admin-panel p-4 space-y-2">
                <h3 className="font-semibold">Редактирование</h3>
                <input className="w-full px-3 py-2 border rounded" value={editingUser.name || ""} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, name: event.target.value } : previous))} />
                <input className="w-full px-3 py-2 border rounded" value={editingUser.email} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, email: event.target.value } : previous))} />
                <select className="w-full px-3 py-2 border rounded" value={editingUser.role} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, role: event.target.value as Role } : previous))}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input className="w-full px-3 py-2 border rounded" placeholder="Кафедра/факультет" value={editingUser.department || ""} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, department: event.target.value } : previous))} />
                <input className="w-full px-3 py-2 border rounded" placeholder="Группа/курс" value={editingUser.group || ""} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, group: event.target.value } : previous))} />
                <input className="w-full px-3 py-2 border rounded" type="number" min={1990} max={new Date().getFullYear() + 1} placeholder="Год поступления" value={editingUser.admissionYear || ""} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, admissionYear: event.target.value ? Number(event.target.value) : null } : previous))} />
                <input className="w-full px-3 py-2 border rounded" type="number" min={0} placeholder="Счетчик смены группы" value={editingUser.groupChangeCount} onChange={(event) => setEditingUser((previous) => (previous ? { ...previous, groupChangeCount: Math.max(0, Number(event.target.value) || 0) } : previous))} />
                <input className="w-full px-3 py-2 border rounded" type="password" placeholder="Новый пароль" value={editingPassword} onChange={(event) => setEditingPassword(event.target.value)} />
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={Boolean(editingUser.privacyConsentAt)}
                    onChange={(event) =>
                      setEditingUser((previous) =>
                        previous
                          ? {
                              ...previous,
                              privacyConsentAt: event.target.checked ? new Date().toISOString() : null,
                            }
                          : previous
                      )
                    }
                  />
                  Политика конфиденциальности подтверждена
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={Boolean(editingUser.termsConsentAt)}
                    onChange={(event) =>
                      setEditingUser((previous) =>
                        previous
                          ? {
                              ...previous,
                              termsConsentAt: event.target.checked ? new Date().toISOString() : null,
                            }
                          : previous
                      )
                    }
                  />
                  Пользовательское соглашение подтверждено
                </label>
                <div className="flex flex-col gap-2 sm:flex-row"><Button variant="primary" onClick={() => void handleSaveUser()}>Сохранить</Button><Button variant="secondary" onClick={() => { setEditingUser(null); setEditingPassword("") }}>Отмена</Button></div>
              </div>
            )}
            <div className="admin-panel p-4 space-y-3">
              <h3 className="font-semibold">Массовая редакция групп</h3>
              <p className="text-xs text-gray-500">
                Переименовывает или очищает одинаковые группы сразу у выбранных пользователей. Кафедры здесь не меняем, чтобы случайно не затронуть учебную структуру.
              </p>
              <select
                className="w-full px-3 py-2 border rounded"
                value={structureRoleFilter}
                onChange={(event) => setStructureRoleFilter(event.target.value as "ALL" | Role)}
              >
                {roleOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="w-full px-3 py-2 border rounded"
                value={structureFromValue}
                onChange={(event) => setStructureFromValue(event.target.value)}
                disabled={structureLoading || currentStructureValues.length === 0}
              >
                {currentStructureValues.length === 0 && (
                  <option value="">Нет данных для изменения</option>
                )}
                {currentStructureValues.map((item) => (
                  <option key={item.value} value={item.value}>
                    {`${item.value} (${item.total})`}
                  </option>
                ))}
              </select>
              <input
                className="w-full px-3 py-2 border rounded"
                placeholder="Новое значение (оставьте пустым для очистки)"
                value={structureToValue}
                onChange={(event) => setStructureToValue(event.target.value)}
              />
              {structureField === "group" && (
                <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={structureResetGroupCounter}
                    onChange={(event) => setStructureResetGroupCounter(event.target.checked)}
                  />
                  Сбросить счетчик смены группы (groupChangeCount)
                </label>
              )}
              <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-900">
                <div className="font-semibold">Автопереход после лета</div>
                <p className="mt-1">
                  Код помечен как <span className="font-mono">ANNUAL_GROUP_PROMOTION</span>: группы вида ИСТ-301 автоматически считаются как ИСТ-401, ИС-21 как ИС-31. Группы 5 курса не повышаются.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => void handlePreviewGroupPromotion()}
                    loading={groupPromotionLoading}
                  >
                    Проверить переход
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void handleApplyGroupPromotion()}
                    loading={groupPromotionLoading}
                  >
                    Применить переход
                  </Button>
                </div>
                {groupPromotion && (
                  <div className="mt-3 max-h-36 overflow-y-auto rounded-lg border border-sky-200 bg-white/80 p-2">
                    {groupPromotion.promotedGroups.length === 0 ? (
                      <p>Подходящих групп не найдено.</p>
                    ) : (
                      <div className="space-y-1">
                        {groupPromotion.promotedGroups.slice(0, 12).map((item) => (
                          <div key={`${item.from}:${item.to}`} className="flex justify-between gap-2">
                            <span>{item.from}{" -> "}{item.to}</span>
                            <span>{item.users} чел.</span>
                          </div>
                        ))}
                        {groupPromotion.promotedGroups.length > 12 && (
                          <p className="text-sky-700">И еще {groupPromotion.promotedGroups.length - 12} групп.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="primary"
                  onClick={() => void handleApplyStructureUpdate()}
                  loading={structureSaving}
                  disabled={structureLoading || currentStructureValues.length === 0}
                >
                  Применить
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void loadStructure()}
                  disabled={structureLoading}
                >
                  Обновить список
                </Button>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 max-h-60 overflow-y-auto">
                {structureLoading ? (
                  <p className="text-xs text-gray-500">Загрузка структуры...</p>
                ) : currentStructureValues.length === 0 ? (
                  <p className="text-xs text-gray-500">Нет значений для выбранного поля.</p>
                ) : (
                  <div className="space-y-2">
                    {currentStructureValues.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setStructureFromValue(item.value)}
                        className={`w-full rounded border px-2 py-2 text-left text-xs ${
                          structureFromValue === item.value
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-primary/30"
                        }`}
                      >
                        <div className="font-medium text-gray-800">{item.value}</div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          Всего: {item.total} | Студенты: {item.byRole.STUDENT} | Преподаватели: {item.byRole.TEACHER} | Редакторы: {item.byRole.EDITOR} | Админы: {item.byRole.ADMIN}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "events" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="admin-panel admin-toolbar p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
              Live: обновление мероприятий и заявок каждые {Math.max(Math.floor(LIVE_UPDATE_INTERVAL_MS / 1000), 1)} сек.
            </div>
            <div className="admin-panel admin-table-surface p-4 overflow-x-auto">
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
                  {eventsLoading &&
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`events-skeleton-${index}`} className="border-t animate-pulse">
                        <td className="py-3"><div className="h-3 w-40 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-24 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-20 rounded bg-slate-200" /></td>
                        <td><div className="h-3 w-28 rounded bg-slate-200" /></td>
                        <td><div className="ml-auto h-3 w-24 rounded bg-slate-200" /></td>
                      </tr>
                    ))}
                  {!eventsLoading && visibleEvents.map((event) => (
                    <tr key={event.id} className="border-t">
                      <td className="py-2">{event.title}</td>
                      <td>{CategoryDisplayMap[event.category] || event.category}</td>
                      <td>{new Date(event.date).toLocaleDateString("ru-RU")}</td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {event.isPast ? "Итог" : "Подтверждено"}: {event.confirmedParticipants ?? event.currentParticipants ?? 0}
                        </span>
                        {!event.isPast && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Заявки: {event.pendingParticipants ?? 0}
                          </span>
                        )}
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
              {!eventsLoading && events.length > eventsVisibleCount && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" onClick={() => setEventsVisibleCount((prev) => prev + 60)}>
                    Показать ещё ({events.length - eventsVisibleCount})
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="admin-panel p-4 space-y-2">
              <h3 className="font-semibold">Создать новость</h3>
              <input className="w-full px-3 py-2 border rounded" placeholder="Заголовок" value={newsDraft.title} onChange={(event) => setNewsDraft((previous) => ({ ...previous, title: event.target.value }))} />
              <input className="w-full px-3 py-2 border rounded" type="date" value={newsDraft.date} onChange={(event) => setNewsDraft((previous) => ({ ...previous, date: event.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded min-h-[90px]" placeholder="Текст" value={newsDraft.content} onChange={(event) => setNewsDraft((previous) => ({ ...previous, content: event.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded min-h-[70px]" placeholder="Изображения (URL)" value={newsDraft.imagesText} onChange={(event) => setNewsDraft((previous) => ({ ...previous, imagesText: event.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded min-h-[60px]" placeholder="Тезисы / задачи новости (по одному в строке)" value={newsDraft.tasksText} onChange={(event) => setNewsDraft((previous) => ({ ...previous, tasksText: event.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded min-h-[50px]" placeholder="Комментарий редактора" value={newsDraft.comment} onChange={(event) => setNewsDraft((previous) => ({ ...previous, comment: event.target.value }))} />
              <div className="rounded-xl border border-primary/12 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-primary/55">Превью новости</div>
                <div className="mt-2 text-sm font-semibold text-primary">{newsDraft.title || "Заголовок новости"}</div>
                <div className="mt-1 line-clamp-3 text-xs text-slate-600">{newsDraft.content || "Текст новости появится здесь"}</div>
              </div>
              <Button variant="primary" onClick={() => void handleCreateNews()}>Создать новость</Button>
            </div>
            {editingEvent && (
              <div className="admin-panel p-4 space-y-2">
                <h3 className="font-semibold">Редактор записи</h3>
                <input className="w-full px-3 py-2 border rounded" value={editingEvent.title} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, title: event.target.value } : previous)} />
                <select className="w-full px-3 py-2 border rounded" value={editingEvent.category} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, category: event.target.value as EventCategory } : previous)}>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <textarea className="w-full px-3 py-2 border rounded min-h-[90px]" value={editingEvent.description} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, description: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" type="date" value={editingEvent.date} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, date: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" placeholder="Время HH:mm" value={editingEvent.time} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, time: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" placeholder="Место" value={editingEvent.location} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, location: event.target.value } : previous)} />
                <input className="w-full px-3 py-2 border rounded" type="number" min={0} placeholder="Лимит участников" value={editingEvent.maxParticipants} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, maxParticipants: Math.max(0, Number(event.target.value) || 0) } : previous)} />
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editingEvent.isNews}
                    onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, isNews: event.target.checked } : previous)}
                  />
                  Опубликовать как новость / материал
                </label>
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Фото карточки ({parseList(editingEvent.imagesText).length}/10)
                    </div>
                    <span className="text-xs text-slate-500">Первое фото — обложка</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Вставить URL фото"
                      value={adminEventImageUrl}
                      onChange={(event) => setAdminEventImageUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          handleAddAdminEventImage()
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      onClick={handleAddAdminEventImage}
                      disabled={!adminEventImageUrl.trim() || parseList(editingEvent.imagesText).length >= 10}
                    >
                      Добавить
                    </Button>
                  </div>
                  {parseList(editingEvent.imagesText).length > 0 ? (
                    <div className="event-photo-grid">
                      {parseList(editingEvent.imagesText).map((imageUrl, index) => (
                        <article key={`${imageUrl}-${index}`} className="event-photo-card">
                          <figure>
                            {index === 0 && <span className="event-photo-cover">Обложка</span>}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageUrl} alt={`Фото ${index + 1}`} />
                            <div className="event-photo-actions">
                              <button type="button" onClick={() => handleSetAdminEventCover(index)} title="Сделать обложкой">
                                <i className="fas fa-star" />
                              </button>
                              <button type="button" onClick={() => handleRemoveAdminEventImage(index)} title="Удалить фото">
                                <i className="fas fa-trash" />
                              </button>
                            </div>
                          </figure>
                          <div className="event-photo-body">
                            <input
                              value={imageUrl}
                              onChange={(event) => handleUpdateAdminEventImage(index, event.target.value)}
                              placeholder="URL фото"
                            />
                            <div className="event-photo-move">
                              <button type="button" onClick={() => handleMoveAdminEventImage(index, -1)} disabled={index === 0}>
                                <i className="fas fa-arrow-left" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveAdminEventImage(index, 1)}
                                disabled={index === parseList(editingEvent.imagesText).length - 1}
                              >
                                <i className="fas fa-arrow-right" />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-sm text-slate-500">
                      Фото не добавлены.
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Редактор новости / отчета</div>
                  <textarea className="w-full px-3 py-2 border rounded min-h-[80px]" placeholder="Текст новости или итогового отчета" value={editingEvent.reportSummary} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, reportSummary: event.target.value } : previous)} />
                  <input className="w-full px-3 py-2 border rounded" type="date" value={editingEvent.reportDate} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, reportDate: event.target.value } : previous)} />
                  <textarea className="w-full px-3 py-2 border rounded min-h-[60px]" placeholder="Задачи / тезисы (по одному в строке)" value={editingEvent.reportTasksText} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, reportTasksText: event.target.value } : previous)} />
                  <textarea className="w-full px-3 py-2 border rounded min-h-[60px]" placeholder="Фотоотчет (URL, по одному в строке)" value={editingEvent.reportImagesText} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, reportImagesText: event.target.value } : previous)} />
                  <textarea className="w-full px-3 py-2 border rounded min-h-[50px]" placeholder="Комментарий редактора" value={editingEvent.reportComment} onChange={(event) => setEditingEvent((previous) => previous ? { ...previous, reportComment: event.target.value } : previous)} />
                </div>
                <div className="overflow-hidden rounded-xl border border-primary/12 bg-white">
                  <div className="relative h-28 bg-gradient-to-br from-primary to-accent">
                    {parseList(editingEvent.imagesText)[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={parseList(editingEvent.imagesText)[0]} alt="" className="h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-slate-950/25" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-primary">
                      {CategoryDisplayMap[editingEvent.category] || editingEvent.category}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold text-primary">{editingEvent.title || "Название записи"}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">{editingEvent.description || "Описание карточки появится здесь"}</div>
                    <div className="mt-2 text-xs text-slate-500">{new Date(editingEvent.date).toLocaleDateString("ru-RU")} • {editingEvent.location || "Место не указано"}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row"><Button variant="primary" onClick={() => void handleSaveEvent()} disabled={savingEvent}>{savingEvent ? "Сохранение..." : "Сохранить"}</Button><Button variant="secondary" onClick={() => setEditingEvent(null)}>Отмена</Button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="admin-panel p-4 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTemplateId ? "Редактирование шаблона" : "Новый шаблон новости"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Используйте переменные: {"{{title}}"}, {"{{date}}"}, {"{{location}}"}, {"{{participantsCount}}"}, {"{{responsible}}"}, {"{{summary}}"}, {"{{activeParticipants}}"}.
              </p>
            </div>

            <input
              className="w-full px-3 py-2 border rounded"
              placeholder="Название шаблона"
              value={templateForm.name}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, name: event.target.value }))}
            />
            <input
              className="w-full px-3 py-2 border rounded"
              placeholder="Краткое описание"
              value={templateForm.description}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, description: event.target.value }))}
            />
            <textarea
              className="w-full px-3 py-2 border rounded min-h-[220px]"
              placeholder="Текст шаблона"
              value={templateForm.body}
              onChange={(event) => setTemplateForm((previous) => ({ ...previous, body: event.target.value }))}
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Генерация черновика по мероприятию
              </div>
              <select
                className="w-full px-3 py-2 border rounded"
                value={templateForm.eventId}
                onChange={(event) => setTemplateForm((previous) => ({ ...previous, eventId: event.target.value }))}
              >
                <option value="">Выберите мероприятие</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} · {new Date(event.date).toLocaleDateString("ru-RU")}
                  </option>
                ))}
              </select>
              <input
                className="w-full px-3 py-2 border rounded"
                placeholder="Заголовок черновика, если нужен особый"
                value={templateForm.draftTitle}
                onChange={(event) => setTemplateForm((previous) => ({ ...previous, draftTitle: event.target.value }))}
              />
              <p className="text-xs text-gray-500">
                Черновик создаётся как скрытая новостная запись. Перед публикацией его нужно открыть и отредактировать.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="primary" onClick={() => void handleSaveTemplate()}>
                {editingTemplateId ? "Сохранить шаблон" : "Создать шаблон"}
              </Button>
              {editingTemplateId && (
                <Button variant="secondary" onClick={resetTemplateForm}>
                  Отмена
                </Button>
              )}
            </div>
          </section>

          <section className="admin-panel p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Сохранённые шаблоны</h2>
                <p className="mt-1 text-sm text-gray-500">Шаблоны доступны редакторам и администраторам.</p>
              </div>
              <Button variant="secondary" loading={newsTemplatesLoading} onClick={() => void loadNewsTemplates()}>
                Обновить
              </Button>
            </div>

            {newsTemplatesLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                ))}
              </div>
            )}

            {!newsTemplatesLoading && newsTemplates.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white/75 p-4 text-sm text-gray-500">
                Шаблонов пока нет. Создайте первый шаблон для повторяемых новостных материалов.
              </div>
            )}

            {!newsTemplatesLoading && newsTemplates.length > 0 && (
              <div className="space-y-3">
                {newsTemplates.map((template) => (
                  <article key={template.id} className="rounded-xl border border-slate-200 bg-white/85 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        {template.description && (
                          <p className="mt-1 text-sm text-gray-500">{template.description}</p>
                        )}
                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-gray-600">{template.body}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {template.variables.map((variable) => (
                            <span key={variable} className="rounded-full bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {variable}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => handleEditTemplate(template)}>
                          Изменить
                        </Button>
                        <Button
                          variant="secondary"
                          loading={generatingTemplateId === template.id}
                          onClick={() => void handleGenerateNewsDraft(template.id)}
                        >
                          Черновик
                        </Button>
                        <Button variant="danger" onClick={() => void handleDeleteTemplate(template.id)}>
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "import" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="admin-panel p-4 space-y-3 md:col-span-2 xl:col-span-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Шаблоны и правила импорта</h3>
                <p className="mt-1 text-sm text-gray-500">
                  CSV-шаблоны можно использовать как основу для повторного импорта. Перед записью сервер
                  валидирует обязательные поля, роли, даты, дубли и связи с модераторами.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["users", "events", "news"] as const).map((type) => (
                  <Button
                    key={type}
                    variant="secondary"
                    loading={downloadingTemplate === type}
                    onClick={() => void handleDownloadImportTemplate(type)}
                  >
                    Шаблон {type === "users" ? "пользователей" : type === "events" ? "мероприятий" : "новостей"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 text-xs text-gray-500 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white/75 p-3">Обязательные поля пользователей: email, имя, роль. Пароль нужен только для аккаунтов с парольным входом.</div>
              <div className="rounded-xl border border-slate-200 bg-white/75 p-3">Мероприятия поддерживают isPublic и requiresApproval; модераторы связываются по email.</div>
              <div className="rounded-xl border border-slate-200 bg-white/75 p-3">При ошибках импорт сохраняет историю и не скрывает строки, которые нужно исправить.</div>
            </div>
          </div>
          <div className="admin-panel p-4 space-y-2">
            <h3 className="font-semibold">Импорт пользователей</h3>
            <input type="file" accept=".csv,.json" className="w-full px-3 py-2 border rounded" onChange={(event) => setImportUsersFile(event.target.files?.[0] || null)} />
            <select className="w-full px-3 py-2 border rounded" value={importUsersMode} onChange={(event) => setImportUsersMode(event.target.value as AdminImportMode)}><option value="upsert">Обновлять</option><option value="create">Только новые</option></select>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void runImport("users", importUsersMode, importUsersFile, setImportUsersResult)}>Импорт</Button>
            {renderImportResult(importUsersResult)}
          </div>
          <div className="admin-panel p-4 space-y-2">
            <h3 className="font-semibold">Импорт мероприятий</h3>
            <input type="file" accept=".csv,.json" className="w-full px-3 py-2 border rounded" onChange={(event) => setImportEventsFile(event.target.files?.[0] || null)} />
            <select className="w-full px-3 py-2 border rounded" value={importEventsMode} onChange={(event) => setImportEventsMode(event.target.value as AdminImportMode)}><option value="upsert">Обновлять</option><option value="create">Только новые</option></select>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void runImport("events", importEventsMode, importEventsFile, setImportEventsResult)}>Импорт</Button>
            {renderImportResult(importEventsResult)}
          </div>
          <div className="admin-panel p-4 space-y-2">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">История импорта</h3>
              <p className="mt-1 text-sm text-gray-500">Последние операции с количеством строк, ошибками и предупреждениями.</p>
            </div>
            <Button variant="secondary" loading={importHistoryLoading} onClick={() => void loadImportHistory()}>
              Обновить
            </Button>
          </div>

          {importHistoryLoading && (
            <div className="grid gap-2 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          )}

          {!importHistoryLoading && importHistory.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white/75 p-4 text-sm text-gray-500">
              История импорта пока пуста.
            </div>
          )}

          {!importHistoryLoading && importHistory.length > 0 && (
            <div className="grid gap-2 lg:grid-cols-2">
              {importHistory.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900">{job.type} / {job.mode}</div>
                    <span
                      className={
                        job.status === "COMPLETED"
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : job.status === "COMPLETED_WITH_ERRORS"
                            ? "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                            : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      }
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-gray-600">
                    <span>Строк: {job.inputRows}</span>
                    <span>Создано: {job.created}</span>
                    <span>Обновлено: {job.updated}</span>
                    <span>Пропущено: {job.skipped}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(job.createdAt).toLocaleString("ru-RU")} · {job.actor || "система"}
                  </div>
                  {(job.errors.length > 0 || job.warnings.length > 0) && (
                    <details className="mt-2 text-xs text-gray-600">
                      <summary className="cursor-pointer font-semibold">Ошибки и предупреждения</summary>
                      <div className="mt-2 space-y-1">
                        {job.errors.slice(0, 6).map((error, index) => (
                          <div key={`error-${job.id}-${index}`} className="text-red-700">{error}</div>
                        ))}
                        {job.warnings.slice(0, 6).map((warning, index) => (
                          <div key={`warning-${job.id}-${index}`} className="text-amber-700">{warning}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
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

      {activeTab === "diagnostics" && (
        <div className="space-y-4">
          <div className="admin-panel p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Диагностика системы</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Проверяет базу, агрегатор метрик, сессии, уведомления и фактические счетчики без пользовательской отладки на страницах.
                </p>
              </div>
              <Button
                variant="secondary"
                loading={diagnosticsLoading}
                onClick={() => void loadDiagnostics()}
                className="w-full sm:w-auto"
              >
                Проверить заново
              </Button>
            </div>
            {diagnosticsError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {diagnosticsError}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="admin-panel p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Проверки</h3>
              <div className="mt-3 grid gap-3">
                {diagnosticsLoading &&
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={`diagnostics-skeleton-${index}`} className="rounded-xl border border-slate-200 p-3 animate-pulse">
                      <div className="h-3 w-32 rounded bg-slate-200" />
                      <div className="mt-3 h-3 w-2/3 rounded bg-slate-200" />
                    </div>
                  ))}
                {!diagnosticsLoading &&
                  diagnostics?.checks.map((check) => (
                    <div key={check.id} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-slate-900">{check.label}</div>
                        <span
                          className={
                            check.status === "ok"
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                              : check.status === "warning"
                                ? "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                                : "rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
                          }
                        >
                          {check.status === "ok" ? "OK" : check.status === "warning" ? "Внимание" : "Ошибка"}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{check.detail}</div>
                      {check.recommendation && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {check.recommendation}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-slate-400">{check.durationMs} мс</div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="admin-panel p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Сводка</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {diagnostics &&
                    [
                      ["Пользователи", diagnostics.counts.users],
                      ["Студенты", diagnostics.counts.students],
                      ["Редакторы", diagnostics.counts.editors],
                      ["Модераторы", diagnostics.counts.moderators],
                      ["Профили заполнены", diagnostics.counts.profilesComplete],
                      ["Профили неполные", diagnostics.counts.profilesIncomplete],
                      ["События", diagnostics.counts.events],
                      ["Активные", diagnostics.counts.activeEvents],
                      ["Публичные", diagnostics.counts.publicEvents],
                      ["Новости", diagnostics.counts.news],
                      ["Черновики отчетов", diagnostics.counts.draftReports],
                      ["Заявки", diagnostics.counts.participants],
                      ["Ожидают", diagnostics.counts.pendingParticipants],
                      ["Уведомления", diagnostics.counts.notifications],
                      ["Непрочитанные", diagnostics.counts.unreadNotifications],
                      ["Импорты", diagnostics.counts.importJobsTotal],
                      ["Сессии", diagnostics.counts.activeSessions],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-white/75 px-3 py-2">
                        <div className="text-xs text-slate-500">{label}</div>
                        <div className="text-xl font-semibold text-primary">{value}</div>
                      </div>
                    ))}
                </div>
              </div>

              {diagnostics?.metricsSnapshot && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm text-sky-950">
                  <div className="font-semibold">Срез метрик</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <span>Всего событий: {diagnostics.metricsSnapshot.totalEvents}</span>
                    <span>Ближайшие: {diagnostics.metricsSnapshot.upcomingEvents}</span>
                    <span>Завершенные: {diagnostics.metricsSnapshot.completedEvents}</span>
                    <span>Регистрации: {diagnostics.metricsSnapshot.registrations}</span>
                    <span>Ожидают: {diagnostics.metricsSnapshot.pendingApprovals}</span>
                    <span>Действия 7 дней: {diagnostics.metricsSnapshot.actionsLast7Days}</span>
                  </div>
                </div>
              )}

              {diagnostics && (
                <div className="rounded-xl border border-slate-200 bg-white/75 p-3 text-xs text-slate-600">
                  <div className="font-semibold text-slate-900">Интеграции</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <span>VK OAuth: {diagnostics.integrationStatus.vkOAuth}</span>
                    <span>MAX OAuth: {diagnostics.integrationStatus.maxOAuth}</span>
                    <span>Внешние сообщения: {diagnostics.integrationStatus.vkMessages}</span>
                    <span>Яндекс OAuth: {diagnostics.integrationStatus.yandexOAuth}</span>
                    <span>Email: {diagnostics.integrationStatus.email}</span>
                  </div>
                </div>
              )}

              {(diagnostics?.latestImportJobs?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white/75 p-3 text-xs text-slate-600">
                  <div className="font-semibold text-slate-900">Последние импорты</div>
                  <div className="mt-2 space-y-1">
                    {diagnostics?.latestImportJobs.slice(0, 3).map((job) => (
                      <div key={job.id}>
                        {job.type} · {job.status} · {new Date(job.createdAt).toLocaleString("ru-RU")}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diagnostics && (
                <div className="rounded-xl border border-slate-200 bg-white/75 p-3 text-xs text-slate-500">
                  <div>Среда: {diagnostics.environment}</div>
                  <div>Версия: {diagnostics.appVersion}</div>
                  <div>Uptime: {diagnostics.uptimeSeconds ?? "—"} сек.</div>
                  <div>Собрано: {new Date(diagnostics.generatedAt).toLocaleString("ru-RU")}</div>
                  <div>
                    Последний аудит:{" "}
                    {diagnostics.latestAudit
                      ? `${diagnostics.latestAudit.action} / ${diagnostics.latestAudit.entityType}`
                      : "нет записей"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="admin-panel admin-toolbar p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input className="w-full px-3 py-2 border rounded sm:w-auto" placeholder="Action" value={logAction} onChange={(event) => setLogAction(event.target.value)} />
            <input className="w-full px-3 py-2 border rounded sm:w-auto" placeholder="EntityType" value={logEntityType} onChange={(event) => setLogEntityType(event.target.value)} />
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void loadLogs()}>Найти</Button>
          </div>
          <div className="admin-panel admin-table-surface p-4 space-y-3 max-h-[700px] overflow-y-auto">
            {logsLoading &&
              Array.from({ length: 6 }).map((_, index) => (
                <div key={`logs-skeleton-${index}`} className="border border-gray-200 rounded-lg p-3 animate-pulse">
                  <div className="h-3 w-36 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-48 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-56 rounded bg-slate-200" />
                </div>
              ))}
            {!logsLoading && visibleLogs.map((log) => (
              <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString("ru-RU")}</div>
                <div className="font-medium">{log.action}</div>
                <div className="text-sm text-gray-600">{log.entityType}{log.entityId ? `: ${log.entityId}` : ""}</div>
                {log.actor && <div className="text-xs text-gray-500">Автор: {log.actor.name || log.actor.email || "—"} ({log.actor.role || "—"})</div>}
                {log.metadata && <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(log.metadata, null, 2)}</pre>}
              </div>
            ))}
            {!logsLoading && logs.length > logsVisibleCount && (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" onClick={() => setLogsVisibleCount((prev) => prev + 80)}>
                  Показать ещё ({logs.length - logsVisibleCount})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

