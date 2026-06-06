/**
 * File responsibility:
 * Shared role labels and permission predicates.
 *
 * Main logic:
 * - Keep human-readable labels in one place
 * - Define content-management roles used by events, news and notifications
 *
 * Integrations:
 * - UI role selectors
 * - API route permission checks
 */

import type { Role } from "@prisma/client"

export const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "STUDENT" as Role, label: "Студент" },
  { value: "TEACHER" as Role, label: "Преподаватель" },
  { value: "MODERATOR" as Role, label: "Модератор" },
  { value: "EDITOR" as Role, label: "Редактор" },
  { value: "ADMIN" as Role, label: "Администратор" },
]

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Студент",
  TEACHER: "Преподаватель",
  MODERATOR: "Модератор",
  EDITOR: "Редактор",
  ADMIN: "Администратор",
}

export const ROLE_VALUES = ROLE_OPTIONS.map((option) => option.value)

export const isRoleValue = (value: string): value is Role =>
  ROLE_VALUES.includes(value as Role)

export const toRoleLabel = (role?: Role | string | null) => {
  if (!role) return "Пользователь"
  return ROLE_LABELS[role as Role] || role
}

export const isAdminRole = (role?: Role | string | null) => role === "ADMIN"

export const isContentManagerRole = (role?: Role | string | null) =>
  role === "TEACHER" || role === "MODERATOR" || role === "EDITOR" || role === "ADMIN"

export const isModeratorRole = isContentManagerRole
