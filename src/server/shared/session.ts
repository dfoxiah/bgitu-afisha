/**
 * File responsibility:
 * Session/user role guards shared by API route handlers.
 *
 * Main logic:
 * - Detect admin/teacher permissions from a session-like object
 * - Reusable moderation checks by owner/moderator/admin rules
 *
 * Integrations:
 * - app/api/admin/*
 * - app/api/events/*
 */

import { Role } from "@prisma/client"
import { isAdminRole, isContentManagerRole } from "@/lib/roles"
import { hasPermission, type Permission } from "@/lib/permissions"

export type SessionLike = {
  user?: {
    id?: string | null
    role?: Role | string | null
    email?: string | null
    name?: string | null
  } | null
} | null | undefined

export const hasSessionUser = (session: SessionLike): session is { user: { id: string; role?: Role | string | null } } =>
  Boolean(session?.user?.id)

export const isAdminSession = (session: SessionLike) =>
  hasSessionUser(session) && isAdminRole(session.user.role)

export const isTeacherOrAdminRole = (role?: Role | string | null) =>
  isContentManagerRole(role)

export const canModerateEventByRole = (params: {
  role?: Role | string | null
  userId?: string | null
  creatorId: string
  moderatorIds: string[]
  permission?: Permission
}) => {
  const { role, userId, creatorId, moderatorIds, permission = "events.edit" } = params
  if (!userId) return false
  if (isAdminRole(role)) return true
  if (!isContentManagerRole(role) || !hasPermission(role, permission)) return false
  return creatorId === userId || moderatorIds.includes(userId)
}
