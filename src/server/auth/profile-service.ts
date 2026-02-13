/**
 * File responsibility:
 * Profile domain service for auth/profile route handlers.
 *
 * Main logic:
 * - Build safe user profile payload for API responses
 * - Validate and normalize profile update input
 *
 * Integrations:
 * - src/app/api/auth/profile/route.ts
 */

import type { EventCategory, Role, User } from "@prisma/client"

type ProfileNotificationsInput = {
  newEvents?: boolean
  changes?: boolean
  news?: boolean
  categories?: unknown
}

type ProfileUpdateInput = {
  name?: unknown
  image?: unknown
  department?: unknown
  group?: unknown
  bio?: unknown
  notifyNewEvents?: unknown
  notifyChanges?: unknown
  notifyNews?: unknown
  notificationCategories?: unknown
  notifications?: ProfileNotificationsInput
}

const toOptionalString = (value: unknown, trim = true) => {
  if (value === undefined) return undefined
  if (value === null) return null

  const text = String(value)
  return trim ? text.trim() : text
}

export const toProfileResponse = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  image: user.image,
  department: user.department,
  group: user.group,
  groupChangeCount: user.groupChangeCount,
  bio: user.bio,
  notifyNewEvents: user.notifyNewEvents,
  notifyChanges: user.notifyChanges,
  notifyNews: user.notifyNews,
  notificationCategories: user.notificationCategories,
  privacyConsentAt: user.privacyConsentAt,
  termsConsentAt: user.termsConsentAt,
})

const normalizeCategories = (raw: unknown, validCategories: EventCategory[]) => {
  if (!Array.isArray(raw)) return undefined

  const allowed = new Set(validCategories)
  const values = raw
    .map((value) => String(value).trim())
    .filter((value): value is EventCategory => allowed.has(value as EventCategory))

  return Array.from(new Set(values))
}

type BuildUpdatesParams = {
  body: ProfileUpdateInput
  user: User
  role: Role
  validCategories: EventCategory[]
}

export const buildProfileUpdates = (params: BuildUpdatesParams) => {
  const { body, user, role, validCategories } = params
  const updates: Record<string, unknown> = {}
  let validationError: string | null = null

  const assignString = (field: string, value: unknown, nullable = true) => {
    if (value === undefined) return
    const normalized = toOptionalString(value)
    if (normalized === null) {
      updates[field] = nullable ? null : ""
      return
    }
    updates[field] = normalized && normalized.length > 0 ? normalized : nullable ? null : ""
  }

  assignString("name", body.name, false)
  assignString("image", body.image)
  assignString("department", body.department)
  assignString("group", body.group)
  assignString("bio", body.bio)

  if (body.notifyNewEvents !== undefined) updates.notifyNewEvents = Boolean(body.notifyNewEvents)
  if (body.notifyChanges !== undefined) updates.notifyChanges = Boolean(body.notifyChanges)
  if (body.notifyNews !== undefined) updates.notifyNews = Boolean(body.notifyNews)

  const directCategories = normalizeCategories(body.notificationCategories, validCategories)
  if (directCategories) updates.notificationCategories = directCategories

  if (body.notifications && typeof body.notifications === "object") {
    const notifications = body.notifications
    if (typeof notifications.newEvents === "boolean") updates.notifyNewEvents = notifications.newEvents
    if (typeof notifications.changes === "boolean") updates.notifyChanges = notifications.changes
    if (typeof notifications.news === "boolean") updates.notifyNews = notifications.news

    const nestedCategories = normalizeCategories(notifications.categories, validCategories)
    if (nestedCategories) updates.notificationCategories = nestedCategories
  }

  if (updates.group !== undefined) {
    const nextGroup = updates.group as string | null
    const isGroupChanged = nextGroup !== user.group

    if (isGroupChanged && role === "STUDENT") {
      if (user.groupChangeCount >= 1) {
        validationError =
          "Группу можно изменить только один раз. Обратитесь к администрации."
      } else {
        updates.groupChangeCount = user.groupChangeCount + 1
      }
    }
  }

  return { updates, validationError }
}

