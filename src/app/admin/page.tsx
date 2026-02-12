'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { showToast } from '@/lib/toast'

type AdminUser = {
  id: string
  name: string | null
  email: string
  role: 'STUDENT' | 'TEACHER' | 'ADMIN'
  department: string | null
  group: string | null
  groupChangeCount: number
  bio: string | null
  privacyConsentAt?: string | null
  termsConsentAt?: string | null
  createdAt: string
  updatedAt?: string
}

type AdminEvent = {
  id: string
  title: string
  category: string
  date: string
  time: string
  duration?: string
  location: string
  description?: string
  maxParticipants: number
  isPast: boolean
  isNews?: boolean
  removedFromCalendar?: boolean
  images?: string[]
  responsible?: string
  contact?: string
  creator: { id: string; name: string | null; email: string }
  moderators: { id: string; name: string | null; email: string }[]
}

type AdminReport = {
  id: string
  summary: string
  reportDate: string
  images: string[]
  tasks?: string[]
  comment?: string | null
}

type AdminEventDetails = AdminEvent & {
  report?: AdminReport | null
}

type NewsEditorItem = {
  id: string
  title: string
  date: string
  content: string
  images: string
  tasks: string
  hasReport: boolean
}

type NewsDraft = {
  title: string
  date: string
  content: string
  images: string
  tasks: string
}

type AuditLog = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: string
  actor?: { id: string; name: string | null; email: string | null; role?: string | null } | null
  metadata?: Record<string, any> | null
}

type CsvValue = string | number | boolean | null | undefined

const buildCsv = (headers: string[], rows: Array<Record<string, CsvValue>>, delimiter = ';') => {
  const escapeValue = (value: CsvValue) => {
    const str = value === null || value === undefined ? '' : String(value)
    return `"${str.replace(/"/g, '""')}"`
  }

  const lines = [
    headers.map(escapeValue).join(delimiter),
    ...rows.map(row => headers.map(key => escapeValue(row[key])).join(delimiter))
  ]

  return `\uFEFF${lines.join('\r\n')}`
}

