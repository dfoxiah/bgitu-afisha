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
  hasSessionUser(session) && session.user.role === "ADMIN"

export const isTeacherOrAdminRole = (role?: Role | string | null) =>
  role === "TEACHER" || role === "ADMIN"

export const canModerateEventByRole = (params: {
  role?: Role | string | null
  userId?: string | null
  creatorId: string
  moderatorIds: string[]
}) => {
  const { role, userId, creatorId, moderatorIds } = params
  if (!userId) return false
  if (role === "ADMIN") return true
  if (role !== "TEACHER") return false
  return creatorId === userId || moderatorIds.includes(userId)
}

