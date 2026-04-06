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
  recipients: "all" | "confirmed" | "pending"
  type?: NotificationType
  groups?: string[]
  departments?: string[]
}

export interface SendEventNotificationResultDto {
  created: number
  broadcastId: string
  eventId: string
}

export interface CancelNotificationBroadcastResultDto {
  success: true
  deleted: number
  broadcastId: string
  eventId: string
}
