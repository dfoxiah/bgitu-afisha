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

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const formatOperationLabel = (action: string) => {
  if (action.includes('CREATE')) return 'Создание'
  if (action.includes('UPDATE')) return 'Изменение'
  if (action.includes('DELETE')) return 'Удаление'
  if (action.includes('IMPORT')) return 'Импорт'
  if (action.includes('NOTIFY')) return 'Уведомление'
  return 'Действие'
}

const buildLogDetails = (log: AuditLog) => {
  const lines: string[] = []
  const meta = log.metadata && typeof log.metadata === 'object' ? log.metadata : null

  lines.push(`Операция: ${formatOperationLabel(log.action)}`)

  if (meta && Array.isArray((meta as any).updatedFields)) {
    const fields = (meta as any).updatedFields as string[]
    if (fields.length > 0) {
      lines.push(`Изменено: ${fields.join(', ')}`)
    }
  }

  if (meta && typeof (meta as any).moderatorsUpdated === 'boolean') {
    lines.push(`Модераторы обновлены: ${(meta as any).moderatorsUpdated ? 'да' : 'нет'}`)
  }

  if (meta && typeof (meta as any).created === 'number') {
    lines.push(`Создано: ${(meta as any).created}`)
  }
  if (meta && typeof (meta as any).updated === 'number') {
    lines.push(`Обновлено: ${(meta as any).updated}`)
  }
  if (meta && typeof (meta as any).skipped === 'number') {
    lines.push(`Пропущено: ${(meta as any).skipped}`)
  }
  if (meta && typeof (meta as any).errors === 'number') {
    lines.push(`Ошибок: ${(meta as any).errors}`)
  }
  if (meta && typeof (meta as any).warnings === 'number') {
    lines.push(`Предупреждений: ${(meta as any).warnings}`)
  }

  if (meta && typeof (meta as any).email === 'string') {
    lines.push(`Email: ${(meta as any).email}`)
  }
  if (meta && typeof (meta as any).role === 'string') {
    lines.push(`Роль: ${(meta as any).role}`)
  }
  if (meta && typeof (meta as any).count === 'number') {
    lines.push(`Количество: ${(meta as any).count}`)
  }
  if (meta && typeof (meta as any).recipients === 'string') {
    lines.push(`Получатели: ${(meta as any).recipients}`)
  }
  if (meta && typeof (meta as any).scope === 'string') {
    lines.push(`Область: ${(meta as any).scope}`)
  }

  return { lines, meta }
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
  const [userPassword, setUserPassword] = useState('')
  const [savingNews, setSavingNews] = useState(false)
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
      { value: 'CONCERT', label: 'Концерт' },
      { value: 'INTERNAL_ACTIVITY', label: 'Внутривузовская активность' },
      { value: 'PUBLIC_EVENT', label: 'Общественное мероприятие' },
      { value: 'COMPETITION', label: 'Соревнование' },
      { value: 'LECTURE', label: 'Лекция' },
      { value: 'MASTERCLASS', label: 'Мастер-класс' },
      { value: 'VOLUNTEER', label: 'Волонтёрская активность' },
      { value: 'NEWS', label: 'Новость' }
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
      showToast(error.message || 'Ошибка загрузки пользователей', 'error')
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
      showToast(error.message || 'Ошибка загрузки мероприятий', 'error')
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
      showToast(error.message || 'Ошибка загрузки новостей', 'error')
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
      showToast(error.message || 'Ошибка загрузки логов', 'error')
    } finally {
      setLoading(false)
    }
  }, [logAction, logEntityType, readJson])

  const resolveContentType = (file: File) => (
    file.name.toLowerCase().endsWith('.json') ? 'application/json' : 'text/csv'
  )

  const handleImportUsers = useCallback(async () => {
    if (!importUsersFile) {
      showToast('Выберите файл для импорта пользователей', 'error')
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
      showToast('Импорт пользователей завершён', 'success')
    } catch (error: any) {
      showToast(error.message || 'Ошибка импорта пользователей', 'error')
    } finally {
      setImportingUsers(false)
    }
  }, [importUsersFile, importUsersMode, readJson, fetchUsers])

  const handleImportEvents = useCallback(async () => {
    if (!importEventsFile) {
      showToast('Выберите файл для импорта мероприятий', 'error')
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
      showToast('Импорт мероприятий завершён', 'success')
    } catch (error: any) {
      showToast(error.message || 'Ошибка импорта мероприятий', 'error')
    } finally {
      setImportingEvents(false)
    }
  }, [importEventsFile, importEventsMode, readJson, fetchEvents])

  const handleImportNews = useCallback(async () => {
    if (!importNewsFile) {
      showToast('Выберите файл для импорта новостной ленты', 'error')
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
      showToast('Импорт новостной ленты завершён', 'success')
    } catch (error: any) {
      showToast(error.message || 'Ошибка импорта новостей', 'error')
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
      showToast(error.message || 'Ошибка загрузки новости', 'error')
    }
  }, [readJson])

  const handleUpdateNews = async () => {
    if (!selectedNews) return
    const trimmedTitle = selectedNews.title.trim()
    const trimmedContent = selectedNews.content.trim()
    if (!trimmedTitle) {
      showToast('Укажите заголовок новости', 'error')
      return
    }
    if (!selectedNews.date) {
      showToast('Укажите дату публикации', 'error')
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
      showToast('Новость обновлена', 'success')
      setSelectedNews(null)
      await fetchNews()
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'Ошибка обновления новости', 'error')
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
      showToast('Пользователь создан', 'success')
      setNewUser({ name: '', email: '', password: '', role: 'STUDENT', department: '', group: '' })
      await fetchUsers()
    } catch (error: any) {
      showToast(error.message || 'Ошибка создания пользователя', 'error')
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
      showToast('Пользователь обновлён', 'success')
      setSelectedUser(null)
      setUserPassword('')
      await fetchUsers()
    } catch (error: any) {
      showToast(error.message || 'Ошибка обновления пользователя', 'error')
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Удалить пользователя?')) return
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      await readJson(res)
      showToast('Пользователь удалён', 'success')
      await fetchUsers()
    } catch (error: any) {
      showToast(error.message || 'Ошибка удаления пользователя', 'error')
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
      showToast('Мероприятие обновлено', 'success')
      setSelectedEvent(null)
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'Ошибка обновления мероприятия', 'error')
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
      showToast('Не удалось загрузить изображения', 'error')
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

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Удалить мероприятие?')) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
      await readJson(res)
      showToast('Мероприятие удалено', 'success')
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'Ошибка удаления мероприятия', 'error')
    }
  }

  const handleDeleteNews = async (id: string) => {
    if (!confirm('Удалить новость?')) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
      await readJson(res)
      showToast('Новость удалена', 'success')
      setSelectedNews(null)
      await fetchNews()
      await fetchEvents()
    } catch (error: any) {
      showToast(error.message || 'Ошибка удаления новости', 'error')
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
        showToast('Нет новостей для экспорта', 'error')
        return
      }
      downloadCsv(`news-${new Date().toISOString().slice(0, 10)}.csv`, eventImportHeaders, rows)
    } catch (error: any) {
      showToast(error.message || 'Ошибка экспорта новостей', 'error')
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
          <p className="text-gray-700">Недостаточно прав для доступа к админ‑панели</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
          >
            На главную
          </button>
        </div>
      </div>
    )
  }

  const selectedNewsImages = selectedNews ? parseImageList(selectedNews.images) : []

  return (
    <div className="min-h-screen bg-light-gray px-4 md:px-5% py-8">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Админ‑панель</h1>
            <p className="text-sm text-gray-500">Управление пользователями, мероприятиями и аудит‑логами</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => {
              if (activeTab === 'users') fetchUsers()
              if (activeTab === 'events') fetchEvents()
              if (activeTab === 'logs') fetchLogs()
            }} disabled={loading}>
              Обновить
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
              {tab === 'users' ? 'Пользователи' : tab === 'events' ? 'Мероприятия' : 'Логи'}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="liquid-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-primary">Импорт пользователей</h3>
                  <div className="text-xs text-gray-500">CSV или JSON</div>
                </div>
                <div className="text-xs text-gray-500 break-all">
                  Формат CSV: {userImportHeaders.join('; ')}. Разделитель `;`, кодировка UTF-8.
                </div>
                <div className="text-xs text-gray-500">
                  Поле `password` опционально. Если пусто, пользователь не сможет войти по паролю.
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
                    <option value="upsert">Обновлять существующих</option>
                    <option value="create">Только новые</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={handleImportUsers}
                    disabled={importingUsers}
                  >
                    {importingUsers ? 'Импорт...' : 'Импортировать'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadUsersTemplate}>
                    Шаблон CSV
                  </Button>
                </div>
                {importUsersResult && (
                  <div className="text-sm text-gray-600">
                    Создано: {importUsersResult.created || 0}, обновлено: {importUsersResult.updated || 0}, пропущено: {importUsersResult.skipped || 0}, ошибок: {importUsersResult.errors?.length || 0}, предупреждений: {importUsersResult.warnings?.length || 0}
                  </div>
                )}
                {importUsersResult?.errors?.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1">
                    {importUsersResult.errors.slice(0, 5).map((err: string, idx: number) => (
                      <div key={`${err}-${idx}`}>{err}</div>
                    ))}
                    {importUsersResult.errors.length > 5 && (
                      <div>... ещё {importUsersResult.errors.length - 5} ошибок</div>
                    )}
                  </div>
                )}
              </div>
              <div className="liquid-card p-4 flex flex-wrap gap-3 items-center">
                <input
                  className="flex-grow px-4 py-2 rounded-lg border border-gray-200"
                  placeholder="Поиск по имени, email, группе"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value as any)}
                >
                  <option value="ALL">Все роли</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="TEACHER">TEACHER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <Button variant="secondary" onClick={fetchUsers}>Найти</Button>
                <Button variant="secondary" onClick={handleExportUsers}>Экспорт CSV</Button>
              </div>

              <div className="bg-white rounded-2xl shadow p-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">Имя</th>
                      <th>Email</th>
                      <th>Роль</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-t">
                        <td className="py-2">{user.name || '—'}</td>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td className="text-right space-x-2">
                          <button className="text-accent" onClick={() => {
                            setSelectedUser(user)
                            setUserPassword('')
                          }}>
                            Редактировать
                          </button>
                          <button className="text-red-600" onClick={() => handleDeleteUser(user.id)}>Удалить</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-semibold mb-3">Создать пользователя</h3>
                <div className="space-y-3">
                  <input className="w-full px-3 py-2 border rounded" placeholder="Имя" value={newUser.name} onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))} />
                  <input className="w-full px-3 py-2 border rounded" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} />
                  <input className="w-full px-3 py-2 border rounded" placeholder="Пароль" type="password" value={newUser.password} onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))} />
                  <select className="w-full px-3 py-2 border rounded" value={newUser.role} onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}>
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <input className="w-full px-3 py-2 border rounded" placeholder="Кафедра/факультет" value={newUser.department} onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))} />
                  <input className="w-full px-3 py-2 border rounded" placeholder="Группа" value={newUser.group} onChange={(e) => setNewUser(prev => ({ ...prev, group: e.target.value }))} />
                  <Button variant="primary" onClick={handleCreateUser}>Создать</Button>
                </div>
              </div>

              {selectedUser && (
                <div className="bg-white rounded-2xl shadow p-4">
                  <h3 className="font-semibold mb-3">Редактирование</h3>
                  <div className="space-y-3">
                    <input className="w-full px-3 py-2 border rounded" value={selectedUser.name || ''} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, name: e.target.value }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" value={selectedUser.email} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, email: e.target.value }) : prev)} />
                    <select className="w-full px-3 py-2 border rounded" value={selectedUser.role} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, role: e.target.value as AdminUser['role'] }) : prev)}>
                      <option value="STUDENT">STUDENT</option>
                      <option value="TEACHER">TEACHER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <input className="w-full px-3 py-2 border rounded" placeholder="Кафедра" value={selectedUser.department || ''} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, department: e.target.value }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" placeholder="Группа" value={selectedUser.group || ''} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, group: e.target.value }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" placeholder="Счётчик смен группы" value={selectedUser.groupChangeCount} onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, groupChangeCount: Number(e.target.value) || 0 }) : prev)} />
                    <input className="w-full px-3 py-2 border rounded" placeholder="Новый пароль (необязательно)" type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={handleUpdateUser}>Сохранить</Button>
                      <Button variant="secondary" onClick={() => { setSelectedUser(null); setUserPassword('') }}>Отмена</Button>
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
                  <h3 className="font-semibold text-primary">Импорт новостной ленты</h3>
                  <div className="text-xs text-gray-500">CSV или JSON</div>
                </div>
                <div className="text-xs text-gray-500 break-all">
                  Формат CSV: {eventImportHeaders.join('; ')}. Разделитель `;`, кодировка UTF-8.
                </div>
                <div className="text-xs text-gray-500">
                  Для новостей `isNews` выставляется автоматически. Если `category` пустая, используется `NEWS`.
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
                    <option value="upsert">Обновлять существующие</option>
                    <option value="create">Только новые</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={handleImportNews}
                    disabled={importingNews}
                  >
                    {importingNews ? 'Импорт...' : 'Импортировать'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadNewsTemplate}>
                    Шаблон CSV
                  </Button>
                  <Button variant="secondary" onClick={handleExportNews}>
                    Экспорт CSV
                  </Button>
                </div>
                {importNewsResult && (
                  <div className="text-sm text-gray-600">
                    Создано: {importNewsResult.created || 0}, обновлено: {importNewsResult.updated || 0}, пропущено: {importNewsResult.skipped || 0}, ошибок: {importNewsResult.errors?.length || 0}, предупреждений: {importNewsResult.warnings?.length || 0}
                  </div>
                )}
                {importNewsResult?.errors?.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1">
                    {importNewsResult.errors.slice(0, 5).map((err: string, idx: number) => (
                      <div key={`${err}-${idx}`}>{err}</div>
                    ))}
                    {importNewsResult.errors.length > 5 && (
                      <div>... ещё {importNewsResult.errors.length - 5} ошибок</div>
                    )}
                  </div>
                )}
              </div>
              <div className="liquid-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-primary">Редактор новостей</h3>
                  <div className="text-xs text-gray-500">Редактирование материалов ленты</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    className="flex-grow px-3 py-2 border rounded-lg"
                    placeholder="Поиск по новостям"
                    value={newsSearch}
                    onChange={(e) => setNewsSearch(e.target.value)}
                  />
                  <Button variant="secondary" onClick={fetchNews} disabled={newsLoading}>
                    {newsLoading ? 'Загрузка...' : 'Найти'}
                  </Button>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 overflow-auto max-h-[360px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 px-3">Название</th>
                        <th className="px-3">Категория</th>
                        <th className="px-3">Дата</th>
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
                              Редактировать
                            </button>
                          </td>
                        </tr>
                      ))}
                      {newsItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-gray-500">
                            Нет новостей по выбранным условиям
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="liquid-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-primary">Импорт мероприятий</h3>
                  <div className="text-xs text-gray-500">CSV или JSON</div>
                </div>
                <div className="text-xs text-gray-500 break-all">
                  Формат CSV: {eventImportHeaders.join('; ')}. Разделитель `;`, кодировка UTF-8.
                </div>
                <div className="text-xs text-gray-500">
                  Поле `creatorEmail` опционально — если пусто, создателем станет текущий администратор.
                </div>
                <div className="text-xs text-gray-500">
                  Для списков используйте разделители `|` или `;` (например, images и moderatorEmails).
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
                    <option value="upsert">Обновлять существующие</option>
                    <option value="create">Только новые</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={handleImportEvents}
                    disabled={importingEvents}
                  >
                    {importingEvents ? 'Импорт...' : 'Импортировать'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadEventsTemplate}>
                    Шаблон CSV
                  </Button>
                </div>
                {importEventsResult && (
                  <div className="text-sm text-gray-600">
                    Создано: {importEventsResult.created || 0}, обновлено: {importEventsResult.updated || 0}, пропущено: {importEventsResult.skipped || 0}, ошибок: {importEventsResult.errors?.length || 0}, предупреждений: {importEventsResult.warnings?.length || 0}
                  </div>
                )}
                {importEventsResult?.errors?.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1">
                    {importEventsResult.errors.slice(0, 5).map((err: string, idx: number) => (
                      <div key={`${err}-${idx}`}>{err}</div>
                    ))}
                    {importEventsResult.errors.length > 5 && (
                      <div>... ещё {importEventsResult.errors.length - 5} ошибок</div>
                    )}
                  </div>
                )}
              </div>
              <div className="liquid-card p-4 flex flex-wrap gap-3 items-center">
                <input
                  className="flex-grow px-4 py-2 rounded-lg border border-gray-200"
                  placeholder="Поиск по названию или описанию"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                />
                <select className="px-3 py-2 border rounded-lg" value={eventCategory} onChange={(e) => setEventCategory(e.target.value)}>
                  <option value="ALL">Все категории</option>
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select className="px-3 py-2 border rounded-lg" value={eventStatus} onChange={(e) => setEventStatus(e.target.value as any)}>
                  <option value="ALL">Все</option>
                  <option value="UPCOMING">Будущие</option>
                  <option value="PAST">Прошедшие</option>
                </select>
                <Button variant="secondary" onClick={fetchEvents}>Найти</Button>
                <Button variant="secondary" onClick={handleExportEvents}>Экспорт CSV</Button>
              </div>

              <div className="bg-white rounded-2xl shadow p-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">Название</th>
                      <th>Категория</th>
                      <th>Дата</th>
                      <th>Статус</th>
                      <th>Создатель</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id} className="border-t">
                        <td className="py-2">{event.title}</td>
                        <td>{categoryLabelMap[event.category] || event.category}</td>
                        <td>{new Date(event.date).toLocaleDateString('ru-RU')}</td>
                        <td>{event.isPast ? 'Прошедшее' : 'Будущее'}</td>
                        <td>{event.creator?.name || event.creator?.email}</td>
                        <td className="text-right space-x-2">
                          <button className="text-accent" onClick={() => {
                            setSelectedEvent({
                              ...event,
                              date: normalizeDateValue(event.date)
                            })
                            setSelectedNews(null)
                          }}>
                            Редактировать
                          </button>
                          <button className="text-red-600" onClick={() => handleDeleteEvent(event.id)}>Удалить</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedNews && (
              <div className="bg-white rounded-2xl shadow p-4 space-y-3">
                <h3 className="font-semibold">Редактирование новости</h3>
                {selectedNews.hasReport && (
                  <div className="text-xs text-gray-500">
                    Материал создан на основе отчёта — будет обновлён текст отчёта и дата публикации.
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
                  placeholder="Текст новости"
                  value={selectedNews.content}
                  onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, content: e.target.value }) : prev)}
                />
                {selectedNews.hasReport && (
                  <textarea
                    className="w-full px-3 py-2 border rounded min-h-[90px]"
                    placeholder="Задачи (по одной в строке)"
                    value={selectedNews.tasks}
                    onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, tasks: e.target.value }) : prev)}
                  />
                )}
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    Изображения (до 10 фото). Можно загрузить файлы или вставить ссылки.
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
                            title="Удалить фото"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <textarea
                  className="w-full px-3 py-2 border rounded min-h-[90px]"
                  placeholder="Изображения (URL по строкам или через |)"
                  value={selectedNews.images}
                  onChange={(e) => setSelectedNews(prev => prev ? ({ ...prev, images: e.target.value }) : prev)}
                />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleUpdateNews} disabled={savingNews}>
                    {savingNews ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  <Button variant="danger" onClick={() => handleDeleteNews(selectedNews.id)}>
                    Удалить
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedNews(null)}>Отмена</Button>
                </div>
              </div>
            )}

            {selectedEvent && (
              <div className="bg-white rounded-2xl shadow p-4 space-y-3">
                <h3 className="font-semibold">Редактирование мероприятия</h3>
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
                  placeholder="Модераторы (email через запятую)"
                  value={selectedEvent.moderators.map(m => m.email).join(', ')}
                  onChange={(e) => setSelectedEvent(prev => prev ? ({
                    ...prev,
                    moderators: parseModeratorEmails(e.target.value).map(email => ({ id: email, email, name: null }))
                  }) : prev)}
                />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleUpdateEvent}>Сохранить</Button>
                  <Button variant="secondary" onClick={() => setSelectedEvent(null)}>Отмена</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="liquid-card p-4 flex flex-wrap gap-3 items-center">
              <input className="px-3 py-2 border rounded" placeholder="Action (например, EVENT_UPDATE)" value={logAction} onChange={(e) => setLogAction(e.target.value)} />
              <input className="px-3 py-2 border rounded" placeholder="EntityType (User/Event)" value={logEntityType} onChange={(e) => setLogEntityType(e.target.value)} />
              <Button variant="secondary" onClick={fetchLogs}>Найти</Button>
              <Button variant="secondary" onClick={handleExportLogs}>Экспорт CSV</Button>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm text-gray-500 mb-3">Последние действия (до 100 записей)</div>
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
                        {expandedLogId === log.id ? 'Скрыть' : 'Подробности'}
                      </button>
                    </div>
                    <div className="text-sm text-gray-600">
                      {log.entityType}{log.entityId ? `: ${log.entityId}` : ''}
                    </div>
                    {log.actor && (
                      <div className="text-xs text-gray-500 mt-1">
                        Автор: {log.actor.name || log.actor.email} ({log.actor.role})
                      </div>
                    )}
                    {expandedLogId === log.id && (() => {
                      const details = buildLogDetails(log)
                      return (
                        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
                          {details.lines.map((line, idx) => (
                            <div key={`${log.id}-detail-${idx}`}>{line}</div>
                          ))}
                          {details.meta && (
                            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-gray-500">
                              {JSON.stringify(details.meta, null, 2)}
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
