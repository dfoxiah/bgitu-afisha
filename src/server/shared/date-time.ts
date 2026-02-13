/**
 * File responsibility:
 * Centralized date/time parsing helpers used by API route handlers and services.
 *
 * Main logic:
 * - Parse local date strings (YYYY-MM-DD, DD.MM.YYYY, ISO with optional time)
 * - Apply explicit HH:mm time when provided
 * - Return null on invalid input instead of throwing
 *
 * Integrations:
 * - Used by events/admin import/update endpoints
 */

const parseTimeParts = (value?: string | null) => {
  if (!value) return null

  const raw = String(value).trim()
  if (!raw) return null

  const match = raw.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return { hours, minutes }
}

const parseDateParts = (value: string) => {
  const raw = value.trim()
  if (!raw) return null

  const ymd = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (ymd) {
    return { year: Number(ymd[1]), month: Number(ymd[2]), day: Number(ymd[3]) }
  }

  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (dmy) {
    return { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) }
  }

  return null
}

export const parseLocalDateTime = (dateString: string, timeString?: string): Date | null => {
  try {
    const rawDate = String(dateString || "").trim()
    if (!rawDate) return null

    const explicitTime = parseTimeParts(timeString)

    if (rawDate.includes("T")) {
      const parsed = new Date(rawDate)
      if (Number.isNaN(parsed.getTime())) return null

      if (explicitTime) {
        parsed.setHours(explicitTime.hours, explicitTime.minutes, 0, 0)
      }

      return parsed
    }

    let datePart = rawDate
    let inlineTime: { hours: number; minutes: number } | null = null
    if (rawDate.includes(" ")) {
      const [first, ...rest] = rawDate.split(" ")
      datePart = first
      if (!explicitTime && rest.length > 0) {
        inlineTime = parseTimeParts(rest.join(" "))
      }
    }

    const parts = parseDateParts(datePart)
    if (!parts) return null

    const time = explicitTime || inlineTime || { hours: 0, minutes: 0 }
    const parsed = new Date(parts.year, parts.month - 1, parts.day, time.hours, time.minutes, 0, 0)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  } catch {
    return null
  }
}

export const formatLocalDate = (date: Date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export const formatLocalTime = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

