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

export const fetchNotificationsApi = async () => {
  const response = await fetch("/api/notifications", {
    method: "GET",
    headers: { "Cache-Control": "no-cache" },
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
  recipients: string
  type: NotificationType
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

  return response.json() as Promise<{ created: number }>
}
