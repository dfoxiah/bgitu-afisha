/**
 * File responsibility:
 * Notification DTO contracts for API interactions.
 *
 * Main logic:
 * - Define payloads used by notification sending endpoints
 *
 * Integrations:
 * - app/api/notifications/*
 * - client notification modal
 */

import type { NotificationType } from "@prisma/client"

export interface SendEventNotificationDto {
  eventId: string
  content: string
  audience?: "participants" | "users"
  recipients: "all" | "confirmed" | "pending"
  type?: NotificationType
  userIds?: string[]
  groups?: string[]
  departments?: string[]
  faculties?: string[]
}

export interface SendEventNotificationResultDto {
  created: number
  inAppCreated: number
  externalAttempted: number
  externalFailed: number
  broadcastId: string
  eventId: string
  filters?: {
    groups: string[]
    departments: string[]
    userIds?: string[]
  }
}

export interface CancelNotificationBroadcastResultDto {
  success: true
  deleted: number
  broadcastId: string
  eventId: string
}
