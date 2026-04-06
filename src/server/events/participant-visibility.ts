/**
 * File responsibility:
 * Event participant visibility shaping for API responses.
 *
 * Main logic:
 * - Enforce role-based participant list visibility
 * - Keep per-viewer participation status and counters available
 *
 * Integrations:
 * - src/app/api/events/route.ts
 * - src/app/api/events/[id]/route.ts
 */

import { ParticipantStatus } from "@prisma/client"

type EventWithParticipantPayload = Record<string, unknown> & {
  participants?: Array<{ id?: string }>
  pendingParticipants?: Array<{ id?: string }>
  currentParticipants?: number
  confirmedParticipantsCount?: number
  pendingParticipantsCount?: number
}

type ViewerContext = { id?: string | null; role?: string | null } | null | undefined

export const canViewerSeeParticipants = (role?: string | null) =>
  role === "TEACHER" || role === "ADMIN"

export const applyParticipantVisibility = (event: EventWithParticipantPayload, viewer: ViewerContext) => {
  const confirmed = Array.isArray(event.participants) ? event.participants : []
  const pending = Array.isArray(event.pendingParticipants) ? event.pendingParticipants : []
  const viewerId = viewer?.id || null

  const viewerParticipationStatus =
    viewerId && confirmed.some((participant) => participant?.id === viewerId)
      ? ParticipantStatus.CONFIRMED
      : viewerId && pending.some((participant) => participant?.id === viewerId)
        ? ParticipantStatus.PENDING
        : null

  const confirmedParticipantsCount =
    typeof event.currentParticipants === "number"
      ? event.currentParticipants
      : typeof event.confirmedParticipantsCount === "number"
        ? event.confirmedParticipantsCount
        : confirmed.length

  const pendingParticipantsCount =
    typeof event.pendingParticipantsCount === "number"
      ? event.pendingParticipantsCount
      : pending.length

  if (canViewerSeeParticipants(viewer?.role)) {
    return {
      ...event,
      canViewParticipants: true,
      viewerParticipationStatus,
      confirmedParticipantsCount,
      pendingParticipantsCount,
    }
  }

  return {
    ...event,
    participants: [],
    pendingParticipants: [],
    canViewParticipants: false,
    viewerParticipationStatus,
    confirmedParticipantsCount,
    pendingParticipantsCount,
  }
}

