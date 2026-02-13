/**
 * File responsibility:
 * Domain-level admin import workflows for users/events/news.
 *
 * Main logic:
 * - Validate and upsert users from normalized rows
 * - Validate and upsert events/news with moderator/creator relations
 * - Return deterministic import statistics for UI and audit
 *
 * Integrations:
 * - src/app/api/admin/import/route.ts
 * - src/server/admin/import-parser.ts
 */

import bcrypt from "bcryptjs"
import { EventCategory, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  normalizeCategory,
  normalizeRole,
  parseBooleanValue,
  parseImportDateTime,
  parseOptionalDate,
  splitList,
  type ImportRow,
} from "@/server/admin/import-parser"

export type ImportType = "users" | "events" | "news"
export type ImportMode = "upsert" | "create"

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: string[]
  warnings: string[]
}

type ImportActor = {
  id: string
  name: string | null
  email: string | null
}

type UserLookup = {
  id: string
  email: string
  role: Role
  name: string | null
}

const emptyImportResult = (): ImportResult => ({
  created: 0,
  updated: 0,
  skipped: 0,
  errors: [],
  warnings: [],
})

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const resolveCreatorFromRow = async (
  row: ImportRow,
  actor: ImportActor,
  usersByEmail: Map<string, UserLookup>,
  creatorByIdCache: Map<string, UserLookup | null>
) => {
  const creatorEmail = String(row.creatorEmail || "").trim().toLowerCase()
  const creatorId = String(row.creatorId || "").trim()

  let resolvedId = actor.id
  let resolvedName = actor.name || ""
  let resolvedEmail = actor.email || ""
  let warning: string | null = null

  if (creatorId) {
    let creator = creatorByIdCache.get(creatorId)
    if (creator === undefined) {
      const byId = await prisma.user.findUnique({
        where: { id: creatorId },
        select: { id: true, email: true, role: true, name: true },
      })
      creator = byId
      creatorByIdCache.set(creatorId, creator || null)
    }

    if (creator) {
      resolvedId = creator.id
      resolvedName = creator.name || ""
      resolvedEmail = creator.email
    } else {
      warning = `создатель по id не найден (${creatorId}), использован текущий администратор`
    }
  } else if (creatorEmail) {
    const creator = usersByEmail.get(creatorEmail)
    if (creator) {
      resolvedId = creator.id
      resolvedName = creator.name || ""
      resolvedEmail = creator.email
    } else {
      warning = `создатель по email не найден (${creatorEmail}), использован текущий администратор`
    }
  }

  return { id: resolvedId, name: resolvedName, email: resolvedEmail, warning }
}

export const importUsersRows = async (rows: ImportRow[], mode: ImportMode): Promise<ImportResult> => {
  const result = emptyImportResult()

  const emails = Array.from(
    new Set(rows.map((row) => String(row.email || "").trim().toLowerCase()).filter(Boolean))
  )

  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })
  const existingByEmail = new Map(existing.map((user) => [user.email, user]))

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2

    const email = String(row.email || "").trim().toLowerCase()
    if (!email) {
      result.errors.push(`строка ${rowNumber}: отсутствует email`)
      continue
    }
    if (!isValidEmail(email)) {
      result.errors.push(`строка ${rowNumber}: некорректный email (${email})`)
      continue
    }

    const role = normalizeRole(row.role)
    if (row.role && !role) {
      result.errors.push(`строка ${rowNumber}: некорректная роль (${row.role})`)
      continue
    }

    const privacyParsed = parseOptionalDate(row.privacyConsentAt)
    if (privacyParsed.error) {
      result.errors.push(`строка ${rowNumber}: некорректная дата privacyConsentAt`)
      continue
    }

    const termsParsed = parseOptionalDate(row.termsConsentAt)
    if (termsParsed.error) {
      result.errors.push(`строка ${rowNumber}: некорректная дата termsConsentAt`)
      continue
    }

    const groupChangeCount = row.groupChangeCount ? Number(row.groupChangeCount) || 0 : undefined
    const password = row.password ? String(row.password).trim() : ""
    const existingUser = existingByEmail.get(email)

    if (existingUser) {
      if (mode === "create") {
        result.skipped += 1
        continue
      }

      const updateData: {
        name?: string
        role?: Role
        department?: string | null
        group?: string | null
        groupChangeCount?: number
        bio?: string | null
        privacyConsentAt?: Date | null
        termsConsentAt?: Date | null
        password?: string
      } = {
        name: row.name ? String(row.name).trim() : undefined,
        role,
        department: row.department ? String(row.department).trim() : null,
        group: row.group ? String(row.group).trim() : null,
        groupChangeCount,
        bio: row.bio ? String(row.bio).trim() : null,
        privacyConsentAt: privacyParsed.value,
        termsConsentAt: termsParsed.value,
      }

      if (password) {
        if (password.length < 6) {
          result.errors.push(`строка ${rowNumber}: пароль должен быть минимум 6 символов`)
          continue
        }
        updateData.password = await bcrypt.hash(password, 10)
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: updateData,
      })

      result.updated += 1
      continue
    }

    const createData: {
      email: string
      name: string | null
      role: Role
      department: string | null
      group: string | null
      groupChangeCount: number
      bio: string | null
      privacyConsentAt?: Date | null
      termsConsentAt?: Date | null
      password?: string
    } = {
      email,
      name: row.name ? String(row.name).trim() : null,
      role: role || Role.STUDENT,
      department: row.department ? String(row.department).trim() : null,
      group: row.group ? String(row.group).trim() : null,
      groupChangeCount: groupChangeCount ?? 0,
      bio: row.bio ? String(row.bio).trim() : null,
      privacyConsentAt: privacyParsed.value,
      termsConsentAt: termsParsed.value,
    }

    if (password) {
      if (password.length < 6) {
        result.errors.push(`строка ${rowNumber}: пароль должен быть минимум 6 символов`)
        continue
      }
      createData.password = await bcrypt.hash(password, 10)
    } else {
      result.warnings.push(`строка ${rowNumber}: пароль не задан, вход по паролю недоступен`)
    }

    await prisma.user.create({ data: createData })
    result.created += 1
  }

  return result
}

