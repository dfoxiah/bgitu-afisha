/**
 * File responsibility:
 * Domain-level notification model shared by UI and state.
 *
 * Main logic:
 * - Keep notification payload close to API response
 * - Preserve optional metadata bag for context links (eventId, etc.)
 *
 * Integrations:
 * - src/types/index.ts
 * - notifications UI/context
 */

import type { NotificationType } from "@prisma/client"

export interface Notification {
  id: string
  userId: string
  title: string
  content: string
  type: NotificationType
  read: boolean
  metadata?: Record<string, unknown>
  createdAt: Date
}

