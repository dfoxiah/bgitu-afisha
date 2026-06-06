/**
 * File responsibility:
 * Build profile statistics for current user.
 *
 * Main logic:
 * - Aggregate created/moderated/participation metrics
 * - Resolve active participation count by report active participants
 * - Provide timestamps for last activity cards
 *
 * Integrations:
 * - src/app/api/auth/profile/stats/route.ts
 */

import { ParticipantStatus, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type ProfileStatsUser = {
  id: string
  role: Role
  name: string | null
  email: string
  createdAt: Date
  updatedAt: Date
}

export type ProfileStatsPayload = {
  role: Role
  registeredAt: string
  lastActivityAt: string | null
  createdEventsCount: number
  createdNewsCount: number
  moderatedEventsCount: number
  participationsTotal: number
  participationsConfirmed: number
  participationsPending: number
  visitedEventsCount: number
  activeParticipationsCount: number
  confirmationRatePercent: number
}

const normalizeActiveParticipantKey = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()

const safePercent = (part: number, total: number) => {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

const maxDate = (values: Array<Date | null>) => {
  const timestamps = values
    .filter((value): value is Date => Boolean(value))
    .map((value) => value.getTime())
  if (timestamps.length === 0) return null
  return new Date(Math.max(...timestamps))
}

export const buildProfileStats = async (user: ProfileStatsUser): Promise<ProfileStatsPayload> => {
  const [
    createdEventsCount,
    createdNewsCount,
    moderatedEventsCount,
    participationsTotal,
    participationsConfirmed,
    participationsPending,
    latestParticipation,
    latestCreatedEvent,
    confirmedParticipationRows,
  ] = await Promise.all([
    prisma.event.count({
      where: {
        creatorId: user.id,
        isNews: false,
      },
    }),
    prisma.event.count({
      where: {
        creatorId: user.id,
        isNews: true,
      },
    }),
    prisma.eventModerator.count({
      where: {
        userId: user.id,
      },
    }),
    prisma.eventParticipant.count({
      where: {
        userId: user.id,
        event: { isNews: false },
      },
    }),
    prisma.eventParticipant.count({
      where: {
        userId: user.id,
        status: ParticipantStatus.CONFIRMED,
        event: { isNews: false },
      },
    }),
    prisma.eventParticipant.count({
      where: {
        userId: user.id,
        status: ParticipantStatus.PENDING,
        event: { isNews: false },
      },
    }),
    prisma.eventParticipant.findFirst({
      where: {
        userId: user.id,
        event: { isNews: false },
      },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.event.findFirst({
      where: { creatorId: user.id },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.eventParticipant.findMany({
      where: {
        userId: user.id,
        status: ParticipantStatus.CONFIRMED,
        event: { isNews: false },
      },
      select: {
        event: {
          select: {
            report: {
              select: {
                activeParticipants: true,
              },
            },
          },
        },
      },
      take: 500,
    }),
  ])

  const profileKeys = [
    normalizeActiveParticipantKey(user.name),
    normalizeActiveParticipantKey(user.email),
  ].filter(Boolean)

  const activeParticipationsCount = confirmedParticipationRows.filter((row) => {
    const activeSet = new Set(
      (row.event.report?.activeParticipants || [])
        .map((item) => normalizeActiveParticipantKey(item))
        .filter(Boolean)
    )
    return profileKeys.some((key) => activeSet.has(key))
  }).length

  const lastActivityAt = maxDate([
    user.updatedAt,
    latestParticipation?.updatedAt || null,
    latestCreatedEvent?.updatedAt || null,
  ])

  return {
    role: user.role,
    registeredAt: user.createdAt.toISOString(),
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    createdEventsCount,
    createdNewsCount,
    moderatedEventsCount,
    participationsTotal,
    participationsConfirmed,
    participationsPending,
    visitedEventsCount: participationsConfirmed,
    activeParticipationsCount,
    confirmationRatePercent: safePercent(participationsConfirmed, participationsTotal),
  }
}

