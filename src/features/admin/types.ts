/**
 * File responsibility:
 * Shared admin panel client-side types.
 *
 * Main logic:
 * - Define DTO-like shapes used by admin API adapters and page UI
 * - Keep admin feature type contracts centralized
 *
 * Integrations:
 * - src/features/admin/client/admin-api.ts
 * - src/app/admin/page.tsx
 */

import type { Role, EventCategory } from "@prisma/client"

export type AdminUser = {
  id: string
  name: string | null
  email: string
  role: Role
  department: string | null
  group: string | null
  groupChangeCount: number
  bio: string | null
  privacyConsentAt?: string | null
  termsConsentAt?: string | null
  createdAt: string
  updatedAt?: string
}

export type AdminUserCreateInput = {
  name: string
  email: string
  password: string
  role: Role
  department?: string
  group?: string
}

export type AdminUserUpdateInput = {
  name?: string
  email?: string
  password?: string
  role?: Role
  department?: string | null
  group?: string | null
  groupChangeCount?: number
  bio?: string | null
}

export type AdminEventModerator = {
  id: string
  name: string | null
  email: string
}

export type AdminEvent = {
  id: string
  title: string
  category: EventCategory
  date: string
  time: string
  duration?: string
  location: string
  description?: string
  maxParticipants: number
  currentParticipants?: number
  isPast: boolean
  isNews?: boolean
  removedFromCalendar?: boolean
  images?: string[]
  responsible?: string
  contact?: string
  creator: { id: string; name: string | null; email: string }
  moderators: AdminEventModerator[]
}

export type AdminEventReport = {
  id?: string
  summary: string
  reportDate: string
  images: string[]
  tasks?: string[]
  comment?: string | null
}

export type AdminEventDetails = AdminEvent & {
  participants?: Array<{
    id: string
    name: string | null
    email: string
    role: Role
  }>
  pendingParticipants?: Array<{
    id: string
    name: string | null
    email: string
    role: Role
  }>
  report?: AdminEventReport | null
}

export type AdminEventUpdateInput = {
  title?: string
  category?: EventCategory
  date?: string
  time?: string
  duration?: string
  location?: string
  description?: string
  maxParticipants?: number
  isNews?: boolean
  removedFromCalendar?: boolean
  images?: string[]
  responsible?: string
  contact?: string
  moderators?: string[]
  report?: {
    summary?: string
    reportDate?: string
    images?: string[]
    tasks?: string[]
    comment?: string | null
  }
}

export type AdminNewsCreateInput = {
  title: string
  content: string
  date: string
  images: string[]
  tasks?: string[]
  reportComment?: string
  createReport?: boolean
}

export type AdminAuditLog = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: string
  actor?: {
    id: string
    name: string | null
    email: string | null
    role?: string | null
  } | null
  metadata?: Record<string, unknown> | null
}

export type AdminImportMode = "upsert" | "create"

export type AdminImportResult = {
  created: number
  updated: number
  skipped: number
  errors: string[]
  warnings: string[]
}

