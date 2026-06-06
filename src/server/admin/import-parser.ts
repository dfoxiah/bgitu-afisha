/**
 * File responsibility:
 * Parsing and normalization helpers for admin CSV/JSON import endpoints.
 *
 * Main logic:
 * - Parse CSV with quoted values and delimiter auto-detection
 * - Map flexible RU/EN headers to canonical field names
 * - Normalize booleans, dates, enums and list-like fields
 *
 * Integrations:
 * - src/server/admin/import-service.ts
 * - src/app/api/admin/import/route.ts
 */

import { EventCategory, Role } from "@prisma/client"
import { CategoryReverseMap } from "@/types"
import { parseLocalDateTime } from "@/server/shared/date-time"

export type ImportRow = Record<string, string>

export const normalizeHeader = (value: string) => value.trim().toLowerCase()

export const USER_HEADER_ALIASES: Record<string, string> = {
  id: "id",
  email: "email",
  "e-mail": "email",
  почта: "email",
  name: "name",
  имя: "name",
  роль: "role",
  role: "role",
  department: "department",
  кафедра: "department",
  факультет: "department",
  group: "group",
  группа: "group",
  admissionyear: "admissionYear",
  "год поступления": "admissionYear",
  groupchangecount: "groupChangeCount",
  bio: "bio",
  "о себе": "bio",
  privacyconsentat: "privacyConsentAt",
  termsconsentat: "termsConsentAt",
  password: "password",
  пароль: "password",
}

export const EVENT_HEADER_ALIASES: Record<string, string> = {
  id: "id",
  title: "title",
  название: "title",
  category: "category",
  категория: "category",
  date: "date",
  дата: "date",
  time: "time",
  время: "time",
  duration: "duration",
  длительность: "duration",
  location: "location",
  место: "location",
  description: "description",
  описание: "description",
  maxparticipants: "maxParticipants",
  max: "maxParticipants",
  ispast: "isPast",
  ispublic: "isPublic",
  public: "isPublic",
  requiresapproval: "requiresApproval",
  isnews: "isNews",
  removedfromcalendar: "removedFromCalendar",
  images: "images",
  responsible: "responsible",
  contact: "contact",
  creatoremail: "creatorEmail",
  creatorid: "creatorId",
  moderatoremails: "moderatorEmails",
  moderatoremail: "moderatorEmails",
  moderators: "moderatorEmails",
}

const parseCsv = (input: string) => {
  const text = input.replace(/^\uFEFF/, "")
  if (!text.trim()) return [] as string[][]

  const firstLine = text.split(/\r?\n/)[0] || ""
  const semicolonCount = firstLine.match(/;/g)?.length || 0
  const commaCount = firstLine.match(/,/g)?.length || 0
  const delimiter = semicolonCount >= commaCount ? ";" : ","

  const rows: string[][] = []
  let current = ""
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\""
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(current)
      current = ""
      continue
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1
      }
      row.push(current)
      current = ""
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row)
      }
      row = []
      continue
    }

    current += char
  }

  row.push(current)
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row)
  }

  return rows
}

export const mapCsvRows = (input: string, aliases: Record<string, string>) => {
  const rows = parseCsv(input)
  if (rows.length === 0) return [] as ImportRow[]

  const headerRow = rows[0]
  const headers = headerRow.map((header) => aliases[normalizeHeader(header)] || normalizeHeader(header))

  return rows.slice(1).map((row) => {
    const record: ImportRow = {}
    headers.forEach((key, index) => {
      if (!key) return
      record[key] = row[index] ?? ""
    })
    return record
  })
}

export const mapJsonRows = (payload: unknown, aliases: Record<string, string>) => {
  const source = payload as Record<string, unknown>
  const data = Array.isArray(payload)
    ? payload
    : Array.isArray(source?.rows)
      ? source.rows
      : Array.isArray(source?.data)
        ? source.data
        : Array.isArray(source?.users)
          ? source.users
          : Array.isArray(source?.events)
            ? source.events
            : Array.isArray(source?.news)
              ? source.news
              : []

  return data.map((item) => {
    const row: ImportRow = {}
    if (!item || typeof item !== "object") return row

    Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
      const normalized = aliases[normalizeHeader(key)] || key
      row[normalized] = value === null || value === undefined ? "" : String(value)
    })

    return row
  })
}

export const splitList = (value: unknown) => {
  if (value === null || value === undefined) return [] as string[]

  const raw = String(value).trim()
  if (!raw) return [] as string[]

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return [] as string[]
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    } catch {
      return [] as string[]
    }
  }

  return raw
    .split(/[;|,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export const parseBooleanValue = (value: unknown): boolean | undefined => {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim().toLowerCase()
  if (!raw) return undefined

  if (["true", "1", "yes", "y", "да"].includes(raw)) return true
  if (["false", "0", "no", "n", "нет"].includes(raw)) return false

  return undefined
}

const parseExcelSerialDate = (raw: string) => {
  if (!/^\d{5,}$/.test(raw)) return null
  const serial = Number(raw)
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null

  const excelEpoch = new Date(1899, 11, 30)
  return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
}

export const parseImportDateTime = (dateRaw: string, timeRaw?: string) => {
  const parsed = parseLocalDateTime(dateRaw, timeRaw)
  if (parsed) return parsed

  const excelDate = parseExcelSerialDate(dateRaw.trim())
  if (!excelDate) return null

  if (timeRaw) {
    const withTime = parseLocalDateTime(
      `${excelDate.getFullYear()}-${String(excelDate.getMonth() + 1).padStart(2, "0")}-${String(
        excelDate.getDate()
      ).padStart(2, "0")}`,
      timeRaw
    )
    return withTime || excelDate
  }

  return excelDate
}

export const parseOptionalDate = (value: unknown) => {
  if (value === null || value === undefined) return { value: undefined as Date | null | undefined }

  const raw = String(value).trim()
  if (!raw) return { value: undefined as Date | null | undefined }

  const normalized = raw.toLowerCase()
  if (["null", "none", "-"].includes(normalized)) return { value: null as null }
  if (["true", "yes", "1", "да"].includes(normalized)) return { value: new Date() }

  const parsed = parseImportDateTime(raw)
  if (!parsed) return { value: undefined as Date | null | undefined, error: "invalid" as const }

  return { value: parsed as Date }
}

export const normalizeRole = (value: unknown): Role | undefined => {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim()
  if (!raw) return undefined

  const upper = raw.toUpperCase()
  if (
    upper === "STUDENT" ||
    upper === "TEACHER" ||
    upper === "MODERATOR" ||
    upper === "EDITOR" ||
    upper === "ADMIN"
  ) {
    return upper
  }

  if (raw === "Студент") return Role.STUDENT
  if (raw === "Преподаватель") return Role.TEACHER
  if (raw === "Модератор") return Role.MODERATOR
  if (raw === "Редактор") return Role.EDITOR
  if (raw === "Администратор") return Role.ADMIN

  return undefined
}

export const normalizeCategory = (value: unknown): EventCategory | undefined => {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim()
  if (!raw) return undefined

  if (Object.values(EventCategory).includes(raw as EventCategory)) {
    return raw as EventCategory
  }

  return CategoryReverseMap[raw]
}