export const importEventRows = async (
  rows: ImportRow[],
  mode: ImportMode,
  type: "events" | "news",
  actor: ImportActor
): Promise<ImportResult> => {
  const result = emptyImportResult()
  const importIsNews = type === "news"

  const creatorEmails = rows
    .map((row) => String(row.creatorEmail || "").trim().toLowerCase())
    .filter(Boolean)
  const moderatorEmails = rows.flatMap((row) =>
    splitList(row.moderatorEmails).map((email) => String(email).toLowerCase())
  )
  const allEmails = Array.from(new Set([...creatorEmails, ...moderatorEmails]))

  const users = allEmails.length
    ? await prisma.user.findMany({
        where: { email: { in: allEmails } },
        select: { id: true, email: true, role: true, name: true },
      })
    : []
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]))
  const creatorByIdCache = new Map<string, UserLookup | null>()

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2

    const title = String(row.title || "").trim()
    if (!title) {
      result.errors.push(`строка ${rowNumber}: отсутствует title`)
      continue
    }

    let category = normalizeCategory(row.category)
    if (!category && importIsNews) category = EventCategory.NEWS
    if (!category) {
      result.errors.push(`строка ${rowNumber}: некорректная категория (${row.category || ""})`)
      continue
    }

    const rawDate = String(row.date || "").trim()
    const rawTime = String(row.time || "").trim()
    const parsedDate = parseImportDateTime(rawDate, rawTime || undefined)
    if (!parsedDate) {
      result.errors.push(`строка ${rowNumber}: некорректная дата (${row.date || ""})`)
      continue
    }
    const timeValue = rawTime || parsedDate.toTimeString().slice(0, 5)

    const location = String(row.location || "").trim() || (importIsNews ? "Не указано" : "")
    const description = String(row.description || "").trim() || (importIsNews ? title : "")
    if (!location) {
      result.errors.push(`строка ${rowNumber}: отсутствует location`)
      continue
    }
    if (!description) {
      result.errors.push(`строка ${rowNumber}: отсутствует description`)
      continue
    }

    const creator = await resolveCreatorFromRow(row, actor, usersByEmail, creatorByIdCache)
    if (creator.warning) {
      result.warnings.push(`строка ${rowNumber}: ${creator.warning}`)
    }

    const moderatorEmailsList = splitList(row.moderatorEmails).map((email) => email.toLowerCase())
    const moderatorUsers = moderatorEmailsList
      .map((email) => usersByEmail.get(email))
      .filter((user): user is UserLookup => Boolean(user))

    const missingModerators = moderatorEmailsList.filter((email) => !usersByEmail.has(email))
    if (missingModerators.length > 0) {
      result.errors.push(`строка ${rowNumber}: модераторы не найдены (${missingModerators.join(", ")})`)
      continue
    }

    const invalidModerators = moderatorUsers.filter((user) => user.role !== "TEACHER" && user.role !== "ADMIN")
    if (invalidModerators.length > 0) {
      result.errors.push(`строка ${rowNumber}: модераторы должны быть TEACHER или ADMIN`)
      continue
    }

    const images = splitList(row.images)
    const payload = {
      title,
      category,
      date: parsedDate,
      time: timeValue,
      duration: String(row.duration || "").trim() || "2 часа",
      location,
      description,
      maxParticipants: row.maxParticipants ? Number(row.maxParticipants) || 0 : 0,
      isPast: parseBooleanValue(row.isPast) ?? false,
      isNews: importIsNews ? true : parseBooleanValue(row.isNews) ?? false,
      removedFromCalendar: parseBooleanValue(row.removedFromCalendar) ?? false,
      images,
      responsible: String(row.responsible || "").trim() || creator.name || "Не указано",
      contact: String(row.contact || "").trim() || creator.email || "",
      creatorId: creator.id,
    }

    const eventId = String(row.id || "").trim()
    const existingEvent = eventId ? await prisma.event.findUnique({ where: { id: eventId } }) : null

    if (existingEvent) {
      if (mode === "create") {
        result.skipped += 1
        continue
      }

      await prisma.$transaction(async (tx) => {
        await tx.event.update({
          where: { id: existingEvent.id },
          data: payload,
        })

        if (moderatorUsers.length > 0) {
          await tx.eventModerator.deleteMany({
            where: {
              eventId: existingEvent.id,
              userId: { notIn: moderatorUsers.map((user) => user.id) },
            },
          })
          await tx.eventModerator.createMany({
            data: moderatorUsers.map((user) => ({ eventId: existingEvent.id, userId: user.id })),
            skipDuplicates: true,
          })
        } else {
          await tx.eventModerator.deleteMany({
            where: { eventId: existingEvent.id },
          })
        }
      })

      result.updated += 1
      continue
    }

    await prisma.event.create({
      data: {
        ...payload,
        id: eventId || undefined,
        currentParticipants: 0,
        moderators: moderatorUsers.length
          ? {
              createMany: {
                data: moderatorUsers.map((user) => ({ userId: user.id })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
    })
    result.created += 1
  }

  return result
}

