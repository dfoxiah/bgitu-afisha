/**
 * File responsibility:
 * Notification API response contracts.
 *
 * Main logic:
 * - Typed payloads for create/read/mark operations
 *
 * Integrations:
 * - app/api/notifications/*
 * - notification client hooks/components
 */

export interface NotificationCreateManyResponse {
  created: number
}

export interface NotificationMarkAllReadResponse {
  success: true
  updated: number
}

