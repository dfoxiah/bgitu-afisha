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
import { isContentManagerRole } from "@/lib/roles"

type EventWithParticipantPayload = Record<string, unknown> & {
  participants?: Array<{ id?: string }>
  pendingParticipants?: Array<{ id?: string }>
  currentParticipants?: number
  confirmedParticipantsCount?: number
  pendingParticipantsCount?: number
}

type ViewerContext = { id?: string | null; role?: string | null } | null | undefined

export const canViewerSeeParticipants = (role?: string | null) =>
  isContentManagerRole(role)

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

const scrubPublicUser = (user: unknown) => {
  if (!user || typeof user !== "object") return user

  const value = user as Record<string, unknown>
  return {
    id: value.id,
    name: value.name,
    role: value.role,
    department: value.department,
    group: value.group,
    image: value.image,
    email: "",
  }
}

const isPublishedReport = (report: unknown) => {
  if (!report || typeof report !== "object") return false
  const status = (report as Record<string, unknown>).status
  return status === "PUBLISHED"
}

export const applyPublicEventVisibility = (event: EventWithParticipantPayload) => ({
  ...event,
  participants: [],
  pendingParticipants: [],
  moderators: Array.isArray(event.moderators)
    ? event.moderators.map((moderator) => scrubPublicUser(moderator))
    : [],
  creator: scrubPublicUser(event.creator),
  report: isPublishedReport(event.report) ? event.report : null,
  canViewParticipants: false,
  viewerParticipationStatus: null,
  pendingParticipantsCount: 0,
})
