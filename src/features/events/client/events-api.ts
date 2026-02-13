/**
 * File responsibility:
 * Client-side event API adapter functions.
 *
 * Main logic:
 * - Call event endpoints with consistent error handling
 * - Normalize date fields from API payload to runtime Date objects
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - event-related client pages/components
 */

import type { CreateEventDto, UpdateEventDto, CompleteEventDto } from "@/types/dto"
import type { Event, User } from "@/types"

type ParticipantAction = "confirm" | "reject"

const toError = async (response: Response, fallback: string) => {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const payload = await response.json()
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.errorPayload?.message === "string"
          ? payload.errorPayload.message
          : fallback
    return new Error(message)
  }

  return new Error(fallback)
}

const normalizeReport = (report: unknown) => {
  if (!report || typeof report !== "object") return null

  const value = report as Record<string, unknown>
  return {
    ...value,
    reportDate: new Date(String(value.reportDate)),
    createdAt: new Date(String(value.createdAt)),
    updatedAt: new Date(String(value.updatedAt)),
  }
}

export const normalizeEventFromApi = (event: unknown): Event => {
  const value = event as Record<string, unknown>

  return {
    ...(value as unknown as Event),
    date: new Date(String(value.date)),
    createdAt: new Date(String(value.createdAt)),
    updatedAt: new Date(String(value.updatedAt)),
    participants: Array.isArray(value.participants) ? (value.participants as User[]) : [],
    pendingParticipants: Array.isArray(value.pendingParticipants)
      ? (value.pendingParticipants as User[])
      : [],
    moderators: Array.isArray(value.moderators) ? (value.moderators as User[]) : [],
    report: normalizeReport(value.report) as Event["report"],
  }
}

export const fetchEventsApi = async (authenticated: boolean) => {
  const query = new URLSearchParams()
  if (!authenticated) query.set("upcoming", "true")
  query.set("limit", "100")

  const response = await fetch(`/api/events?${query.toString()}`, {
    credentials: "include",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка загрузки мероприятий")
  }

  const payload = (await response.json()) as unknown[]
  return payload.map(normalizeEventFromApi)
}

export const createEventApi = async (payload: CreateEventDto) => {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка создания мероприятия")
  }

  const event = await response.json()
  return normalizeEventFromApi(event)
}

export const updateEventApi = async (id: string, payload: UpdateEventDto) => {
  const response = await fetch(`/api/events/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка обновления мероприятия")
  }

  const event = await response.json()
  return normalizeEventFromApi(event)
}

export const completeEventApi = async (id: string, payload: CompleteEventDto) => {
  const response = await fetch(`/api/events/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка завершения мероприятия")
  }

  const event = await response.json()
  return normalizeEventFromApi(event)
}

export const registerForEventApi = async (eventId: string) => {
  const response = await fetch(`/api/events/${eventId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка регистрации")
  }

  return response.json() as Promise<{ success: true; status: string; message: string }>
}

export const moderateParticipantApi = async (
  eventId: string,
  userId: string,
  action: ParticipantAction
) => {
  const response = await fetch(`/api/events/${eventId}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, action }),
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка обновления участника")
  }

  return response.json() as Promise<{ currentParticipants?: number }>
}
