/**
 * File responsibility:
 * Client-side notification API adapters.
 *
 * Main logic:
 * - Fetch/mark/clear notifications
 * - Send event notifications from moderator tools
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - notification UI modules
 */

import type { Notification, NotificationType } from "@/types"

const toError = async (response: Response, fallback: string) => {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return new Error(fallback)

  const payload = await response.json()
  const message =
    typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.errorPayload?.message === "string"
        ? payload.errorPayload.message
        : fallback

  return new Error(message)
}

export const normalizeNotificationFromApi = (notification: unknown): Notification => {
  const value = notification as Record<string, unknown>
  return {
    ...(value as unknown as Notification),
    createdAt: new Date(String(value.createdAt)),
  }
}

export const fetchNotificationsApi = async (limit = 120) => {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 500) : 120
  const response = await fetch(`/api/notifications?limit=${safeLimit}`, {
    method: "GET",
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка загрузки уведомлений")
  }

  const payload = (await response.json()) as unknown[]
  return payload.map(normalizeNotificationFromApi)
}

export const markNotificationAsReadApi = async (id: string) => {
  const response = await fetch(`/api/notifications/${id}`, { method: "PATCH" })
  if (!response.ok) {
    throw await toError(response, "Не удалось отметить уведомление как прочитанное")
  }
}

export const markAllNotificationsAsReadApi = async () => {
  const response = await fetch("/api/notifications", { method: "PATCH" })
  if (!response.ok) {
    throw await toError(response, "Не удалось отметить все уведомления как прочитанные")
  }
}

export const clearNotificationsApi = async () => {
  const response = await fetch("/api/notifications", { method: "DELETE" })
  if (!response.ok) {
    throw await toError(response, "Не удалось очистить уведомления")
  }
}

type SendEventNotificationPayload = {
  eventId: string
  content: string
  audience?: "participants" | "users"
  recipients: "all" | "confirmed" | "pending"
  type: NotificationType
  userIds?: string[]
  groups?: string[]
  departments?: string[]
  faculties?: string[]
}

export type SendEventNotificationResult = {
  created: number
  broadcastId: string
  eventId: string
  filters?: {
    audience?: "participants" | "users"
    groups: string[]
    departments: string[]
    userIds?: string[]
  }
}

export const sendEventNotificationApi = async (payload: SendEventNotificationPayload) => {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка отправки уведомления")
  }

  return response.json() as Promise<SendEventNotificationResult>
}

export const deleteNotificationBroadcastApi = async (broadcastId: string) => {
  const response = await fetch(`/api/notifications/broadcast/${broadcastId}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw await toError(response, "Не удалось отменить рассылку уведомлений")
  }

  return response.json() as Promise<{
    success: true
    deleted: number
    broadcastId: string
    eventId: string
  }>
}
