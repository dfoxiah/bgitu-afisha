/**
 * File responsibility:
 * Domain-level user model used across UI and client-side state.
 *
 * Main logic:
 * - Keep runtime-friendly shape aligned with Prisma User entity
 * - Expose optional profile/notification preferences
 *
 * Integrations:
 * - src/types/index.ts
 * - client components and contexts
 */

import type { EventCategory, Role } from "@prisma/client"

export interface User {
  id: string
  name: string | null
  email: string
  emailVerified: Date | null
  image: string | null
  role: Role
  department: string | null
  group: string | null
  groupChangeCount?: number
  privacyConsentAt?: Date | null
  termsConsentAt?: Date | null
  bio?: string | null
  notifyNewEvents?: boolean
  notifyChanges?: boolean
  notifyNews?: boolean
  notificationCategories?: EventCategory[]
  createdAt: Date
  updatedAt: Date
}

