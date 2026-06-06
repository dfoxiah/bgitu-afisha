/**
 * File responsibility:
 * Role/permission helper functions for UI and API checks.
 *
 * Main logic:
 * - Evaluate role-based access for actions and pages.
 * - Provide reusable authorization predicates.
 *
 * Integrations:
 * - next-auth session role data
 * - UI guards and route handlers
 */
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminRole, isContentManagerRole } from '@/lib/roles'

export type Permission =
  | "users.view"
  | "users.edit"
  | "profiles.view"
  | "profiles.edit"
  | "events.view"
  | "events.create"
  | "events.edit"
  | "events.delete"
  | "events.manageParticipants"
  | "events.complete"
  | "reports.view"
  | "reports.edit"
  | "reports.publish"
  | "news.view"
  | "news.create"
  | "news.edit"
  | "news.publish"
  | "imports.run"
  | "exports.run"
  | "stats.view"
  | "diagnostics.view"
  | "roles.manage"
  | "notifications.manageTemplates"

const rolePermissions: Record<Role, Permission[]> = {
  STUDENT: ["events.view", "profiles.edit", "news.view"],
  TEACHER: [
    "profiles.view",
    "events.view",
    "events.create",
    "events.edit",
    "events.manageParticipants",
    "events.complete",
    "reports.view",
    "reports.edit",
    "news.view",
    "news.create",
    "exports.run",
    "stats.view",
  ],
  MODERATOR: [
    "profiles.view",
    "events.view",
    "events.manageParticipants",
    "events.complete",
    "reports.view",
    "reports.edit",
    "news.view",
  ],
  EDITOR: [
    "profiles.view",
    "events.view",
    "events.create",
    "events.edit",
    "events.manageParticipants",
    "events.complete",
    "reports.view",
    "reports.edit",
    "reports.publish",
    "news.view",
    "news.create",
    "news.edit",
    "news.publish",
    "exports.run",
    "stats.view",
    "notifications.manageTemplates",
  ],
  ADMIN: [
    "users.view",
    "users.edit",
    "profiles.view",
    "profiles.edit",
    "events.view",
    "events.create",
    "events.edit",
    "events.delete",
    "events.manageParticipants",
    "events.complete",
    "reports.view",
    "reports.edit",
    "reports.publish",
    "news.view",
    "news.create",
    "news.edit",
    "news.publish",
    "imports.run",
    "exports.run",
    "stats.view",
    "diagnostics.view",
    "roles.manage",
    "notifications.manageTemplates",
  ],
}

export const getRolePermissions = (role?: Role | string | null): Permission[] =>
  role && role in rolePermissions ? rolePermissions[role as Role] : ["events.view", "news.view"]

export const hasPermission = (role: Role | string | null | undefined, permission: Permission) =>
  getRolePermissions(role).includes(permission)

export async function getEventPermissions(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      creatorId: true,
      moderators: {
        where: { userId },
        select: { userId: true }
      }
    }
  })

  if (!event) {
    return { exists: false, isOwner: false, isModerator: false }
  }

  const isOwner = event.creatorId === userId
  const isModerator = event.moderators.length > 0
  return { exists: true, isOwner, isModerator }
}

export async function canModerateEvent(eventId: string, userId: string, role: Role) {
  if (isAdminRole(role)) return true
  if (!isContentManagerRole(role)) return false
  const { exists, isOwner, isModerator } = await getEventPermissions(eventId, userId)
  if (!exists) return false
  return isOwner || isModerator
}
