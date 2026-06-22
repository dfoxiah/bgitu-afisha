/**
 * File responsibility:
 * Client API adapter for admin panel workflows.
 *
 * Main logic:
 * - Wrap fetch requests for users/events/news/import/logs endpoints
 * - Normalize API error messages for UI feedback
 *
 * Integrations:
 * - src/app/admin/page.tsx
 */

"use client"

import type { EventCategory, Role } from "@prisma/client"
import type {
  AdminDashboardMetrics,
  AdminAuditLog,
  AdminDiagnostics,
  AdminEvent,
  AdminEventDetails,
  AdminEventUpdateInput,
  AdminImportMode,
  AdminImportJob,
  AdminImportResult,
  AdminGroupPromotionResult,
  AdminNewsCreateInput,
  AdminNewsDraftResult,
  AdminNewsTemplate,
  AdminNewsTemplateInput,
  AdminSimulationResponse,
  AdminSimulationScenarioId,
  AdminStructureSnapshot,
  AdminStructureUpdateInput,
  AdminStructureUpdateResult,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from "@/features/admin/types"

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown
}

const parseErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      error?: string
      message?: string
      errorPayload?: { message?: string }
    }
    return payload.errorPayload?.message || payload.error || payload.message || "Ошибка запроса"
  } catch {
    return "Ошибка запроса"
  }
}

const request = async <T>(url: string, options: FetchOptions = {}): Promise<T> => {
  const headers = new Headers(options.headers || {})
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as T
}

export type AdminUsersQuery = {
  search?: string
  role?: "ALL" | Role
  limit?: number
}

export const getAdminUsers = (query: AdminUsersQuery = {}) => {
  const params = new URLSearchParams()
  if (query.search) params.set("search", query.search)
  if (query.role && query.role !== "ALL") params.set("role", query.role)
  params.set("limit", String(query.limit || 100))
  return request<AdminUser[]>(`/api/admin/users?${params.toString()}`)
}

export const createAdminUser = (payload: AdminUserCreateInput) =>
  request<AdminUser>("/api/admin/users", { method: "POST", body: payload })

export const updateAdminUser = (id: string, payload: AdminUserUpdateInput) =>
  request<AdminUser>(`/api/admin/users/${id}`, { method: "PUT", body: payload })

export const deleteAdminUser = (id: string) =>
  request<{ success: true }>(`/api/admin/users/${id}`, { method: "DELETE" })

export const getAdminStructure = () =>
  request<AdminStructureSnapshot>("/api/admin/structure")

export const updateAdminStructure = (payload: AdminStructureUpdateInput) =>
  request<AdminStructureUpdateResult>("/api/admin/structure", { method: "PUT", body: payload })

export const promoteAdminGroupsAfterSummer = (dryRun = false) =>
  request<AdminGroupPromotionResult>("/api/admin/structure", {
    method: "POST",
    body: { dryRun },
  })

export type AdminEventsQuery = {
  search?: string
  category?: EventCategory | "ALL"
  status?: "ALL" | "UPCOMING" | "PAST"
  newsOnly?: boolean
  limit?: number
}

export const getAdminEvents = (query: AdminEventsQuery = {}) => {
  const params = new URLSearchParams()
  if (query.search) params.set("search", query.search)
  if (query.category && query.category !== "ALL") params.set("category", query.category)
  if (query.status === "UPCOMING") params.set("upcoming", "true")
  if (query.status === "PAST") params.set("past", "true")
  if (query.newsOnly) params.set("news", "true")
  params.set("limit", String(query.limit || 100))
  return request<AdminEvent[]>(`/api/admin/events?${params.toString()}`)
}

export const getAdminEventDetails = (id: string) =>
  request<AdminEventDetails>(`/api/admin/events/${id}`)

export const updateAdminEvent = (id: string, payload: AdminEventUpdateInput) =>
  request<AdminEventDetails>(`/api/admin/events/${id}`, { method: "PUT", body: payload })

