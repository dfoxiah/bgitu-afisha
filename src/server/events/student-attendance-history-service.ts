/**
 * File responsibility:
 * Build privacy-aware attendance history for student/teacher profiles.
 *
 * Main logic:
 * - Enforce access scope (self/admin/teacher-context)
 * - Return compact event history + summary metrics
 * - Write audit records for every history view
 *
 * Integrations:
 * - src/app/users/[id]/page.tsx
 * - Prisma Event/EventParticipant/EventReport models
 */

import { ParticipantStatus, Role, type EventCategory } from "@prisma/client"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { isContentManagerRole } from "@/lib/roles"

const TEACHER_HISTORY_DAYS = 180
const FULL_HISTORY_DAYS = 365
const MAX_HISTORY_ROWS = 200

type Viewer = {
  id: string
  role: Role
}

type UserIdentity = {
  id: string
  role: Role
  name: string | null
  email: string
}

type HistoryMode = "SELF_FULL" | "ADMIN_FULL" | "TEACHER_CONTEXT"

export type UserAttendanceHistoryItem = {
  eventId: string
  title: string
  category: EventCategory
  date: Date
  time: string
  status: ParticipantStatus
  isActive: boolean
}

export type UserAttendanceHistory = {
  mode: HistoryMode
  period: {
    from: Date
    to: Date
    days: number
  }
  summary: {
    total: number
    confirmed: number
    pending: number
    active: number
    confirmationRatePercent: number
    activityRatePercent: number
  }
  items: UserAttendanceHistoryItem[]
}

const normalizeParticipantKey = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()

const safePercent = (part: number, total: number) => {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

const resolveMode = async (viewer: Viewer, user: UserIdentity): Promise<HistoryMode | null> => {
  if (viewer.id === user.id) return "SELF_FULL"
  if (viewer.role === Role.ADMIN) return "ADMIN_FULL"

  if (!isContentManagerRole(viewer.role) || user.role !== Role.STUDENT) {
    return null
  }

  const relationCount = await prisma.eventParticipant.count({
    where: {
      userId: user.id,
      event: {
        OR: [{ creatorId: viewer.id }, { moderators: { some: { userId: viewer.id } } }],
      },
    },
  })

  if (relationCount === 0) return null
  return "TEACHER_CONTEXT"
}

export async function getUserAttendanceHistoryForViewer(params: {
  viewer: Viewer
  user: UserIdentity
}): Promise<UserAttendanceHistory | null> {
  const mode = await resolveMode(params.viewer, params.user)
  if (!mode) return null

  const days = mode === "TEACHER_CONTEXT" ? TEACHER_HISTORY_DAYS : FULL_HISTORY_DAYS
  const periodTo = new Date()
  const periodFrom = new Date(periodTo)
  periodFrom.setDate(periodTo.getDate() - days)

  const eventScope =
    mode === "TEACHER_CONTEXT"
      ? {
          OR: [{ creatorId: params.viewer.id }, { moderators: { some: { userId: params.viewer.id } } }],
        }
      : {}

  const rows = await prisma.eventParticipant.findMany({
    where: {
      userId: params.user.id,
      event: {
        isNews: false,
        date: { gte: periodFrom, lte: periodTo },
        ...eventScope,
      },
    },
    select: {
      status: true,
      event: {
        select: {
          id: true,
          title: true,
          category: true,
          date: true,
          time: true,
          report: { select: { activeParticipants: true } },
        },
      },
    },
    orderBy: [{ event: { date: "desc" } }, { event: { time: "desc" } }],
    take: MAX_HISTORY_ROWS,
  })

  const participantKeys = [normalizeParticipantKey(params.user.name), normalizeParticipantKey(params.user.email)].filter(Boolean)

  const items: UserAttendanceHistoryItem[] = rows.map((row) => {
    const activeSet = new Set(
      (row.event.report?.activeParticipants || [])
        .map((item) => normalizeParticipantKey(item))
        .filter(Boolean)
    )
    const isConfirmed = row.status === ParticipantStatus.CONFIRMED
    const isActive = isConfirmed && participantKeys.some((key) => activeSet.has(key))

    return {
      eventId: row.event.id,
      title: row.event.title,
      category: row.event.category,
      date: row.event.date,
      time: row.event.time,
      status: row.status,
      isActive,
    }
  })

  const confirmed = items.filter((item) => item.status === ParticipantStatus.CONFIRMED).length
  const pending = items.filter((item) => item.status === ParticipantStatus.PENDING).length
  const active = items.filter((item) => item.isActive).length

  const { ip, userAgent } = buildAuditMeta()
  await logAuditEvent({
    actorId: params.viewer.id,
    action: "USER_ATTENDANCE_HISTORY_VIEW",
    entityType: "User",
    entityId: params.user.id,
    metadata: {
      mode,
      periodDays: days,
      total: items.length,
      confirmed,
      active,
    },
    ip,
    userAgent,
  })

  return {
    mode,
    period: {
      from: periodFrom,
      to: periodTo,
      days,
    },
    summary: {
      total: items.length,
      confirmed,
      pending,
      active,
      confirmationRatePercent: safePercent(confirmed, items.length),
      activityRatePercent: safePercent(active, confirmed),
    },
    items,
  }
}

export async function getStudentAttendanceHistoryForViewer(params: {
  viewer: Viewer
  student: UserIdentity
}): Promise<UserAttendanceHistory | null> {
  return getUserAttendanceHistoryForViewer({
    viewer: params.viewer,
    user: params.student,
  })
}
