import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EventCategory, Role } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'
import { CategoryReverseMap } from '@/types'

const isAdminSession = (session: any) => session?.user?.id && session.user.role === 'ADMIN'

type UserLookup = { id: string; email: string; role: Role; name: string | null }

const normalizeHeader = (value: string) => value.trim().toLowerCase()

const USER_HEADER_ALIASES: Record<string, string> = {
  'id': 'id',
  'email': 'email',
  'e-mail': 'email',
  'почта': 'email',
  'name': 'name',
  'имя': 'name',
  'роль': 'role',
  'role': 'role',
  'department': 'department',
  'кафедра': 'department',
  'факультет': 'department',
  'group': 'group',
  'группа': 'group',
  'groupchangecount': 'groupChangeCount',
  'bio': 'bio',
  'о себе': 'bio',
  'privacyconsentat': 'privacyConsentAt',
  'termsconsentat': 'termsConsentAt',
  'password': 'password',
  'пароль': 'password'
}

const EVENT_HEADER_ALIASES: Record<string, string> = {
  'id': 'id',
  'title': 'title',
  'название': 'title',
  'category': 'category',
  'категория': 'category',
  'date': 'date',
  'дата': 'date',
  'time': 'time',
  'время': 'time',
  'duration': 'duration',
  'длительность': 'duration',
  'location': 'location',
  'место': 'location',
  'description': 'description',
  'описание': 'description',
  'maxparticipants': 'maxParticipants',
  'max': 'maxParticipants',
  'ispast': 'isPast',
  'isnews': 'isNews',
  'removedfromcalendar': 'removedFromCalendar',
  'images': 'images',
  'responsible': 'responsible',
  'contact': 'contact',
  'creatoremail': 'creatorEmail',
  'creatorid': 'creatorId',
  'moderatoremails': 'moderatorEmails',
  'moderatoremail': 'moderatorEmails',
  'moderators': 'moderatorEmails'
}

const parseBoolean = (value: unknown) => {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim().toLowerCase()
  if (!raw) return undefined
  if (['true', '1', 'yes', 'y', 'да'].includes(raw)) return true
  if (['false', '0', 'no', 'n', 'нет'].includes(raw)) return false
  return undefined
}

const parseTimeParts = (value?: string | null) => {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/(\d{1,2})\s*[:.]\s*(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
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

  if (/^\d{5,}$/.test(raw)) {
    const serial = Number(raw)
    if (Number.isFinite(serial) && serial >= 20000 && serial <= 80000) {
      const excelEpoch = new Date(1899, 11, 30)
      const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
      return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
    }
  }

  return null
}

const parseDateTime = (dateString: string, timeString?: string): Date | null => {
  try {
    const raw = String(dateString || '').trim()
    if (!raw) return null

    const explicitTime = parseTimeParts(timeString)

    if (raw.includes('T')) {
      const parsed = new Date(raw)
      if (isNaN(parsed.getTime())) return null
      if (explicitTime) {
        parsed.setHours(explicitTime.hours, explicitTime.minutes, 0, 0)
      }
      return parsed
    }

    let datePart = raw
    let embeddedTime: { hours: number; minutes: number } | null = null
    if (raw.includes(' ')) {
      const [first, ...rest] = raw.split(' ')
      datePart = first
      if (!explicitTime && rest.length > 0) {
        embeddedTime = parseTimeParts(rest.join(' '))
      }
    }

    const parts = parseDateParts(datePart)
    if (!parts) return null

    const time = explicitTime || embeddedTime || { hours: 0, minutes: 0 }
    const date = new Date(parts.year, parts.month - 1, parts.day, time.hours, time.minutes, 0, 0)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const parseOptionalDate = (value: unknown) => {
  if (value === null || value === undefined) return { value: undefined as Date | null | undefined }
  const raw = String(value).trim()
  if (!raw) return { value: undefined as Date | null | undefined }
  const normalized = raw.toLowerCase()
  if (['null', 'none', '-'].includes(normalized)) return { value: null }
  if (['true', 'yes', '1', 'да'].includes(normalized)) return { value: new Date() }
  const parsed = parseDateTime(raw)
  if (!parsed || isNaN(parsed.getTime())) return { value: undefined as Date | null | undefined, error: 'invalid' }
  return { value: parsed }
}

const splitList = (value: unknown) => {
  if (value === null || value === undefined) return []
  const raw = String(value).trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String).map(v => v.trim()).filter(Boolean) : []
    } catch {
      return []
    }
  }
  return raw
    .split(/[;|,]/g)
    .map(item => item.trim())
    .filter(Boolean)
}

