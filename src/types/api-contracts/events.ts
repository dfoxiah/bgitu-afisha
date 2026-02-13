/**
 * File responsibility:
 * Event API response contracts.
 *
 * Main logic:
 * - Typed response wrappers for common event handlers
 *
 * Integrations:
 * - app/api/events/*
 * - smoke tests and client adapters
 */

import type { ParticipantStatus } from "@prisma/client"

export interface EventRegistrationResponse {
  success: true
  status: ParticipantStatus
  message: string
}

export interface ParticipantModerationResponse {
  success: true
  userId: string
  eventId: string
  prevStatus: ParticipantStatus
  nextStatus: ParticipantStatus | "REMOVED"
  currentParticipants: number
}