const downloadCsv = (filename: string, headers: string[], rows: Array<Record<string, CsvValue>>) => {
  if (rows.length === 0) return
  const csv = buildCsv(headers, rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

const normalizeDateValue = (value: string) => {
  if (!value) return value
  return value.includes('T') ? value.slice(0, 10) : value
}

const parseModeratorEmails = (value: string) => (
  value
    .split(',')
    .map(email => email.trim())
    .filter(Boolean)
)

const parseImageList = (value: string) => {
  const raw = value.trim()
  if (!raw) return []
  const lines = raw.split(/\r?\n/g).map(item => item.trim()).filter(Boolean)
  const result: string[] = []

  lines.forEach((line) => {
    if (line.startsWith('data:')) {
      result.push(line)
      return
    }

    line
      .split(/[|,;]+/g)
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => result.push(item))
  })

  return result
}

const joinImageList = (images: string[]) => images.join('\n')

const parseTaskList = (value: string) => (
  value
    .split(/\r?\n/g)
    .map(item => item.trim())
    .filter(Boolean)
)

const createEmptyNewsDraft = (): NewsDraft => ({
  title: '',
  date: new Date().toISOString().slice(0, 10),
  content: '',
  images: '',
  tasks: ''
})

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const formatOperationLabel = (action: string) => {
  if (action.includes('CREATE')) return 'РЎРѕР·РґР°РЅРёРµ'
  if (action.includes('UPDATE')) return 'РР·РјРµРЅРµРЅРёРµ'
  if (action.includes('DELETE')) return 'РЈРґР°Р»РµРЅРёРµ'
  if (action.includes('IMPORT')) return 'РРјРїРѕСЂС‚'
  if (action.includes('NOTIFY')) return 'РЈРІРµРґРѕРјР»РµРЅРёРµ'
  return 'Р”РµР№СЃС‚РІРёРµ'
}

const logFieldLabelMap: Record<string, string> = {
  title: 'РќР°Р·РІР°РЅРёРµ',
  description: 'РћРїРёСЃР°РЅРёРµ',
  location: 'РњРµСЃС‚Рѕ',
  duration: 'Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ',
  responsible: 'РћС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Р№',
  contact: 'РљРѕРЅС‚Р°РєС‚',
  category: 'РљР°С‚РµРіРѕСЂРёСЏ',
  maxParticipants: 'Р›РёРјРёС‚ СѓС‡Р°СЃС‚РЅРёРєРѕРІ',
  images: 'Р¤РѕС‚РѕРіСЂР°С„РёРё',
  date: 'Р”Р°С‚Р°',
  time: 'Р’СЂРµРјСЏ',
  isNews: 'РќРѕРІРѕСЃС‚СЊ',
  removedFromCalendar: 'Р’ РєР°Р»РµРЅРґР°СЂРµ',
  currentParticipants: 'РЈС‡Р°СЃС‚РЅРёРєРѕРІ',
  'report.summary': 'РћС‚С‡С‘С‚: СЃРІРѕРґРєР°',
  'report.reportDate': 'РћС‚С‡С‘С‚: РґР°С‚Р°',
  'report.images': 'РћС‚С‡С‘С‚: С„РѕС‚Рѕ',
  'report.tasks': 'РћС‚С‡С‘С‚: Р·Р°РґР°С‡Рё',
  'report.comment': 'РћС‚С‡С‘С‚: РєРѕРјРјРµРЅС‚Р°СЂРёР№'
}

const logEventInfoLabelMap: Record<string, string> = {
  title: 'РќР°Р·РІР°РЅРёРµ',
  category: 'РљР°С‚РµРіРѕСЂРёСЏ',
  date: 'Р”Р°С‚Р°',
  time: 'Р’СЂРµРјСЏ',
  location: 'РњРµСЃС‚Рѕ',
  description: 'РћРїРёСЃР°РЅРёРµ',
  duration: 'Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ',
  maxParticipants: 'Р›РёРјРёС‚ СѓС‡Р°СЃС‚РЅРёРєРѕРІ',
  currentParticipants: 'РўРµРєСѓС‰РµРµ С‡РёСЃР»Рѕ СѓС‡Р°СЃС‚РЅРёРєРѕРІ',
  moderatorsCount: 'Р§РёСЃР»Рѕ РјРѕРґРµСЂР°С‚РѕСЂРѕРІ',
  imagesCount: 'РљРѕР»РёС‡РµСЃС‚РІРѕ С„РѕС‚Рѕ',
  isNews: 'РќРѕРІРѕСЃС‚СЊ',
  removedFromCalendar: 'Р’ РєР°Р»РµРЅРґР°СЂРµ',
  responsible: 'РћС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Р№',
  contact: 'РљРѕРЅС‚Р°РєС‚'
}

const logReportInfoLabelMap: Record<string, string> = {
  summary: 'РЎРІРѕРґРєР°',
  reportDate: 'Р”Р°С‚Р° РѕС‚С‡С‘С‚Р°',
  imagesCount: 'РљРѕР»РёС‡РµСЃС‚РІРѕ С„РѕС‚Рѕ',
  tasksCount: 'РљРѕР»РёС‡РµСЃС‚РІРѕ Р·Р°РґР°С‡',
  comment: 'РљРѕРјРјРµРЅС‚Р°СЂРёР№'
}

const MAX_LOG_STRING_LENGTH = 180
const MAX_LOG_ARRAY_ITEMS = 6
const MAX_LOG_OBJECT_KEYS = 25
const MAX_LOG_SANITIZE_DEPTH = 5

const truncateLogText = (value: string, maxLength = MAX_LOG_STRING_LENGTH) => {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}... (${value.length} chars)`
}

const normalizeLogString = (value: string, maxLength = MAX_LOG_STRING_LENGTH) => {
  const text = value.trim()
  if (!text) return 'вЂ”'

  if (text.startsWith('data:')) {
    const commaIndex = text.indexOf(',')
    const header = commaIndex >= 0 ? text.slice(0, commaIndex) : text
    const payload = commaIndex >= 0 ? text.slice(commaIndex + 1) : ''
    const mimeTypeRaw = header.slice(5).split(';')[0]
    const mimeType = mimeTypeRaw || 'application/octet-stream'
    const isBase64 = header.toLowerCase().includes(';base64')
    if (isBase64) {
      return `data:${mimeType};base64,... (${payload.length} chars)`
    }
    return truncateLogText(`data:${mimeType},${payload}`, maxLength)
  }

  if (/^https?:\/\//i.test(text) && text.length > maxLength) {
    try {
      const url = new URL(text)
      const path = truncateLogText(`${url.pathname}${url.search}${url.hash}`, Math.max(40, Math.floor(maxLength / 2)))
      return `${url.origin}${path} (${text.length} chars)`
    } catch {
      // fallback to generic truncation
    }
  }

  return truncateLogText(text, maxLength)
}

const sanitizeLogPayload = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_LOG_SANITIZE_DEPTH) return '[depth limit]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return normalizeLogString(value, 220)
  if (typeof value === 'number' || typeof value === 'boolean') return value

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_LOG_ARRAY_ITEMS)
      .map(item => sanitizeLogPayload(item, depth + 1))
    if (value.length > MAX_LOG_ARRAY_ITEMS) {
      items.push(`... (+${value.length - MAX_LOG_ARRAY_ITEMS})`)
    }
    return items
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const entries = Object.entries(source)
    const result: Record<string, unknown> = {}

    entries.slice(0, MAX_LOG_OBJECT_KEYS).forEach(([key, raw]) => {
      result[key] = sanitizeLogPayload(raw, depth + 1)
    })

    if (entries.length > MAX_LOG_OBJECT_KEYS) {
      result.__truncated = `... (+${entries.length - MAX_LOG_OBJECT_KEYS} keys)`
    }

    return result
  }

  return String(value)
}

const formatLogValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'вЂ”'
  if (typeof value === 'boolean') return value ? 'РґР°' : 'РЅРµС‚'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return normalizeLogString(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return 'вЂ”'
    const items = value.slice(0, MAX_LOG_ARRAY_ITEMS).map(item => formatLogValue(item))
    const suffix = value.length > MAX_LOG_ARRAY_ITEMS ? ` ... (+${value.length - MAX_LOG_ARRAY_ITEMS})` : ''
    return `${items.join(', ')}${suffix}`
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(sanitizeLogPayload(value))
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const stringifyLogPayload = (value: unknown) => {
  try {
    return JSON.stringify(sanitizeLogPayload(value), null, 2)
  } catch {
    return String(value)
  }
}
const appendObjectDetails = (
  lines: string[],
  title: string,
  value: unknown,
  labels: Record<string, string>
) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return
  lines.push(`${title}:`)
  entries.forEach(([key, raw]) => {
    const keyLabel = labels[key] || logFieldLabelMap[key] || key
    lines.push(`- ${keyLabel}: ${formatLogValue(raw)}`)
  })
}

const appendChangesDetails = (lines: string[], title: string, value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const payload = value as Record<string, unknown>
  const added = Array.isArray(payload.added) ? payload.added : []
  const removed = Array.isArray(payload.removed) ? payload.removed : []
  const totalBefore = typeof payload.totalBefore === 'number' ? payload.totalBefore : null
  const totalAfter = typeof payload.totalAfter === 'number' ? payload.totalAfter : null

  lines.push(`${title}: +${added.length}, -${removed.length}`)
  if (added.length > 0) {
    lines.push(`- Р”РѕР±Р°РІР»РµРЅРѕ: ${formatLogValue(added)}`)
  }
  if (removed.length > 0) {
    lines.push(`- РЈРґР°Р»РµРЅРѕ: ${formatLogValue(removed)}`)
  }
  if (totalBefore !== null || totalAfter !== null) {
    lines.push(`- РС‚РѕРіРѕ: ${totalBefore ?? 'вЂ”'} -> ${totalAfter ?? 'вЂ”'}`)
  }
}

const buildLogDetails = (log: AuditLog) => {
  const lines: string[] = []
  const meta = log.metadata && typeof log.metadata === 'object' ? log.metadata : null
  const metaPreview = meta ? stringifyLogPayload(meta) : null

  lines.push(`РћРїРµСЂР°С†РёСЏ: ${formatOperationLabel(log.action)}`)

  if (meta && Array.isArray((meta as any).updatedFields)) {
    const fields = (meta as any).updatedFields as string[]
    if (fields.length > 0) {
      const labels = fields.map(field => logFieldLabelMap[field] || field)
      lines.push(`РР·РјРµРЅРµРЅРѕ: ${labels.join(', ')}`)
    }
  }

  if (meta && (meta as any).fieldChanges && typeof (meta as any).fieldChanges === 'object') {
    const entries = Object.entries((meta as any).fieldChanges as Record<string, any>)
    if (entries.length > 0) {
      lines.push('РР·РјРµРЅРµРЅРёСЏ РїРѕ РїРѕР»СЏРј:')
      entries.forEach(([field, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return
        const from = (value as any).before
        const to = (value as any).after
        const label = logFieldLabelMap[field] || field
        lines.push(`- ${label}: ${formatLogValue(from)} -> ${formatLogValue(to)}`)
      })
    }
  }

  if (meta && typeof (meta as any).participantsUpdated === 'boolean') {
    lines.push(`РЈС‡Р°СЃС‚РЅРёРєРё РѕР±РЅРѕРІР»РµРЅС‹: ${(meta as any).participantsUpdated ? 'РґР°' : 'РЅРµС‚'}`)
  }
  if (meta && typeof (meta as any).moderatorsUpdated === 'boolean') {
    lines.push(`РњРѕРґРµСЂР°С‚РѕСЂС‹ РѕР±РЅРѕРІР»РµРЅС‹: ${(meta as any).moderatorsUpdated ? 'РґР°' : 'РЅРµС‚'}`)
  }
  if (meta && typeof (meta as any).reportUpdated === 'boolean') {
    lines.push(`РћС‚С‡С‘С‚ РѕР±РЅРѕРІР»С‘РЅ: ${(meta as any).reportUpdated ? 'РґР°' : 'РЅРµС‚'}`)
  }
  if (meta && typeof (meta as any).title === 'string') {
    lines.push(`РќР°Р·РІР°РЅРёРµ: ${(meta as any).title}`)
  }

  if (meta) {
    appendChangesDetails(lines, 'РР·РјРµРЅРµРЅРёСЏ СѓС‡Р°СЃС‚РЅРёРєРѕРІ', (meta as any).participantChanges)
    appendChangesDetails(lines, 'РР·РјРµРЅРµРЅРёСЏ РјРѕРґРµСЂР°С‚РѕСЂРѕРІ', (meta as any).moderatorChanges)
    appendObjectDetails(lines, 'РњРµСЂРѕРїСЂРёСЏС‚РёРµ РґРѕ РёР·РјРµРЅРµРЅРёР№', (meta as any).eventInfoBefore, logEventInfoLabelMap)
    appendObjectDetails(lines, 'РњРµСЂРѕРїСЂРёСЏС‚РёРµ РїРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёР№', (meta as any).eventInfo, logEventInfoLabelMap)
    appendObjectDetails(lines, 'РћС‚С‡С‘С‚ РґРѕ РёР·РјРµРЅРµРЅРёР№', (meta as any).reportInfoBefore, logReportInfoLabelMap)
    appendObjectDetails(lines, 'РћС‚С‡С‘С‚ РїРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёР№', (meta as any).reportInfo, logReportInfoLabelMap)
  }

  if (meta && typeof (meta as any).created === 'number') {
    lines.push(`РЎРѕР·РґР°РЅРѕ: ${(meta as any).created}`)
  }
  if (meta && typeof (meta as any).updated === 'number') {
    lines.push(`РћР±РЅРѕРІР»РµРЅРѕ: ${(meta as any).updated}`)
  }
  if (meta && typeof (meta as any).skipped === 'number') {
    lines.push(`РџСЂРѕРїСѓС‰РµРЅРѕ: ${(meta as any).skipped}`)
  }
  if (meta && typeof (meta as any).errors === 'number') {
    lines.push(`РћС€РёР±РѕРє: ${(meta as any).errors}`)
  }
  if (meta && typeof (meta as any).warnings === 'number') {
    lines.push(`РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№: ${(meta as any).warnings}`)
  }

  if (meta && typeof (meta as any).email === 'string') {
    lines.push(`Email: ${(meta as any).email}`)
  }
  if (meta && typeof (meta as any).role === 'string') {
    lines.push(`Р РѕР»СЊ: ${(meta as any).role}`)
  }
  if (meta && typeof (meta as any).count === 'number') {
    lines.push(`РљРѕР»РёС‡РµСЃС‚РІРѕ: ${(meta as any).count}`)
  }
  if (meta && typeof (meta as any).recipients === 'string') {
    lines.push(`РџРѕР»СѓС‡Р°С‚РµР»Рё: ${(meta as any).recipients}`)
  }
  if (meta && typeof (meta as any).scope === 'string') {
    lines.push(`РћР±Р»Р°СЃС‚СЊ: ${(meta as any).scope}`)
  }

  return { lines, meta, metaPreview }
}
export default function AdminPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<'users' | 'events' | 'logs'>('users')
  const [loading, setLoading] = useState(false)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [newsItems, setNewsItems] = useState<AdminEvent[]>([])

  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER' | 'ADMIN'>('ALL')
  const [eventSearch, setEventSearch] = useState('')
  const [eventCategory, setEventCategory] = useState('ALL')
  const [eventStatus, setEventStatus] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL')
  const [newsSearch, setNewsSearch] = useState('')
  const [newsLoading, setNewsLoading] = useState(false)
  const [logAction, setLogAction] = useState('')
  const [logEntityType, setLogEntityType] = useState('')

  const [importUsersFile, setImportUsersFile] = useState<File | null>(null)
  const [importEventsFile, setImportEventsFile] = useState<File | null>(null)
  const [importUsersMode, setImportUsersMode] = useState<'upsert' | 'create'>('upsert')
  const [importEventsMode, setImportEventsMode] = useState<'upsert' | 'create'>('upsert')
  const [importUsersResult, setImportUsersResult] = useState<any>(null)
  const [importEventsResult, setImportEventsResult] = useState<any>(null)
  const [importingUsers, setImportingUsers] = useState(false)
  const [importingEvents, setImportingEvents] = useState(false)
  const [importNewsFile, setImportNewsFile] = useState<File | null>(null)
  const [importNewsMode, setImportNewsMode] = useState<'upsert' | 'create'>('upsert')
  const [importNewsResult, setImportNewsResult] = useState<any>(null)
  const [importingNews, setImportingNews] = useState(false)

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null)
  const [selectedNews, setSelectedNews] = useState<NewsEditorItem | null>(null)
  const [newNews, setNewNews] = useState<NewsDraft>(() => createEmptyNewsDraft())
  const [userPassword, setUserPassword] = useState('')
  const [savingNews, setSavingNews] = useState(false)
  const [creatingNews, setCreatingNews] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT',
    department: '',
    group: ''
  })

  const canAccess = useMemo(() => session?.user?.role === 'ADMIN', [session])
  const categoryOptions = useMemo(
    () => ([
      { value: 'CONCERT', label: 'РљРѕРЅС†РµСЂС‚' },
      { value: 'INTERNAL_ACTIVITY', label: 'Р’РЅСѓС‚СЂРёРІСѓР·РѕРІСЃРєР°СЏ Р°РєС‚РёРІРЅРѕСЃС‚СЊ' },
      { value: 'PUBLIC_EVENT', label: 'РћР±С‰РµСЃС‚РІРµРЅРЅРѕРµ РјРµСЂРѕРїСЂРёСЏС‚РёРµ' },
      { value: 'COMPETITION', label: 'РЎРѕСЂРµРІРЅРѕРІР°РЅРёРµ' },
      { value: 'LECTURE', label: 'Р›РµРєС†РёСЏ' },
      { value: 'MASTERCLASS', label: 'РњР°СЃС‚РµСЂ-РєР»Р°СЃСЃ' },
      { value: 'VOLUNTEER', label: 'Р’РѕР»РѕРЅС‚С‘СЂСЃРєР°СЏ Р°РєС‚РёРІРЅРѕСЃС‚СЊ' },
      { value: 'NEWS', label: 'РќРѕРІРѕСЃС‚СЊ' }
    ]),
    []
  )
  const categoryLabelMap = useMemo(() => (
    categoryOptions.reduce<Record<string, string>>((acc, item) => {
      acc[item.value] = item.label
      return acc
    }, {})
  ), [categoryOptions])

  const userImportHeaders = [
    'id',
    'name',
    'email',
    'role',
    'department',
    'group',
    'groupChangeCount',
    'bio',
    'privacyConsentAt',
    'termsConsentAt',
    'password'
  ]

  const eventImportHeaders = [
    'id',
    'title',
    'category',
    'date',
    'time',
    'duration',
    'location',
    'description',
    'maxParticipants',
    'isPast',
    'isNews',
    'removedFromCalendar',
    'images',
    'responsible',
    'contact',
    'creatorEmail',
    'moderatorEmails'
  ]

  useEffect(() => {
    if (status === 'authenticated' && !canAccess) {
      router.replace('/')
    }
  }, [status, canAccess, router])
  const readJson = useCallback(async <T,>(res: Response) => {
    const contentType = res.headers.get('content-type') || ''
    if (res.redirected) {
      router.replace(res.url)
      throw new Error('\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0432\u0445\u043e\u0434')
    }
    const isJson = contentType.includes('application/json')
    if (!isJson) {
      await res.text()
      throw new Error('\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043d\u0443\u043b \u043d\u0435\u043e\u0436\u0438\u0434\u0430\u043d\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442')
    }

    const data = await res.json()
    if (!res.ok) {
      if (res.status === 401) {
        router.replace('/login')
      } else if (res.status === 403) {
        router.replace('/')
      }
      throw new Error(data?.error || '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u043f\u0440\u043e\u0441\u0430')
    }
    return data as T
  }, [router])


  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userSearch) params.set('search', userSearch)
      if (userRoleFilter !== 'ALL') params.set('role', userRoleFilter)
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      const data = await readJson<AdminUser[]>(res)
      setUsers(data)
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№', 'error')
    } finally {
      setLoading(false)
    }
  }, [userSearch, userRoleFilter, readJson])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (eventSearch) params.set('search', eventSearch)
      if (eventCategory !== 'ALL') params.set('category', eventCategory)
      if (eventStatus === 'UPCOMING') params.set('upcoming', 'true')
      if (eventStatus === 'PAST') params.set('past', 'true')
      const res = await fetch(`/api/admin/events?${params.toString()}`)
      const data = await readJson<AdminEvent[]>(res)
      setEvents(data)
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РјРµСЂРѕРїСЂРёСЏС‚РёР№', 'error')
    } finally {
      setLoading(false)
    }
  }, [eventSearch, eventCategory, eventStatus, readJson])

  const fetchNews = useCallback(async () => {
    setNewsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('news', 'true')
      params.set('limit', '200')
      if (newsSearch) params.set('search', newsSearch)
      const res = await fetch(`/api/admin/events?${params.toString()}`)
      const data = await readJson<AdminEvent[]>(res)
      setNewsItems(data)
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РЅРѕРІРѕСЃС‚РµР№', 'error')
    } finally {
      setNewsLoading(false)
    }
  }, [newsSearch, readJson])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '100')
      if (logAction) params.set('action', logAction)
      if (logEntityType) params.set('entityType', logEntityType)
      const res = await fetch(`/api/admin/logs?${params.toString()}`)
      const data = await readJson<AuditLog[]>(res)
      setLogs(data)
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё Р»РѕРіРѕРІ', 'error')
    } finally {
      setLoading(false)
    }
  }, [logAction, logEntityType, readJson])

  const resolveContentType = (file: File) => (
    file.name.toLowerCase().endsWith('.json') ? 'application/json' : 'text/csv'
  )

  const handleImportUsers = useCallback(async () => {
    if (!importUsersFile) {
      showToast('Р’С‹Р±РµСЂРёС‚Рµ С„Р°Р№Р» РґР»СЏ РёРјРїРѕСЂС‚Р° РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№', 'error')
      return
    }

    setImportingUsers(true)
    setImportUsersResult(null)

    try {
      const body = await importUsersFile.text()
      const res = await fetch(`/api/admin/import?type=users&mode=${importUsersMode}`, {
        method: 'POST',
        headers: { 'Content-Type': resolveContentType(importUsersFile) },
        body
      })
      const data = await readJson<any>(res)
      setImportUsersResult(data)
      await fetchUsers()
      showToast('РРјРїРѕСЂС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Р·Р°РІРµСЂС€С‘РЅ', 'success')
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° РёРјРїРѕСЂС‚Р° РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№', 'error')
    } finally {
      setImportingUsers(false)
    }
  }, [importUsersFile, importUsersMode, readJson, fetchUsers])

  const handleImportEvents = useCallback(async () => {
    if (!importEventsFile) {
      showToast('Р’С‹Р±РµСЂРёС‚Рµ С„Р°Р№Р» РґР»СЏ РёРјРїРѕСЂС‚Р° РјРµСЂРѕРїСЂРёСЏС‚РёР№', 'error')
      return
    }

    setImportingEvents(true)
    setImportEventsResult(null)

    try {
      const body = await importEventsFile.text()
      const res = await fetch(`/api/admin/import?type=events&mode=${importEventsMode}`, {
        method: 'POST',
        headers: { 'Content-Type': resolveContentType(importEventsFile) },
        body
      })
      const data = await readJson<any>(res)
      setImportEventsResult(data)
      await fetchEvents()
      showToast('РРјРїРѕСЂС‚ РјРµСЂРѕРїСЂРёСЏС‚РёР№ Р·Р°РІРµСЂС€С‘РЅ', 'success')
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° РёРјРїРѕСЂС‚Р° РјРµСЂРѕРїСЂРёСЏС‚РёР№', 'error')
    } finally {
      setImportingEvents(false)
    }
  }, [importEventsFile, importEventsMode, readJson, fetchEvents])

  const handleImportNews = useCallback(async () => {
    if (!importNewsFile) {
      showToast('Р’С‹Р±РµСЂРёС‚Рµ С„Р°Р№Р» РґР»СЏ РёРјРїРѕСЂС‚Р° РЅРѕРІРѕСЃС‚РЅРѕР№ Р»РµРЅС‚С‹', 'error')
      return
    }

    setImportingNews(true)
    setImportNewsResult(null)

    try {
      const body = await importNewsFile.text()
      const res = await fetch(`/api/admin/import?type=news&mode=${importNewsMode}`, {
        method: 'POST',
        headers: { 'Content-Type': resolveContentType(importNewsFile) },
        body
      })
      const data = await readJson<any>(res)
      setImportNewsResult(data)
      await fetchEvents()
      await fetchNews()
      showToast('РРјРїРѕСЂС‚ РЅРѕРІРѕСЃС‚РЅРѕР№ Р»РµРЅС‚С‹ Р·Р°РІРµСЂС€С‘РЅ', 'success')
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° РёРјРїРѕСЂС‚Р° РЅРѕРІРѕСЃС‚РµР№', 'error')
    } finally {
      setImportingNews(false)
    }
  }, [importNewsFile, importNewsMode, readJson, fetchEvents, fetchNews])

  const loadNewsDetails = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/events/${id}`)
      const data = await readJson<AdminEventDetails>(res)
      const report = data.report || null
      const content = report?.summary || data.description || ''
      const images = report?.images && report.images.length > 0 ? report.images : (data.images || [])
      const tasks = report?.tasks && report.tasks.length > 0 ? report.tasks.join('\n') : ''
      const dateValue = normalizeDateValue(report?.reportDate || data.date)
      setSelectedNews({
        id: data.id,
        title: data.title,
        date: dateValue,
        content,
        images: images.join('\n'),
        tasks,
        hasReport: Boolean(report)
      })
      setSelectedEvent(null)
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РЅРѕРІРѕСЃС‚Рё', 'error')
    }
  }, [readJson])

  const handleCreateNews = async () => {
    const trimmedTitle = newNews.title.trim()
    const trimmedContent = newNews.content.trim()
    if (!trimmedTitle) {
      showToast('РЈРєР°Р¶РёС‚Рµ Р·Р°РіРѕР»РѕРІРѕРє РЅРѕРІРѕСЃС‚Рё', 'error')
      return
    }
    if (!trimmedContent) {
      showToast('РЈРєР°Р¶РёС‚Рµ С‚РµРєСЃС‚ РЅРѕРІРѕСЃС‚Рё', 'error')
      return
    }
    if (!newNews.date) {
      showToast('РЈРєР°Р¶РёС‚Рµ РґР°С‚Сѓ РїСѓР±Р»РёРєР°С†РёРё', 'error')
      return
    }

    setCreatingNews(true)
    try {
      const payload = {
        title: trimmedTitle,
        content: trimmedContent,
        date: newNews.date,
        images: parseImageList(newNews.images),
        tasks: parseTaskList(newNews.tasks)
      }

      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const created = await readJson<AdminEvent>(res)
      showToast('РќРѕРІРѕСЃС‚СЊ СЃРѕР·РґР°РЅР°', 'success')
      setNewNews(createEmptyNewsDraft())
      await fetchNews()
      await fetchEvents()
      if (created?.id) {
        await loadNewsDetails(created.id)
      }
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РЅРѕРІРѕСЃС‚Рё', 'error')
    } finally {
      setCreatingNews(false)
    }
  }

  const handleUpdateNews = async () => {
    if (!selectedNews) return
    const trimmedTitle = selectedNews.title.trim()
    const trimmedContent = selectedNews.content.trim()
    if (!trimmedTitle) {
      showToast('РЈРєР°Р¶РёС‚Рµ Р·Р°РіРѕР»РѕРІРѕРє РЅРѕРІРѕСЃС‚Рё', 'error')
      return
    }
    if (!selectedNews.date) {
      showToast('РЈРєР°Р¶РёС‚Рµ РґР°С‚Сѓ РїСѓР±Р»РёРєР°С†РёРё', 'error')
      return
    }

    setSavingNews(true)
    try {
      const images = parseImageList(selectedNews.images)
      const tasks = parseTaskList(selectedNews.tasks)
      const payload: any = { title: trimmedTitle }

      if (selectedNews.hasReport) {
        payload.report = {
          summary: trimmedContent,
          reportDate: selectedNews.date,
          images,
          tasks
        }
      } else {
        payload.description = trimmedContent
        payload.date = selectedNews.date
        payload.images = images
        payload.isNews = true
      }

      const res = await fetch(`/api/admin/events/${selectedNews.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await readJson(res)
      showToast('РќРѕРІРѕСЃС‚СЊ РѕР±РЅРѕРІР»РµРЅР°', 'success')
      setSelectedNews(null)
      await fetchNews()
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ РЅРѕРІРѕСЃС‚Рё', 'error')
    } finally {
      setSavingNews(false)
    }
  }

  useEffect(() => {
    if (!canAccess) return
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'events') {
      fetchEvents()
      fetchNews()
    }
    if (activeTab === 'logs') fetchLogs()
  }, [activeTab, canAccess, fetchUsers, fetchEvents, fetchNews, fetchLogs])

  const handleCreateUser = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      await readJson(res)
      showToast('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃРѕР·РґР°РЅ', 'success')
      setNewUser({ name: '', email: '', password: '', role: 'STUDENT', department: '', group: '' })
      await fetchUsers()
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ', 'error')
    }
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return
    try {
      const payload: any = { ...selectedUser }
      if (userPassword.trim()) {
        payload.password = userPassword.trim()
      }
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await readJson(res)
      showToast('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕР±РЅРѕРІР»С‘РЅ', 'success')
      setSelectedUser(null)
      setUserPassword('')
      await fetchUsers()
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ', 'error')
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('РЈРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ?')) return
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      await readJson(res)
      showToast('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»С‘РЅ', 'success')
      await fetchUsers()
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ', 'error')
    }
  }

  const handleUpdateEvent = async () => {
    if (!selectedEvent) return
    try {
      const res = await fetch(`/api/admin/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedEvent.title,
          category: selectedEvent.category,
          date: selectedEvent.date,
          time: selectedEvent.time,
          location: selectedEvent.location,
          maxParticipants: selectedEvent.maxParticipants,
          moderators: selectedEvent.moderators.map(m => m.email)
        })
      })
      await readJson(res)
      showToast('РњРµСЂРѕРїСЂРёСЏС‚РёРµ РѕР±РЅРѕРІР»РµРЅРѕ', 'success')
      setSelectedEvent(null)
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ', 'error')
    }
  }

  const handleNewsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedNews) return
    if (!e.target.files) return

    const currentImages = parseImageList(selectedNews.images)
    const remainingSlots = Math.max(0, 10 - currentImages.length)
    const files = Array.from(e.target.files).slice(0, remainingSlots)
    if (files.length === 0) {
      e.target.value = ''
      return
    }

    try {
      const newImages = await Promise.all(files.map(readFileAsDataUrl))
      const updated = [...currentImages, ...newImages]
      setSelectedNews(prev => prev ? ({ ...prev, images: joinImageList(updated) }) : prev)
    } catch {
      showToast('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ', 'error')
    } finally {
      e.target.value = ''
    }
  }

  const handleCreateNewsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const currentImages = parseImageList(newNews.images)
    const remainingSlots = Math.max(0, 10 - currentImages.length)
    const files = Array.from(e.target.files).slice(0, remainingSlots)
    if (files.length === 0) {
      e.target.value = ''
      return
    }

    try {
      const newImages = await Promise.all(files.map(readFileAsDataUrl))
      const updated = [...currentImages, ...newImages]
      setNewNews(prev => ({ ...prev, images: joinImageList(updated) }))
    } catch {
      showToast('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ', 'error')
    } finally {
      e.target.value = ''
    }
  }

  const handleRemoveNewsImage = (index: number) => {
    if (!selectedNews) return
    const currentImages = parseImageList(selectedNews.images)
    const updated = currentImages.filter((_, idx) => idx !== index)
    setSelectedNews(prev => prev ? ({ ...prev, images: joinImageList(updated) }) : prev)
  }

  const handleRemoveCreateNewsImage = (index: number) => {
    const currentImages = parseImageList(newNews.images)
    const updated = currentImages.filter((_, idx) => idx !== index)
    setNewNews(prev => ({ ...prev, images: joinImageList(updated) }))
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('РЈРґР°Р»РёС‚СЊ РјРµСЂРѕРїСЂРёСЏС‚РёРµ?')) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
      await readJson(res)
      showToast('РњРµСЂРѕРїСЂРёСЏС‚РёРµ СѓРґР°Р»РµРЅРѕ', 'success')
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ', 'error')
    }
  }

  const handleDeleteNews = async (id: string) => {
    if (!confirm('РЈРґР°Р»РёС‚СЊ РЅРѕРІРѕСЃС‚СЊ?')) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
      await readJson(res)
      showToast('РќРѕРІРѕСЃС‚СЊ СѓРґР°Р»РµРЅР°', 'success')
      setSelectedNews(null)
      await fetchNews()
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РЅРѕРІРѕСЃС‚Рё', 'error')
    }
  }

  const handleExportUsers = () => {
    const rows = users.map(user => ({
      id: user.id,
      name: user.name || '',
      email: user.email,
      role: user.role,
      department: user.department || '',
      group: user.group || '',
      groupChangeCount: user.groupChangeCount,
      bio: user.bio || '',
      privacyConsentAt: user.privacyConsentAt ? new Date(user.privacyConsentAt).toISOString() : '',
      termsConsentAt: user.termsConsentAt ? new Date(user.termsConsentAt).toISOString() : '',
      password: ''
    }))
    downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, userImportHeaders, rows)
  }

  const handleDownloadUsersTemplate = () => {
    const row = userImportHeaders.reduce<Record<string, CsvValue>>((acc, key) => {
      acc[key] = ''
      return acc
    }, {})
    downloadCsv('users-import-template.csv', userImportHeaders, [row])
  }

  const mapEventRow = (event: AdminEvent) => ({
    id: event.id,
    title: event.title,
    category: event.category,
    date: event.date ? new Date(event.date).toISOString().slice(0, 10) : '',
    time: event.time || '',
    duration: event.duration || '',
    location: event.location,
    description: event.description || '',
    maxParticipants: event.maxParticipants ?? 0,
    isPast: event.isPast ? 'true' : 'false',
    isNews: event.isNews ? 'true' : 'false',
    removedFromCalendar: event.removedFromCalendar ? 'true' : 'false',
    images: event.images && event.images.length > 0 ? event.images.join('|') : '',
    responsible: event.responsible || '',
    contact: event.contact || '',
    creatorEmail: event.creator?.email || '',
    moderatorEmails: event.moderators.map(m => m.email).join('|')
  })

  const handleExportEvents = () => {
    const rows = events.map(mapEventRow)
    downloadCsv(`events-${new Date().toISOString().slice(0, 10)}.csv`, eventImportHeaders, rows)
  }

  const handleDownloadEventsTemplate = () => {
    const row = eventImportHeaders.reduce<Record<string, CsvValue>>((acc, key) => {
      acc[key] = ''
      return acc
    }, {})
    downloadCsv('events-import-template.csv', eventImportHeaders, [row])
  }

  const handleExportNews = async () => {
    try {
      const res = await fetch('/api/admin/events?news=true&limit=200')
      const data = await readJson<AdminEvent[]>(res)
      const rows = data.map(mapEventRow)
      if (rows.length === 0) {
        showToast('РќРµС‚ РЅРѕРІРѕСЃС‚РµР№ РґР»СЏ СЌРєСЃРїРѕСЂС‚Р°', 'error')
        return
      }
      downloadCsv(`news-${new Date().toISOString().slice(0, 10)}.csv`, eventImportHeaders, rows)
    } catch (error: any) {
      showToast(error.message || 'РћС€РёР±РєР° СЌРєСЃРїРѕСЂС‚Р° РЅРѕРІРѕСЃС‚РµР№', 'error')
    }
  }

  const handleDownloadNewsTemplate = () => {
    const row = eventImportHeaders.reduce<Record<string, CsvValue>>((acc, key) => {
      acc[key] = ''
      return acc
    }, {})
    row.category = 'NEWS'
    row.isNews = 'true'
    downloadCsv('news-import-template.csv', eventImportHeaders, [row])
  }

  const handleExportLogs = () => {
    const rows = logs.map(log => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId || '',
      actor: log.actor?.email || '',
      createdAt: log.createdAt,
      metadata: log.metadata ? JSON.stringify(log.metadata) : ''
    }))
    downloadCsv(`logs-${new Date().toISOString().slice(0, 10)}.csv`, [
      'id',
      'action',
      'entityType',
      'entityId',
      'actor',
      'createdAt',
      'metadata'
    ], rows)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-gray-700">РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РґР»СЏ РґРѕСЃС‚СѓРїР° Рє Р°РґРјРёРЅвЂ‘РїР°РЅРµР»Рё</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
          >
            РќР° РіР»Р°РІРЅСѓСЋ
          </button>
        </div>
      </div>
    )
  }

  const selectedNewsImages = selectedNews ? parseImageList(selectedNews.images) : []
  const newNewsImages = parseImageList(newNews.images)

  return (
    <div className="min-h-screen bg-light-gray px-4 md:px-5% py-8">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">РђРґРјРёРЅвЂ‘РїР°РЅРµР»СЊ</h1>
            <p className="text-sm text-gray-500">РЈРїСЂР°РІР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё, РјРµСЂРѕРїСЂРёСЏС‚РёСЏРјРё Рё Р°СѓРґРёС‚вЂ‘Р»РѕРіР°РјРё</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => {
              if (activeTab === 'users') fetchUsers()
              if (activeTab === 'events') {
                fetchEvents()
                fetchNews()
              }
              if (activeTab === 'logs') fetchLogs()
            }} disabled={loading}>
              РћР±РЅРѕРІРёС‚СЊ
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(['users', 'events', 'logs'] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-full ${activeTab === tab ? 'bg-white shadow text-primary' : 'text-gray-600'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'users' ? 'РџРѕР»СЊР·РѕРІР°С‚РµР»Рё' : tab === 'events' ? 'РњРµСЂРѕРїСЂРёСЏС‚РёСЏ' : 'Р›РѕРіРё'}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="liquid-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-primary">РРјРїРѕСЂС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№</h3>
                  <div className="text-xs text-gray-500">CSV РёР»Рё JSON</div>
                </div>
                <div className="text-xs text-gray-500 break-all">
                  Р¤РѕСЂРјР°С‚ CSV: {userImportHeaders.join('; ')}. Р Р°Р·РґРµР»РёС‚РµР»СЊ `;`, РєРѕРґРёСЂРѕРІРєР° UTF-8.
                </div>
                <div className="text-xs text-gray-500">
                  РџРѕР»Рµ `password` РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ. Р•СЃР»Рё РїСѓСЃС‚Рѕ, РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ СЃРјРѕР¶РµС‚ РІРѕР№С‚Рё РїРѕ РїР°СЂРѕР»СЋ.
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="file"
                    accept=".csv,.json"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    onChange={(e) => setImportUsersFile(e.target.files?.[0] || null)}
                  />
                  <select
                    className="px-3 py-2 border rounded-lg text-sm"
                    value={importUsersMode}
                    onChange={(e) => setImportUsersMode(e.target.value as any)}
                  >
                    <option value="upsert">РћР±РЅРѕРІР»СЏС‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС…</option>
                    <option value="create">РўРѕР»СЊРєРѕ РЅРѕРІС‹Рµ</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={handleImportUsers}
                    disabled={importingUsers}
                  >
                    {importingUsers ? 'РРјРїРѕСЂС‚...' : 'РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadUsersTemplate}>
                    РЁР°Р±Р»РѕРЅ CSV
                  </Button>
                </div>
                {importUsersResult && (
                  <div className="text-sm text-gray-600">
                    РЎРѕР·РґР°РЅРѕ: {importUsersResult.created || 0}, РѕР±РЅРѕРІР»РµРЅРѕ: {importUsersResult.updated || 0}, РїСЂРѕРїСѓС‰РµРЅРѕ: {importUsersResult.skipped || 0}, РѕС€РёР±РѕРє: {importUsersResult.errors?.length || 0}, РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№: {importUsersResult.warnings?.length || 0}
                  </div>
                )}
                {importUsersResult?.errors?.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1">
                    {importUsersResult.errors.slice(0, 5).map((err: string, idx: number) => (
                      <div key={`${err}-${idx}`}>{err}</div>
                    ))}
                    {importUsersResult.errors.length > 5 && (
                      <div>... РµС‰С‘ {importUsersResult.errors.length - 5} РѕС€РёР±РѕРє</div>
                    )}
                  </div>
                )}
              </div>
              <div className="liquid-card p-4 flex flex-wrap gap-3 items-center">
                <input
                  className="flex-grow px-4 py-2 rounded-lg border border-gray-200"
                  placeholder="РџРѕРёСЃРє РїРѕ РёРјРµРЅРё, email, РіСЂСѓРїРїРµ"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value as any)}
                >
                  <option value="ALL">Р’СЃРµ СЂРѕР»Рё</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="TEACHER">TEACHER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <Button variant="secondary" onClick={fetchUsers}>РќР°Р№С‚Рё</Button>
                <Button variant="secondary" onClick={handleExportUsers}>Р­РєСЃРїРѕСЂС‚ CSV</Button>
              </div>

              <div className="bg-white rounded-2xl shadow p-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">РРјСЏ</th>
                      <th>Email</th>
                      <th>Р РѕР»СЊ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-t">
                        <td className="py-2">{user.name || 'вЂ”'}</td>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td className="text-right space-x-2">
                          <button className="text-accent" onClick={() => {
                            setSelectedUser(user)
                            setUserPassword('')
                          }}>
                            Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                          </button>
                          <button className="text-red-600" onClick={() => handleDeleteUser(user.id)}>РЈРґР°Р»РёС‚СЊ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-semibold mb-3">РЎРѕР·РґР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</h3>
                <div className="space-y-3">
                  <input className="w-full px-3 py-2 border rounded" placeholder="РРјСЏ" value={newUser.name} onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))} />
                  <input className="w-full px-3 py-2 border rounded" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} />
                  <input className="w-full px-3 py-2 border rounded" placeholder="РџР°СЂРѕР»СЊ" type="password" value={newUser.password} onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))} />
                  <select className="w-full px-3 py-2 border rounded" value={newUser.role} onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}>
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <input className="w-full px-3 py-2 border rounded" placeholder="РљР°С„РµРґСЂР°/С„Р°РєСѓР»СЊС‚РµС‚" value={newUser.department} onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))} />
                  <input className="w-full px-3 py-2 border rounded" placeholder="Р“СЂСѓРїРїР°" value={newUser.group} onChange={(e) => setNewUser(prev => ({ ...prev, group: e.target.value }))} />
                  <Button variant="primary" onClick={handleCreateUser}>РЎРѕР·РґР°С‚СЊ</Button>
                </div>
              </div>

              {selectedUser && (
                <div className="bg-white rounded-2xl shadow p-4">
                  <h3 className="font-semibold mb-3">Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ</h3>
                  <div className="space-y-3">
                    <input className="w-full px-3 py-2 border rounded" value={selectedUser.name || ''} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, name: e.target.value }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" value={selectedUser.email} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, email: e.target.value }) : prev)} />
                    <select className="w-full px-3 py-2 border rounded" value={selectedUser.role} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, role: e.target.value as AdminUser['role'] }) : prev)}>
                      <option value="STUDENT">STUDENT</option>
                      <option value="TEACHER">TEACHER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <input className="w-full px-3 py-2 border rounded" placeholder="РљР°С„РµРґСЂР°" value={selectedUser.department || ''} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, department: e.target.value }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" placeholder="Р“СЂСѓРїРїР°" value={selectedUser.group || ''} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, group: e.target.value }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" placeholder="РЎС‡С‘С‚С‡РёРє СЃРјРµРЅ РіСЂСѓРїРїС‹" value={selectedUser.groupChangeCount} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, groupChangeCount: Number(e.target.value) || 0 }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" placeholder="РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)" type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={handleUpdateUser}>РЎРѕС…СЂР°РЅРёС‚СЊ</Button>
                      <Button variant="secondary" onClick={() => { setSelectedUser(null); setUserPassword('') }}>РћС‚РјРµРЅР°</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="liquid-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-primary">РРјРїРѕСЂС‚ РЅРѕРІРѕСЃС‚РЅРѕР№ Р»РµРЅС‚С‹</h3>
                  <div className="text-xs text-gray-500">CSV РёР»Рё JSON</div>
                </div>
                <div className="text-xs text-gray-500 break-all">
                  Р¤РѕСЂРјР°С‚ CSV: {eventImportHeaders.join('; ')}. Р Р°Р·РґРµР»РёС‚РµР»СЊ `;`, РєРѕРґРёСЂРѕРІРєР° UTF-8.
                </div>
                <div className="text-xs text-gray-500">
                  Р”Р»СЏ РЅРѕРІРѕСЃС‚РµР№ `isNews` РІС‹СЃС‚Р°РІР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё. Р•СЃР»Рё `category` РїСѓСЃС‚Р°СЏ, РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `NEWS`.
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-3">
                  <div className="font-medium text-gray-800">Быстро добавить новость</div>
                  <input
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Заголовок"
                    value={newNews.title}
                    onChange={(e) => setNewNews(prev => ({ ...prev, title: e.target.value }))}
                    disabled={creatingNews}
                  />
                  <input
                    className="w-full px-3 py-2 border rounded"
                    type="date"
                    value={newNews.date}
                    onChange={(e) => setNewNews(prev => ({ ...prev, date: e.target.value }))}
                    disabled={creatingNews}
                  />
                  <textarea
                    className="w-full px-3 py-2 border rounded min-h-[120px]"
                    placeholder="Текст новости"
                    value={newNews.content}
                    onChange={(e) => setNewNews(prev => ({ ...prev, content: e.target.value }))}
                    disabled={creatingNews}
                  />
                  <textarea
                    className="w-full px-3 py-2 border rounded min-h-[80px]"
                    placeholder="Задачи (по одной в строке, необязательно)"
                    value={newNews.tasks}
                    onChange={(e) => setNewNews(prev => ({ ...prev, tasks: e.target.value }))}
                    disabled={creatingNews}
                  />
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Фото (до 10). Можно загрузить файлы или вставить ссылки.
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleCreateNewsImageUpload}
                      className="w-full px-3 py-2 border rounded"
                      disabled={creatingNews || newNewsImages.length >= 10}
                    />
                    {newNewsImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {newNewsImages.map((img, index) => (
                          <div key={`draft-news-img-${index}`} className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img}
                              alt={`draft-news-${index}`}
                              className="w-full h-24 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveCreateNewsImage(index)}
                              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm"
                              title="Удалить фото"
                              disabled={creatingNews}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea
                    className="w-full px-3 py-2 border rounded min-h-[80px]"
                    placeholder="Изображения (URL по строкам или через |)"
                    value={newNews.images}
                    onChange={(e) => setNewNews(prev => ({ ...prev, images: e.target.value }))}
                    disabled={creatingNews}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={handleCreateNews} disabled={creatingNews}>
                      {creatingNews ? 'Создание...' : 'Добавить новость'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setNewNews(createEmptyNewsDraft())}
                      disabled={creatingNews}
                    >
                      Очистить
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="file"
                    accept=".csv,.json"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    onChange={(e) => setImportNewsFile(e.target.files?.[0] || null)}
                  />
                  <select
                    className="px-3 py-2 border rounded-lg text-sm"
                    value={importNewsMode}
                    onChange={(e) => setImportNewsMode(e.target.value as any)}
                  >
                    <option value="upsert">РћР±РЅРѕРІР»СЏС‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ</option>
                    <option value="create">РўРѕР»СЊРєРѕ РЅРѕРІС‹Рµ</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={handleImportNews}
                    disabled={importingNews}
                  >
                    {importingNews ? 'РРјРїРѕСЂС‚...' : 'РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadNewsTemplate}>
                    РЁР°Р±Р»РѕРЅ CSV
                  </Button>
                  <Button variant="secondary" onClick={handleExportNews}>
                    Р­РєСЃРїРѕСЂС‚ CSV
                  </Button>
                </div>
                {importNewsResult && (
                  <div className="text-sm text-gray-600">
                    РЎРѕР·РґР°РЅРѕ: {importNewsResult.created || 0}, РѕР±РЅРѕРІР»РµРЅРѕ: {importNewsResult.updated || 0}, РїСЂРѕРїСѓС‰РµРЅРѕ: {importNewsResult.skipped || 0}, РѕС€РёР±РѕРє: {importNewsResult.errors?.length || 0}, РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№: {importNewsResult.warnings?.length || 0}
                  </div>
                )}
                {importNewsResult?.errors?.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1">
                    {importNewsResult.errors.slice(0, 5).map((err: string, idx: number) => (
                      <div key={`${err}-${idx}`}>{err}</div>
                    ))}
                    {importNewsResult.errors.length > 5 && (
                      <div>... РµС‰С‘ {importNewsResult.errors.length - 5} РѕС€РёР±РѕРє</div>
                    )}
                  </div>
                )}
              </div>
              <div className="liquid-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-primary">Р РµРґР°РєС‚РѕСЂ РЅРѕРІРѕСЃС‚РµР№</h3>
                  <div className="text-xs text-gray-500">Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РјР°С‚РµСЂРёР°Р»РѕРІ Р»РµРЅС‚С‹</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    className="flex-grow px-3 py-2 border rounded-lg"
                    placeholder="РџРѕРёСЃРє РїРѕ РЅРѕРІРѕСЃС‚СЏРј"
                    value={newsSearch}
                    onChange={(e) => setNewsSearch(e.target.value)}
                  />
                  <Button variant="secondary" onClick={fetchNews} disabled={newsLoading}>
                    {newsLoading ? 'Р—Р°РіСЂСѓР·РєР°...' : 'РќР°Р№С‚Рё'}
                  </Button>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 overflow-auto max-h-[360px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 px-3">РќР°Р·РІР°РЅРёРµ</th>
                        <th className="px-3">РљР°С‚РµРіРѕСЂРёСЏ</th>
                        <th className="px-3">Р”Р°С‚Р°</th>
                        <th className="px-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newsItems.map(item => (
                        <tr key={item.id} className="border-t">
                          <td className="py-2 px-3">{item.title}</td>
                          <td className="px-3">{categoryLabelMap[item.category] || item.category}</td>
                          <td className="px-3">{new Date(item.date).toLocaleDateString('ru-RU')}</td>
                          <td className="px-3 text-right">
                            <button className="text-accent" onClick={() => loadNewsDetails(item.id)}>
                              Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                            </button>
                          </td>
                        </tr>
                      ))}
                      {newsItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-gray-500">
                            РќРµС‚ РЅРѕРІРѕСЃС‚РµР№ РїРѕ РІС‹Р±СЂР°РЅРЅС‹Рј СѓСЃР»РѕРІРёСЏРј
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="liquid-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-primary">РРјРїРѕСЂС‚ РјРµСЂРѕРїСЂРёСЏС‚РёР№</h3>
                  <div className="text-xs text-gray-500">CSV РёР»Рё JSON</div>
                </div>
                <div className="text-xs text-gray-500 break-all">
                  Р¤РѕСЂРјР°С‚ CSV: {eventImportHeaders.join('; ')}. Р Р°Р·РґРµР»РёС‚РµР»СЊ `;`, РєРѕРґРёСЂРѕРІРєР° UTF-8.
                </div>
                <div className="text-xs text-gray-500">
                  РџРѕР»Рµ `creatorEmail` РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ вЂ” РµСЃР»Рё РїСѓСЃС‚Рѕ, СЃРѕР·РґР°С‚РµР»РµРј СЃС‚Р°РЅРµС‚ С‚РµРєСѓС‰РёР№ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ.
                </div>
                <div className="text-xs text-gray-500">
                  Р”Р»СЏ СЃРїРёСЃРєРѕРІ РёСЃРїРѕР»СЊР·СѓР№С‚Рµ СЂР°Р·РґРµР»РёС‚РµР»Рё `|` РёР»Рё `;` (РЅР°РїСЂРёРјРµСЂ, images Рё moderatorEmails).
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="file"
                    accept=".csv,.json"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    onChange={(e) => setImportEventsFile(e.target.files?.[0] || null)}
                  />
                  <select
                    className="px-3 py-2 border rounded-lg text-sm"
                    value={importEventsMode}
                    onChange={(e) => setImportEventsMode(e.target.value as any)}
                  >
                    <option value="upsert">РћР±РЅРѕРІР»СЏС‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ</option>
                    <option value="create">РўРѕР»СЊРєРѕ РЅРѕРІС‹Рµ</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={handleImportEvents}
                    disabled={importingEvents}
                  >
                    {importingEvents ? 'РРјРїРѕСЂС‚...' : 'РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadEventsTemplate}>
                    РЁР°Р±Р»РѕРЅ CSV
                  </Button>
                </div>
                {importEventsResult && (
                  <div className="text-sm text-gray-600">
                    РЎРѕР·РґР°РЅРѕ: {importEventsResult.created || 0}, РѕР±РЅРѕРІР»РµРЅРѕ: {importEventsResult.updated || 0}, РїСЂРѕРїСѓС‰РµРЅРѕ: {importEventsResult.skipped || 0}, РѕС€РёР±РѕРє: {importEventsResult.errors?.length || 0}, РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№: {importEventsResult.warnings?.length || 0}
                  </div>
                )}
                {importEventsResult?.errors?.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1">
                    {importEventsResult.errors.slice(0, 5).map((err: string, idx: number) => (
                      <div key={`${err}-${idx}`}>{err}</div>
                    ))}
                    {importEventsResult.errors.length > 5 && (
                      <div>... РµС‰С‘ {importEventsResult.errors.length - 5} РѕС€РёР±РѕРє</div>
                    )}
                  </div>
                )}
              </div>
              <div className="liquid-card p-4 flex flex-wrap gap-3 items-center">
                <input
                  className="flex-grow px-4 py-2 rounded-lg border border-gray-200"
                  placeholder="РџРѕРёСЃРє РїРѕ РЅР°Р·РІР°РЅРёСЋ РёР»Рё РѕРїРёСЃР°РЅРёСЋ"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                />
                <select className="px-3 py-2 border rounded-lg" value={eventCategory} onChange={(e) => setEventCategory(e.target.value)}>
                  <option value="ALL">Р’СЃРµ РєР°С‚РµРіРѕСЂРёРё</option>
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select className="px-3 py-2 border rounded-lg" value={eventStatus} onChange={(e) => setEventStatus(e.target.value as any)}>
                  <option value="ALL">Р’СЃРµ</option>
                  <option value="UPCOMING">Р‘СѓРґСѓС‰РёРµ</option>
                  <option value="PAST">РџСЂРѕС€РµРґС€РёРµ</option>
                </select>
                <Button variant="secondary" onClick={fetchEvents}>РќР°Р№С‚Рё</Button>
                <Button variant="secondary" onClick={handleExportEvents}>Р­РєСЃРїРѕСЂС‚ CSV</Button>
              </div>

              <div className="bg-white rounded-2xl shadow p-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">РќР°Р·РІР°РЅРёРµ</th>
                      <th>РљР°С‚РµРіРѕСЂРёСЏ</th>
                      <th>Р”Р°С‚Р°</th>
                      <th>РЎС‚Р°С‚СѓСЃ</th>
                      <th>РЎРѕР·РґР°С‚РµР»СЊ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id} className="border-t">
                        <td className="py-2">{event.title}</td>
                        <td>{categoryLabelMap[event.category] || event.category}</td>
                        <td>{new Date(event.date).toLocaleDateString('ru-RU')}</td>
                        <td>{event.isPast ? 'РџСЂРѕС€РµРґС€РµРµ' : 'Р‘СѓРґСѓС‰РµРµ'}</td>
                        <td>{event.creator?.name || event.creator?.email}</td>
                        <td className="text-right space-x-2">
                          <button className="text-accent" onClick={() => {
                            setSelectedEvent({
                              ...event,
                              date: normalizeDateValue(event.date)
                            })
                            setSelectedNews(null)
                          }}>
                            Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                          </button>
                          <button className="text-red-600" onClick={() => handleDeleteEvent(event.id)}>РЈРґР°Р»РёС‚СЊ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedNews && (
              <div className="bg-white rounded-2xl shadow p-4 space-y-3">
                <h3 className="font-semibold">Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РЅРѕРІРѕСЃС‚Рё</h3>
                {selectedNews.hasReport && (
                  <div className="text-xs text-gray-500">
                    РњР°С‚РµСЂРёР°Р» СЃРѕР·РґР°РЅ РЅР° РѕСЃРЅРѕРІРµ РѕС‚С‡С‘С‚Р° вЂ” Р±СѓРґРµС‚ РѕР±РЅРѕРІР»С‘РЅ С‚РµРєСЃС‚ РѕС‚С‡С‘С‚Р° Рё РґР°С‚Р° РїСѓР±Р»РёРєР°С†РёРё.
                  </div>
                )}
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={selectedNews.title}
                  onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, title: e.target.value }) : prev)}
                />
                <input
                  className="w-full px-3 py-2 border rounded"
                  type="date"
                  value={selectedNews.date}
                  onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, date: e.target.value }) : prev)}
                />
                <textarea
                  className="w-full px-3 py-2 border rounded min-h-[140px]"
                  placeholder="РўРµРєСЃС‚ РЅРѕРІРѕСЃС‚Рё"
                  value={selectedNews.content}
                  onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, content: e.target.value }) : prev)}
                />
                {selectedNews.hasReport && (
                  <textarea
                    className="w-full px-3 py-2 border rounded min-h-[90px]"
                    placeholder="Р—Р°РґР°С‡Рё (РїРѕ РѕРґРЅРѕР№ РІ СЃС‚СЂРѕРєРµ)"
                    value={selectedNews.tasks}
                    onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, tasks: e.target.value }) : prev)}
                  />
                )}
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    РР·РѕР±СЂР°Р¶РµРЅРёСЏ (РґРѕ 10 С„РѕС‚Рѕ). РњРѕР¶РЅРѕ Р·Р°РіСЂСѓР·РёС‚СЊ С„Р°Р№Р»С‹ РёР»Рё РІСЃС‚Р°РІРёС‚СЊ СЃСЃС‹Р»РєРё.
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleNewsImageUpload}
                    className="w-full px-3 py-2 border rounded"
                    disabled={selectedNewsImages.length >= 10}
                  />
                  {selectedNewsImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedNewsImages.map((img, index) => (
                        <div key={`${selectedNews.id}-img-${index}`} className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`news-${index}`}
                            className="w-full h-24 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewsImage(index)}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm"
                            title="РЈРґР°Р»РёС‚СЊ С„РѕС‚Рѕ"
                          >
                            Г—
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 border rounded min-h-[90px]"
                  placeholder="РР·РѕР±СЂР°Р¶РµРЅРёСЏ (URL РїРѕ СЃС‚СЂРѕРєР°Рј РёР»Рё С‡РµСЂРµР· |)"
                  value={selectedNews.images}
                  onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, images: e.target.value }) : prev)}
                />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleUpdateNews} disabled={savingNews}>
                    {savingNews ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ'}
                  </Button>
                  <Button variant="danger" onClick={() => handleDeleteNews(selectedNews.id)}>
                    РЈРґР°Р»РёС‚СЊ
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedNews(null)}>РћС‚РјРµРЅР°</Button>
                </div>
              </div>
            )}

            {selectedEvent && (
              <div className="bg-white rounded-2xl shadow p-4 space-y-3">
                <h3 className="font-semibold">Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ</h3>
                <input className="w-full px-3 py-2 border rounded" value={selectedEvent.title} onChange={(e) => setSelectedEvent(prev => prev ? ({ ...prev, title: e.target.value }) : prev)} />
                <input className="w-full px-3 py-2 border rounded" value={selectedEvent.location || ''} onChange={(e) => setSelectedEvent(prev => prev ? ({ ...prev, location: e.target.value }) : prev)} />
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={selectedEvent.category}
                  onChange={(e) => setSelectedEvent(prev => prev ? ({ ...prev, category: e.target.value }) : prev)}
                >
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input className="w-full px-3 py-2 border rounded" type="date" value={selectedEvent.date} onChange={(e) => setSelectedEvent(prev => prev ? ({ ...prev, date: e.target.value }) : prev)} />
                <input className="w-full px-3 py-2 border rounded" value={selectedEvent.time || ''} onChange={(e) => setSelectedEvent(prev => prev ? ({ ...prev, time: e.target.value }) : prev)} />
                <input className="w-full px-3 py-2 border rounded" type="number" min="0" value={selectedEvent.maxParticipants ?? 0} onChange={(e) => setSelectedEvent(prev => prev ? ({ ...prev, maxParticipants: Number(e.target.value) || 0 }) : prev)} />
                <input
                  className="w-full px-3 py-2 border rounded"
                  placeholder="РњРѕРґРµСЂР°С‚РѕСЂС‹ (email С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ)"
                  value={selectedEvent.moderators.map(m => m.email).join(', ')}
                  onChange={(e) => setSelectedEvent(prev => prev ? ({
                    ...prev,
                    moderators: parseModeratorEmails(e.target.value).map(email => ({ id: email, email, name: null }))
                  }) : prev)}
                />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleUpdateEvent}>РЎРѕС…СЂР°РЅРёС‚СЊ</Button>
                  <Button variant="secondary" onClick={() => setSelectedEvent(null)}>РћС‚РјРµРЅР°</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="liquid-card p-4 flex flex-wrap gap-3 items-center">
              <input className="px-3 py-2 border rounded" placeholder="Action (РЅР°РїСЂРёРјРµСЂ, EVENT_UPDATE)" value={logAction} onChange={(e) => setLogAction(e.target.value)} />
              <input className="px-3 py-2 border rounded" placeholder="EntityType (User/Event)" value={logEntityType} onChange={(e) => setLogEntityType(e.target.value)} />
              <Button variant="secondary" onClick={fetchLogs}>РќР°Р№С‚Рё</Button>
              <Button variant="secondary" onClick={handleExportLogs}>Р­РєСЃРїРѕСЂС‚ CSV</Button>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm text-gray-500 mb-3">РџРѕСЃР»РµРґРЅРёРµ РґРµР№СЃС‚РІРёСЏ (РґРѕ 100 Р·Р°РїРёСЃРµР№)</div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString('ru-RU')}
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-gray-800">{log.action}</div>
                      <button
                        type="button"
                        className="text-xs text-accent hover:text-primary"
                        onClick={() => setExpandedLogId(prev => prev === log.id ? null : log.id)}
                      >
                        {expandedLogId === log.id ? 'РЎРєСЂС‹С‚СЊ' : 'РџРѕРґСЂРѕР±РЅРѕСЃС‚Рё'}
                      </button>
                    </div>
                    <div className="text-sm text-gray-600">
                      {log.entityType}{log.entityId ? `: ${log.entityId}` : ''}
                    </div>
                    {log.actor && (
                      <div className="text-xs text-gray-500 mt-1">
                        РђРІС‚РѕСЂ: {log.actor.name || log.actor.email} ({log.actor.role})
                      </div>
                    )}
                    {expandedLogId === log.id && (() => {
                      const details = buildLogDetails(log)
                      return (
                        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
                          {details.lines.map((line, idx) => (
                            <div key={`${log.id}-detail-${idx}`}>{line}</div>
                          ))}
                          {details.metaPreview && (
                            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-gray-500">
                              {details.metaPreview}
                            </pre>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