const normalizeRole = (value: unknown) => {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim()
  if (!raw) return undefined
  const upper = raw.toUpperCase()
  if (upper === 'STUDENT' || upper === 'TEACHER' || upper === 'ADMIN') {
    return upper as Role
  }
  if (raw === 'Студент') return Role.STUDENT
  if (raw === 'Преподаватель') return Role.TEACHER
  if (raw === 'Администратор') return Role.ADMIN
  return undefined
}

const normalizeCategory = (value: unknown) => {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim()
  if (!raw) return undefined
  if (Object.values(EventCategory).includes(raw as EventCategory)) {
    return raw as EventCategory
  }
  if (CategoryReverseMap[raw]) {
    return CategoryReverseMap[raw]
  }
  return undefined
}

const parseCsv = (input: string) => {
  const text = input.replace(/^\uFEFF/, '')
  if (!text.trim()) return []
  const firstLine = text.split(/\r?\n/)[0] || ''
  const delimiter = (firstLine.match(/;/g)?.length || 0) >= (firstLine.match(/,/g)?.length || 0) ? ';' : ','

  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(current)
      current = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i++
      }
      row.push(current)
      current = ''
      if (row.some(cell => cell.trim().length > 0)) {
        rows.push(row)
      }
      row = []
      continue
    }

    current += char
  }

  row.push(current)
  if (row.some(cell => cell.trim().length > 0)) {
    rows.push(row)
  }

  return rows
}