export const deleteAdminEvent = (id: string) =>
  request<{ success: true }>(`/api/admin/events/${id}`, { method: "DELETE" })

export const createAdminNews = (payload: AdminNewsCreateInput) =>
  request<AdminEvent>("/api/admin/events", {
    method: "POST",
    body: {
      title: payload.title,
      content: payload.content,
      date: payload.date,
      images: payload.images,
      tasks: payload.tasks || [],
      reportComment: payload.reportComment || "",
      createReport: payload.createReport ?? Boolean((payload.tasks || []).length || payload.reportComment),
    },
  })

export const getAdminNewsTemplates = () =>
  request<AdminNewsTemplate[]>("/api/news-templates")

export const createAdminNewsTemplate = (payload: AdminNewsTemplateInput) =>
  request<AdminNewsTemplate>("/api/news-templates", { method: "POST", body: payload })

export const updateAdminNewsTemplate = (id: string, payload: AdminNewsTemplateInput) =>
  request<AdminNewsTemplate>(`/api/news-templates/${id}`, { method: "PUT", body: payload })

export const deleteAdminNewsTemplate = (id: string) =>
  request<{ success: true }>(`/api/news-templates/${id}`, { method: "DELETE" })

export const generateAdminNewsDraft = (templateId: string, eventId: string, title?: string) =>
  request<AdminNewsDraftResult>(`/api/news-templates/${templateId}/generate`, {
    method: "POST",
    body: { eventId, title },
  })

export type AdminLogsQuery = {
  action?: string
  entityType?: string
  limit?: number
}

export const getAdminLogs = (query: AdminLogsQuery = {}) => {
  const params = new URLSearchParams()
  if (query.action) params.set("action", query.action)
  if (query.entityType) params.set("entityType", query.entityType)
  params.set("limit", String(query.limit || 100))
  return request<AdminAuditLog[]>(`/api/admin/logs?${params.toString()}`)
}

export type AdminMetricsQuery = {
  from?: string
  to?: string
}

export const getAdminMetrics = (query: AdminMetricsQuery = {}) => {
  const params = new URLSearchParams()
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  const suffix = params.toString()
  return request<AdminDashboardMetrics>(`/api/admin/metrics${suffix ? `?${suffix}` : ""}`)
}

export const getAdminDiagnostics = () =>
  request<AdminDiagnostics>("/api/admin/diagnostics")

export const runAdminDiagnosticsSimulation = (
  scenario: AdminSimulationScenarioId | "all" = "all"
) =>
  request<AdminSimulationResponse>("/api/admin/diagnostics/simulate", {
    method: "POST",
    body: { scenario },
  })

const extractFileName = (response: Response, fallback: string) => {
  const contentDisposition = response.headers.get("content-disposition") || ""
  const match =
    contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
    contentDisposition.match(/filename=\"?([^\";]+)\"?/i)
  if (!match?.[1]) return fallback
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export const downloadAdminEventExcel = async (eventId: string) => {
  const response = await fetch(`/api/admin/events/${eventId}/export`, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  const fileName = extractFileName(response, `event_attendance_${eventId}.xlsx`)
  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export const getAdminImportHistory = () =>
  request<AdminImportJob[]>("/api/admin/import")

export const downloadAdminImportTemplate = async (type: "users" | "events" | "news") => {
  const response = await fetch(`/api/admin/import?template=${type}`, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  const fileName = extractFileName(response, `bgitu_${type}_import_template.csv`)
  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export const importAdminData = async (
  type: "users" | "events" | "news",
  mode: AdminImportMode,
  file: File
) => {
  const text = await file.text()
  const isJson = file.name.toLowerCase().endsWith(".json")
  const response = await fetch(`/api/admin/import?type=${type}&mode=${mode}`, {
    method: "POST",
    headers: {
      "Content-Type": isJson ? "application/json" : "text/csv; charset=utf-8",
    },
    body: text,
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as AdminImportResult
}
