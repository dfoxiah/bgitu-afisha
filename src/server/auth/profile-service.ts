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

import type { EventCategory, Role } from "@prisma/client"
import type { UserWithTelegram } from "@/lib/prisma-user-compat"
import { isVkRecipientConfigured, normalizeVkRecipient } from "@/lib/vk"

type ProfileNotificationsInput = {
  newEvents?: boolean
  changes?: boolean
  news?: boolean
  inApp?: boolean
  email?: boolean
  vk?: boolean
  telegram?: boolean
  categories?: unknown
}

type ProfileUpdateInput = {
  name?: unknown
  image?: unknown
  department?: unknown
  group?: unknown
  admissionYear?: unknown
  bio?: unknown
  notifyNewEvents?: unknown
  notifyChanges?: unknown
  notifyNews?: unknown
  notifyInApp?: unknown
  notifyEmail?: unknown
  notifyVk?: unknown
  notifyTelegram?: unknown
  vkUserId?: unknown
  notificationCategories?: unknown
  notifications?: ProfileNotificationsInput
}

const toOptionalString = (value: unknown, trim = true) => {
  if (value === undefined) return undefined
  if (value === null) return null

  const text = String(value)
  return trim ? text.trim() : text
}

export const toProfileResponse = (user: UserWithTelegram) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  image: user.image,
  department: user.department,
  group: user.group,
  admissionYear: user.admissionYear,
  groupChangeCount: user.groupChangeCount,
  bio: user.bio,
  notifyNewEvents: user.notifyNewEvents,
  notifyChanges: user.notifyChanges,
  notifyNews: user.notifyNews,
  notificationCategories: user.notificationCategories,
  notifyInApp: user.notifyInApp,
  notifyEmail: user.notifyEmail,
  notifyVk: user.notifyVk,
  notifyTelegram: user.notifyTelegram,
  vkUserId: user.vkUserId,
  telegramChatId: user.telegramChatId,
  telegramUsername: user.telegramUsername,
  yandexEmail: user.yandexEmail,
  privacyConsentAt: user.privacyConsentAt,
  privacyConsentVersion: user.privacyConsentVersion,
  termsConsentAt: user.termsConsentAt,
  termsConsentVersion: user.termsConsentVersion,
  consentSource: user.consentSource,
  profileCompletedAt: user.profileCompletedAt,
})

const normalizeCategories = (raw: unknown, validCategories: EventCategory[]) => {
  if (!Array.isArray(raw)) return undefined

  const allowed = new Set(validCategories)
  const values = raw
    .map((value) => String(value).trim())
    .filter((value): value is EventCategory => allowed.has(value as EventCategory))

  return Array.from(new Set(values))
}

const normalizeAdmissionYear = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || String(value).trim() === "") return null

  const year = Number(value)
  const currentYear = new Date().getFullYear()
  if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1) {
    return "invalid" as const
  }

  return year
}

type BuildUpdatesParams = {
  body: ProfileUpdateInput
  user: UserWithTelegram
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

  const admissionYear = normalizeAdmissionYear(body.admissionYear)
  if (admissionYear === "invalid") {
    validationError = "Год поступления должен быть целым годом в разумном диапазоне"
  } else if (admissionYear !== undefined) {
    updates.admissionYear = admissionYear
  }

  if (body.notifyNewEvents !== undefined) updates.notifyNewEvents = Boolean(body.notifyNewEvents)
  if (body.notifyChanges !== undefined) updates.notifyChanges = Boolean(body.notifyChanges)
  if (body.notifyNews !== undefined) updates.notifyNews = Boolean(body.notifyNews)
  if (body.notifyInApp !== undefined) updates.notifyInApp = Boolean(body.notifyInApp)
  if (body.notifyEmail !== undefined) updates.notifyEmail = Boolean(body.notifyEmail)
  if (body.notifyVk !== undefined) updates.notifyVk = Boolean(body.notifyVk)
  if (body.notifyTelegram !== undefined) updates.notifyTelegram = Boolean(body.notifyTelegram)
  if (body.vkUserId !== undefined) {
    const nextVkRecipient = normalizeVkRecipient(body.vkUserId)
    if (nextVkRecipient.storageValue && !isVkRecipientConfigured(nextVkRecipient.storageValue)) {
      validationError ??=
        "Укажите корректный VK ID, @username или ссылку на профиль VK."
    } else {
      updates.vkUserId = nextVkRecipient.storageValue
    }
  }

  const directCategories = normalizeCategories(body.notificationCategories, validCategories)
  if (directCategories) updates.notificationCategories = directCategories

  if (body.notifications && typeof body.notifications === "object") {
    const notifications = body.notifications
    if (typeof notifications.newEvents === "boolean") updates.notifyNewEvents = notifications.newEvents
    if (typeof notifications.changes === "boolean") updates.notifyChanges = notifications.changes
    if (typeof notifications.news === "boolean") updates.notifyNews = notifications.news
    if (typeof notifications.inApp === "boolean") updates.notifyInApp = notifications.inApp
    if (typeof notifications.email === "boolean") updates.notifyEmail = notifications.email
    if (typeof notifications.vk === "boolean") updates.notifyVk = notifications.vk
    if (typeof notifications.telegram === "boolean") updates.notifyTelegram = notifications.telegram

    const nestedCategories = normalizeCategories(notifications.categories, validCategories)
    if (nestedCategories) updates.notificationCategories = nestedCategories
  }

  const effectiveNotifyVk =
    typeof updates.notifyVk === "boolean" ? updates.notifyVk : user.notifyVk
  const effectiveVkUserId = updates.vkUserId !== undefined ? updates.vkUserId : user.vkUserId
  if (effectiveNotifyVk && !isVkRecipientConfigured(effectiveVkUserId)) {
    validationError ??=
      "Чтобы включить VK-уведомления, укажите корректный VK ID, @username или ссылку на профиль VK."
  }

  const effectiveNotifyTelegram =
    typeof updates.notifyTelegram === "boolean" ? updates.notifyTelegram : user.notifyTelegram
  const effectiveTelegramChatId =
    updates.telegramChatId !== undefined ? updates.telegramChatId : user.telegramChatId
  if (effectiveNotifyTelegram && typeof effectiveTelegramChatId !== "string") {
    validationError ??= "Чтобы включить Telegram-уведомления, сначала привяжите Telegram в профиле."
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