const mapCsvRows = (rows: string[][], aliases: Record<string, string>) => {
  if (rows.length === 0) return []
  const rawHeaders = rows[0]
  const headers = rawHeaders.map(header => aliases[normalizeHeader(header)] || normalizeHeader(header))
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {}
    headers.forEach((key, index) => {
      if (!key) return
      record[key] = row[index] ?? ''
    })
    return record
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const mode = (searchParams.get('mode') || 'upsert').toLowerCase()
  if (!type || !['users', 'events', 'news'].includes(type)) {
    return NextResponse.json({ error: 'Укажите type=users, events или news' }, { status: 400 })
  }

  const contentType = req.headers.get('content-type') || ''
  let rows: Array<Record<string, string>> = []

  try {
    if (contentType.includes('application/json')) {
      const payload = await req.json()
      const data = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.users)
        ? payload.users
        : Array.isArray(payload?.events)
        ? payload.events
        : Array.isArray(payload?.news)
        ? payload.news
        : []
      const aliases = type === 'users' ? USER_HEADER_ALIASES : EVENT_HEADER_ALIASES
      rows = data.map((item: any) => {
        const record: Record<string, string> = {}
        Object.entries(item || {}).forEach(([key, value]) => {
          const normalized = aliases[normalizeHeader(String(key))] || String(key)
          record[normalized] = value === null || value === undefined ? '' : String(value)
        })
        return record
      })
    } else {
      const text = await req.text()
      const parsed = parseCsv(text)
      rows = mapCsvRows(parsed, type === 'users' ? USER_HEADER_ALIASES : EVENT_HEADER_ALIASES)
    }
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать файл импорта' }, { status: 400 })
  }

  if (!rows.length) {
    return NextResponse.json({ error: 'Файл пустой или формат не распознан' }, { status: 400 })
  }

  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    warnings: [] as string[]
  }

  if (type === 'users') {
    const emails = Array.from(new Set(
      rows.map(row => String(row.email || row.Email || '').trim().toLowerCase()).filter(Boolean)
    ))

    const existing = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true }
    })
    const existingMap = new Map(existing.map(user => [user.email, user]))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowIndex = i + 2
      const email = String(row.email || '').trim().toLowerCase()
      if (!email) {
        result.errors.push(`Строка ${rowIndex}: отсутствует email`)
        continue
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        result.errors.push(`Строка ${rowIndex}: некорректный email (${email})`)
        continue
      }

      const role = normalizeRole(row.role)
      if (row.role && !role) {
        result.errors.push(`Строка ${rowIndex}: некорректная роль (${row.role})`)
        continue
      }

      const privacyParsed = parseOptionalDate(row.privacyConsentAt)
      if (privacyParsed.error) {
        result.errors.push(`Строка ${rowIndex}: некорректная дата privacyConsentAt`)
        continue
      }
      const termsParsed = parseOptionalDate(row.termsConsentAt)
      if (termsParsed.error) {
        result.errors.push(`Строка ${rowIndex}: некорректная дата termsConsentAt`)
        continue
      }
      const privacyConsentAt = privacyParsed.value
      const termsConsentAt = termsParsed.value
      const groupChangeCount = row.groupChangeCount ? Number(row.groupChangeCount) || 0 : undefined
      const password = row.password ? String(row.password).trim() : ''
      const existingUser = existingMap.get(email)

      if (existingUser) {
        if (mode === 'create') {
          result.skipped += 1
          continue
        }
        const updateData: any = {
          name: row.name ? String(row.name).trim() : undefined,
          role,
          department: row.department ? String(row.department).trim() : null,
          group: row.group ? String(row.group).trim() : null,
          groupChangeCount,
          bio: row.bio ? String(row.bio).trim() : null,
          privacyConsentAt,
          termsConsentAt
        }
        if (password) {
          if (password.length < 6) {
            result.errors.push(`Строка ${rowIndex}: пароль должен быть минимум 6 символов`)
            continue
          }
          updateData.password = await bcrypt.hash(password, 10)
        }
        await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData
        })
        result.updated += 1
      } else {
        const createData: any = {
          email,
          name: row.name ? String(row.name).trim() : null,
          role: role || Role.STUDENT,
          department: row.department ? String(row.department).trim() : null,
          group: row.group ? String(row.group).trim() : null,
          groupChangeCount: groupChangeCount ?? 0,
          bio: row.bio ? String(row.bio).trim() : null,
          privacyConsentAt,
          termsConsentAt
        }
        if (password) {
          if (password.length < 6) {
            result.errors.push(`Строка ${rowIndex}: пароль должен быть минимум 6 символов`)
            continue
          }
          createData.password = await bcrypt.hash(password, 10)
        } else {
          result.warnings.push(`Строка ${rowIndex}: пароль не указан, вход по паролю недоступен`)
        }

        await prisma.user.create({ data: createData })
        result.created += 1
      }
    }
  }

  if (type === 'events' || type === 'news') {
    const isNewsImport = type === 'news'
    const creatorEmails = rows
      .map(row => String(row.creatorEmail || '').trim().toLowerCase())
      .filter(Boolean)
    const moderatorEmails = rows.flatMap(row => splitList(row.moderatorEmails).map(email => String(email).toLowerCase()))
    const emailSet = Array.from(new Set([...creatorEmails, ...moderatorEmails]))

    const users = emailSet.length > 0
      ? await prisma.user.findMany({
          where: { email: { in: emailSet } },
          select: { id: true, email: true, role: true, name: true }
        })
      : []
    const userMap = new Map(users.map(user => [user.email.toLowerCase(), user]))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowIndex = i + 2
      const title = String(row.title || '').trim()
      if (!title) {
        result.errors.push(`Строка ${rowIndex}: отсутствует title`)
        continue
      }

      let category = normalizeCategory(row.category)
      if (!category && isNewsImport) {
        category = EventCategory.NEWS
      }
      if (!category) {
        result.errors.push(`Строка ${rowIndex}: некорректная категория (${row.category || ''})`)
        continue
      }

      const rawDate = String(row.date || '').trim()
      const rawTime = String(row.time || '').trim()
      const parsedDate = parseDateTime(rawDate, rawTime || undefined)
      if (!parsedDate) {
        result.errors.push(`Строка ${rowIndex}: некорректная дата (${row.date || ''})`)
        continue
      }
      const timeValue = rawTime || parsedDate.toTimeString().slice(0, 5)

      const location = String(row.location || '').trim() || (isNewsImport ? '�� �������' : '')
      const description = String(row.description || '').trim() || (isNewsImport ? title : '')
      if (!location) {
        result.errors.push(`Строка ${rowIndex}: отсутствует location`)
        continue
      }
      if (!description) {
        result.errors.push(`Строка ${rowIndex}: отсутствует description`)
        continue
      }

      const creatorEmail = String(row.creatorEmail || '').trim().toLowerCase()
      const creatorId = String(row.creatorId || '').trim()
      let resolvedCreatorId = session!.user!.id
      let resolvedCreatorName = session!.user!.name || ''
      let resolvedCreatorEmail = session!.user!.email || ''

      if (creatorId) {
        const creator = await prisma.user.findUnique({ where: { id: creatorId } })
        if (!creator) {
          result.errors.push(`Строка ${rowIndex}: создатель не найден (creatorId=${creatorId})`)
          continue
        }
        resolvedCreatorId = creator.id
        resolvedCreatorName = creator.name || ''
        resolvedCreatorEmail = creator.email
      } else if (creatorEmail) {
        const creator = userMap.get(creatorEmail)
        if (!creator) {
          result.errors.push(`Строка ${rowIndex}: создатель не найден (creatorEmail=${creatorEmail})`)
          continue
        }
        resolvedCreatorId = creator.id
        resolvedCreatorName = creator.name || ''
        resolvedCreatorEmail = creator.email
      }

      const moderatorList = splitList(row.moderatorEmails)
      const moderatorUsers = moderatorList
        .map(email => userMap.get(String(email).toLowerCase()))
        .filter((user): user is UserLookup => Boolean(user))

      const missingModerators = moderatorList.filter(email => !userMap.has(String(email).toLowerCase()))
      if (missingModerators.length > 0) {
        result.errors.push(`Строка ${rowIndex}: модераторы не найдены (${missingModerators.join(', ')})`)
        continue
      }
      const invalidModerators = moderatorUsers.filter(user => !['TEACHER', 'ADMIN'].includes(user.role))
      if (invalidModerators.length > 0) {
        result.errors.push(`Строка ${rowIndex}: модераторы должны быть TEACHER/ADMIN`)
        continue
      }

      const images = splitList(row.images)
      const isPast = parseBoolean(row.isPast) ?? false
      const isNews = isNewsImport ? true : (parseBoolean(row.isNews) ?? false)
      const removedFromCalendar = parseBoolean(row.removedFromCalendar) ?? false

      const payload = {
        title,
        category,
        date: parsedDate,
        time: timeValue,
        duration: String(row.duration || '').trim() || '2 часа',
        location,
        description,
        maxParticipants: row.maxParticipants ? Number(row.maxParticipants) || 0 : 0,
        isPast,
        isNews,
        removedFromCalendar,
        images,
        responsible: String(row.responsible || '').trim() || resolvedCreatorName || 'Не указан',
        contact: String(row.contact || '').trim() || resolvedCreatorEmail || '',
        creatorId: resolvedCreatorId
      }

      const eventId = String(row.id || '').trim()
      const existingEvent = eventId ? await prisma.event.findUnique({ where: { id: eventId } }) : null

      if (existingEvent) {
        if (mode === 'create') {
          result.skipped += 1
          continue
        }
        await prisma.$transaction(async (tx) => {
          await tx.event.update({
            where: { id: existingEvent.id },
            data: payload
          })
          if (moderatorUsers.length > 0) {
            await tx.eventModerator.deleteMany({
              where: {
                eventId: existingEvent.id,
                userId: { notIn: moderatorUsers.map(m => m.id) }
              }
            })
            await tx.eventModerator.createMany({
              data: moderatorUsers.map(user => ({ eventId: existingEvent.id, userId: user.id })),
              skipDuplicates: true
            })
          } else {
            await tx.eventModerator.deleteMany({
              where: { eventId: existingEvent.id }
            })
          }
        })
        result.updated += 1
      } else {
        await prisma.event.create({
          data: {
            ...payload,
            id: eventId || undefined,
            currentParticipants: 0,
            moderators: moderatorUsers.length > 0
              ? { createMany: { data: moderatorUsers.map(user => ({ userId: user.id })), skipDuplicates: true } }
              : undefined
          }
        })
        result.created += 1
      }
    }
  }

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: session!.user!.id,
    action: type === 'users' ? 'ADMIN_USERS_IMPORT' : type === 'news' ? 'ADMIN_NEWS_IMPORT' : 'ADMIN_EVENTS_IMPORT',
    entityType: type === 'users' ? 'User' : 'Event',
    entityId: null,
    metadata: {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
      warnings: result.warnings.length
    },
    ip,
    userAgent
  })

  return NextResponse.json(result)
}











