/**
 * File responsibility:
 * Shared participant helpers for event-related APIs and services.
 *
 * Main logic:
 * - Split a mixed participant list by status (CONFIRMED / PENDING)
 *
 * Integrations:
 * - Event serialization in route handlers and domain services
 */

import { ParticipantStatus } from "@prisma/client"

type ParticipantRow<TUser> = {
  status: ParticipantStatus
  user: TUser
}

export const splitParticipants = <TUser>(
  rows: Array<ParticipantRow<TUser>> = []
) => {
  const confirmed = rows
    .filter((row) => row.status === ParticipantStatus.CONFIRMED)
    .map((row) => row.user)

  const pending = rows
    .filter((row) => row.status === ParticipantStatus.PENDING)
    .map((row) => row.user)

  return { confirmed, pending }
}

