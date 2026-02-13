/**
 * File responsibility:
 * Reusable event serialization utilities for API responses.
 *
 * Main logic:
 * - Convert Date fields to ISO strings
 * - Flatten moderators relation to plain user list
 * - Split participants by status into confirmed/pending arrays
 *
 * Integrations:
 * - app/api/events/*
 * - app/api/admin/events/*
 */

import { ParticipantStatus } from "@prisma/client"
import { splitParticipants } from "@/server/shared/participants"

type EventReportLike = {
  reportDate: Date | string
  createdAt: Date | string
  updatedAt: Date | string
  [key: string]: unknown
}

type ParticipantUserRow<TUser> = {
  status: ParticipantStatus
  user: TUser
}

type ModeratorUserRow<TModerator> = {
  user: TModerator
}

const toIsoString = (value: Date | string) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  return value
}

export const serializeReport = (report: EventReportLike | null | undefined) =>
  report
    ? {
        ...report,
        reportDate: toIsoString(report.reportDate),
        createdAt: toIsoString(report.createdAt),
        updatedAt: toIsoString(report.updatedAt),
      }
    : null

export const flattenModerators = <TModerator>(
  moderators: Array<ModeratorUserRow<TModerator>> | null | undefined
) => moderators?.map((item) => item.user) || []

export const splitEventParticipants = <TUser>(rows: Array<ParticipantUserRow<TUser>>) =>
  splitParticipants(rows)
