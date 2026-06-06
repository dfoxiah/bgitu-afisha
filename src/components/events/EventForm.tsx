/**
 * File responsibility:
 * Create/edit event form with participant/moderator and image management.
 *
 * Main logic:
 * - Keep local editable form state
 * - Validate required event fields and date-time constraints
 * - Convert view-state into `CreateEventDto` for submit handlers
 *
 * Integrations:
 * - src/components/events/page.tsx
 * - src/app/events/create/page.tsx
 */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Event } from '@/types'
import { EventCategory, CategoryReverseMap } from '@/types'
import { showToast } from '@/lib/toast'
import type { CreateEventDto } from '@/types/dto'
import { isContentManagerRole, isModeratorRole, toRoleLabel } from '@/lib/roles'

interface EventImagePreview {
  url: string
  name: string
  size: string
}

interface EventFormState {
  title: string
  category: EventCategory
  date: string
  time: string
  duration: string
  location: string
  description: string
  maxParticipants: string
  requiresApproval: boolean
  participants: string[]
  participantGroups: string[]
  moderators: string[]
  responsible: string
  responsibleId: string
  contact: string
  images: EventImagePreview[]
}

interface EventFormProps {
  isOpen?: boolean
  event?: Event | null
  onClose: () => void
  onSubmit: (formData: CreateEventDto) => void
  variant?: 'modal' | 'page'
}

type DirectoryUserOption = {
  id: string
  name: string
  email: string
  role: string
  department: string
  group: string
}

type ResponsibleOption = DirectoryUserOption

type ParticipantOption = DirectoryUserOption

const PICKER_RESULT_LIMIT = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

const normalizeSearch = (value: string) => value.trim().toLowerCase()

const getDirectoryMeta = (option: DirectoryUserOption) =>
  [toRoleLabel(option.role), option.group, option.department].filter(Boolean)

const matchesDirectoryQuery = (option: DirectoryUserOption, query: string) => {
  const normalizedQuery = normalizeSearch(query)
  if (!normalizedQuery) return true

  return [option.name, option.email, option.group, option.department, toRoleLabel(option.role)]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedQuery))
}

const EventForm = ({ isOpen = false, event, onClose, onSubmit, variant = 'modal' }: EventFormProps) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'participants'>('basic')
  const { data: session } = useSession()
  const [formData, setFormData] = useState<EventFormState>({
    title: '',
    category: 'PUBLIC_EVENT' as EventCategory,
    date: '',
    time: '10:00',
    duration: '2 часа',
    location: '',
    description: '',
    maxParticipants: '',
    requiresApproval: true,
    participants: [] as string[],
    participantGroups: [] as string[],
    moderators: [] as string[],
    responsible: '',
    responsibleId: '',
    contact: '',
    images: []
  })
  
  const [newParticipant, setNewParticipant] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [participantQuery, setParticipantQuery] = useState('')
  const [isResponsiblePickerOpen, setIsResponsiblePickerOpen] = useState(false)
  const [isParticipantPickerOpen, setIsParticipantPickerOpen] = useState(false)
  const [isModeratorPickerOpen, setIsModeratorPickerOpen] = useState(false)
  const [newModerator, setNewModerator] = useState('')
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([])
  const [participantOptions, setParticipantOptions] = useState<ParticipantOption[]>([])
  const pendingEmails = useMemo(() => event?.pendingParticipants?.map(p => p.email) || [], [event?.pendingParticipants])
  const canManageModerators =
    !event || session?.user?.role === 'ADMIN' || event.creatorId === session?.user?.id

  const formatLocalDate = (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const formatLocalTime = (date: Date) => {
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }

  useEffect(() => {
    let active = true

    const loadResponsibleOptions = async () => {
      if (!isContentManagerRole(session?.user?.role)) {
        setResponsibleOptions([])
        setParticipantOptions([])
        return
      }

      try {
        const [teachersResponse, editorsResponse, adminsResponse, studentsResponse] = await Promise.all([
          fetch('/api/users?role=TEACHER', { cache: 'no-store' }),
          fetch('/api/users?role=EDITOR', { cache: 'no-store' }),
          fetch('/api/users?role=ADMIN', { cache: 'no-store' }),
          fetch('/api/users?role=STUDENT', { cache: 'no-store' }),
        ])

        if (!teachersResponse.ok || !editorsResponse.ok || !adminsResponse.ok || !studentsResponse.ok) {
          throw new Error('Failed to load responsible users')
        }

        const [teachersRaw, editorsRaw, adminsRaw, studentsRaw] = await Promise.all([
          teachersResponse.json(),
          editorsResponse.json(),
          adminsResponse.json(),
          studentsResponse.json(),
        ])

        const rows = [
          ...(teachersRaw as Array<Record<string, unknown>>),
          ...(editorsRaw as Array<Record<string, unknown>>),
          ...(adminsRaw as Array<Record<string, unknown>>),
          ...(studentsRaw as Array<Record<string, unknown>>),
        ]
        const responsibleUnique = new Map<string, ResponsibleOption>()
        const participantUnique = new Map<string, ParticipantOption>()
        rows.forEach((row) => {
          const id = String(row.id || '').trim()
          if (!id) return
          const email = String(row.email || '').trim()
          const name = String(row.name || '').trim() || email
          const role = String(row.role || '').trim().toUpperCase()

          const option = {
            id,
            name,
            email,
            role,
            department: String(row.department || '').trim(),
            group: String(row.group || '').trim(),
          }

          if (isModeratorRole(role)) {
            responsibleUnique.set(id, option)
          }

          participantUnique.set(id, option)
        })

        const options = Array.from(responsibleUnique.values()).sort((left, right) =>
          left.name.localeCompare(right.name, 'ru-RU')
        )
        const participants = Array.from(participantUnique.values()).sort((left, right) =>
          left.name.localeCompare(right.name, 'ru-RU')
        )
        if (active) {
          setResponsibleOptions(options)
          setParticipantOptions(participants)
        }
      } catch {
        if (active) {
          setResponsibleOptions([])
          setParticipantOptions([])
        }
      }
    }

    void loadResponsibleOptions()

    return () => {
      active = false
    }
  }, [session?.user?.role])

  useEffect(() => {
    if (event) {
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
      setFormData({
        title: event.title,
        category: event.category,
        date: formatLocalDate(eventDate),
        time: event.time || '10:00',
        duration: event.duration || '2 часа',
        location: event.location,
        description: event.description,
        maxParticipants: event.maxParticipants ? String(event.maxParticipants) : '',
        requiresApproval: event.requiresApproval ?? true,
        participants: event.participants?.map(p => p.email) || [],
        participantGroups: [],
        moderators: event.moderators?.map(m => m.email) || [],
        responsible: event.responsible || '',
        responsibleId: '',
        contact: event.contact || '',
        images: (event.images || []).map((url, index) => ({
          url,
          name: `image-${index + 1}`,
          size: ''
        }))
      })
    } else {
      const today = new Date().toISOString().split('T')[0]
      setFormData({
        title: '',
        category: 'PUBLIC_EVENT',
        date: today,
        time: '10:00',
        duration: '2 часа',
        location: '',
        description: '',
        maxParticipants: '',
        requiresApproval: true,
        participants: [],
        participantGroups: [],
        moderators: [],
        responsible: session?.user?.name || '',
        responsibleId:
          isContentManagerRole(session?.user?.role)
            ? session?.user?.id || ''
            : '',
        contact: session?.user?.email || '',
        images: []
      })
    }
  }, [event, session?.user?.email, session?.user?.id, session?.user?.name, session?.user?.role])

  useEffect(() => {
    const today = formatLocalDate(new Date())
    if (formData.date !== today) return

    const nowTime = formatLocalTime(new Date())
    if (formData.time && formData.time < nowTime) {
      setFormData(prev => ({ ...prev, time: nowTime }))
    }
  }, [formData.date, formData.time])

  useEffect(() => {
    if (responsibleOptions.length === 0) return
    if (formData.responsibleId) return
    if (!formData.responsible.trim()) return

    const normalized = normalizeSearch(formData.responsible)
    const matched = responsibleOptions.find(
      (option) => normalizeSearch(option.name) === normalized || normalizeSearch(option.email) === normalized
    )
    if (!matched) return

    setFormData((prev) => ({
      ...prev,
      responsibleId: matched.id,
      responsible: matched.name,
      contact: prev.contact || matched.email,
    }))
  }, [formData.responsible, formData.responsibleId, responsibleOptions])

  const pendingEmailSet = useMemo(
    () => new Set(pendingEmails.map((value) => value.toLowerCase())),
    [pendingEmails]
  )

  const selectedParticipantEmailSet = useMemo(
    () => new Set(formData.participants.map((value) => value.toLowerCase())),
    [formData.participants]
  )

  const selectedParticipantGroupSet = useMemo(
    () => new Set(formData.participantGroups.map((value) => value.toLowerCase())),
    [formData.participantGroups]
  )

  const moderatorEmailSet = useMemo(
    () => new Set(formData.moderators.map((value) => value.toLowerCase())),
    [formData.moderators]
  )

  const filteredResponsibleOptions = useMemo(
    () =>
      responsibleOptions
        .filter((option) => matchesDirectoryQuery(option, formData.responsible))
        .slice(0, PICKER_RESULT_LIMIT),
    [formData.responsible, responsibleOptions]
  )

  const filteredParticipantMatches = useMemo(
    () =>
      participantOptions.filter((option) => {
        const email = option.email.toLowerCase()
        return (
          !selectedParticipantEmailSet.has(email) &&
          !pendingEmailSet.has(email) &&
          matchesDirectoryQuery(option, participantQuery)
        )
      }),
    [participantOptions, participantQuery, pendingEmailSet, selectedParticipantEmailSet]
  )

  const filteredParticipantOptions = useMemo(
    () => filteredParticipantMatches.slice(0, PICKER_RESULT_LIMIT),
    [filteredParticipantMatches]
  )

  const filteredModeratorMatches = useMemo(
    () =>
      responsibleOptions.filter((option) => {
        const email = option.email.toLowerCase()
        const ownerId = event?.creatorId || session?.user?.id || ''
        return option.id !== ownerId && !moderatorEmailSet.has(email) && matchesDirectoryQuery(option, newModerator)
      }),
    [event?.creatorId, moderatorEmailSet, newModerator, responsibleOptions, session?.user?.id]
  )

  const filteredModeratorOptions = useMemo(
    () => filteredModeratorMatches.slice(0, PICKER_RESULT_LIMIT),
    [filteredModeratorMatches]
  )

  const participantByEmail = useMemo(() => {
    const map = new Map<string, ParticipantOption>()
    participantOptions.forEach((option) => {
      map.set(option.email.toLowerCase(), option)
    })
    return map
  }, [participantOptions])

  const availableParticipantGroups = useMemo(
    () =>
      Array.from(
        new Set(
          participantOptions
            .map((option) => option.group.trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [participantOptions]
  )

  const participantGroupCounts = useMemo(() => {
    const map = new Map<string, number>()
    participantOptions.forEach((option) => {
      const group = option.group.trim()
      if (!group) return
      map.set(group, (map.get(group) || 0) + 1)
    })
    return map
  }, [participantOptions])

  const responsibleByEmail = useMemo(() => {
    const map = new Map<string, ResponsibleOption>()
    responsibleOptions.forEach((option) => {
      map.set(option.email.toLowerCase(), option)
    })
    return map
  }, [responsibleOptions])

  const selectedResponsible = useMemo(
    () => responsibleOptions.find((option) => option.id === formData.responsibleId) || null,
    [formData.responsibleId, responsibleOptions]
  )

  const categoryOptions = [
    { value: 'CONCERT', label: 'Концерт' },
    { value: 'INTERNAL_ACTIVITY', label: 'Внутривузовская активность' },
    { value: 'PUBLIC_EVENT', label: 'Общественное мероприятие' },
    { value: 'COMPETITION', label: 'Соревнование' },
    { value: 'LECTURE', label: 'Лекция' },
    { value: 'MASTERCLASS', label: 'Мастер-класс' },
    { value: 'VOLUNTEER', label: 'Волонтёрская активность' },
    { value: 'NEWS', label: 'Новость' }
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    if (name === 'category') {
      // Преобразуем русское название в enum значение
      const enumValue = CategoryReverseMap[value] || value
      setFormData(prev => ({ ...prev, [name]: enumValue }))
    } else if (name === 'responsibleId') {
      const selected = responsibleOptions.find((option) => option.id === value)
      setFormData(prev => ({
        ...prev,
        responsibleId: value,
        responsible: selected?.name || prev.responsible,
        contact: selected?.email || prev.contact,
      }))
    } else if (name === 'responsible') {
      setFormData(prev => ({ ...prev, responsible: value, responsibleId: '' }))
    } else if (name === 'maxParticipants') {
      setFormData(prev => ({ ...prev, maxParticipants: value.replace(/[^\d]/g, '') }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleAddParticipantGroup = (group: string) => {
    const normalized = group.trim()
    if (!normalized) return

    if (selectedParticipantGroupSet.has(normalized.toLowerCase())) {
      showToast('Эта группа уже добавлена', 'error')
      return
    }

    setFormData(prev => ({
      ...prev,
      participantGroups: [...prev.participantGroups, normalized],
    }))
    showToast(`Группа добавлена: ${normalized}`, 'success')
  }

  const handleRemoveParticipantGroup = (group: string) => {
    setFormData(prev => ({
      ...prev,
      participantGroups: prev.participantGroups.filter(item => item !== group),
    }))
  }

  const handleAddParticipant = () => {
    const email = newParticipant.trim().toLowerCase()
    if (!email) return

    if (!EMAIL_PATTERN.test(email)) {
      showToast('Введите корректный email участника', 'error')
      return
    }

    if (pendingEmailSet.has(email)) {
      showToast('Этот участник уже ожидает подтверждения', 'error')
      return
    }

    if (selectedParticipantEmailSet.has(email)) {
      showToast('Этот участник уже добавлен', 'error')
      return
    }

    setFormData(prev => ({
      ...prev,
      participants: [...prev.participants, email]
    }))
    setNewParticipant('')
  }

  const handleAddParticipantByOption = (selected: ParticipantOption) => {
    const email = selected.email.trim().toLowerCase()
    if (pendingEmailSet.has(email)) {
      showToast('Этот участник уже ожидает подтверждения', 'error')
      return
    }

    if (selectedParticipantEmailSet.has(email)) {
      showToast('Этот участник уже добавлен', 'error')
      return
    }

    setFormData((prev) => ({
      ...prev,
      participants: [...prev.participants, email],
    }))
    setParticipantQuery('')
    setIsParticipantPickerOpen(false)
    showToast(`Добавлен участник: ${selected.name}`, 'success')
  }

  const handleRemoveParticipant = (participant: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participant)
    }))
  }

  const handleAddModerator = () => {
    const value = newModerator.trim()
    if (!value) return

    const matched = responsibleOptions.find(
      (option) => normalizeSearch(option.name) === normalizeSearch(value) || normalizeSearch(option.email) === normalizeSearch(value)
    )

    if (matched) {
      handleAddModeratorByOption(matched)
      return
    }

    if (!EMAIL_PATTERN.test(value)) {
      showToast('Выберите преподавателя из поиска или введите email', 'error')
      return
    }

    const email = value.toLowerCase()
    if (moderatorEmailSet.has(email)) {
      showToast('Этот модератор уже добавлен', 'error')
      return
    }

    setFormData(prev => ({
      ...prev,
      moderators: [...prev.moderators, email]
    }))
    setNewModerator('')
    setIsModeratorPickerOpen(false)
  }

  const handleAddModeratorByOption = (selected: ResponsibleOption) => {
    const email = selected.email.trim().toLowerCase()
    if (moderatorEmailSet.has(email)) {
      showToast('Этот модератор уже добавлен', 'error')
      return
    }

    setFormData(prev => ({
      ...prev,
      moderators: [...prev.moderators, email]
    }))
    setNewModerator('')
    setIsModeratorPickerOpen(false)
    showToast(`Добавлен модератор: ${selected.name}`, 'success')
  }

  const handleSelectResponsible = (selected: ResponsibleOption) => {
    setFormData(prev => ({
      ...prev,
      responsible: selected.name,
      responsibleId: selected.id,
      contact: selected.email || prev.contact,
    }))
    setIsResponsiblePickerOpen(false)
  }

  const handleResponsibleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsResponsiblePickerOpen(false)
      return
    }

    if (event.key === 'Enter' && filteredResponsibleOptions.length > 0) {
      event.preventDefault()
      handleSelectResponsible(filteredResponsibleOptions[0])
    }
  }

  const handleParticipantSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsParticipantPickerOpen(false)
      return
    }

    if (event.key === 'Enter' && filteredParticipantOptions.length > 0) {
      event.preventDefault()
      handleAddParticipantByOption(filteredParticipantOptions[0])
    }
  }

  const handleModeratorSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsModeratorPickerOpen(false)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredModeratorOptions.length > 0) {
        handleAddModeratorByOption(filteredModeratorOptions[0])
      } else {
        handleAddModerator()
      }
    }
  }

  const handleRemoveModerator = (moderator: string) => {
    setFormData(prev => ({
      ...prev,
      moderators: prev.moderators.filter(m => m !== moderator)
    }))
  }

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const files = Array.from(e.target.files).slice(0, 10 - formData.images.length)
    const newImages = await Promise.all(
      files.map(async (file) => ({
        url: await readFileAsDataUrl(file),
        name: file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
      }))
    )

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newImages]
    }))

    e.target.value = ''
  }

  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleAddImageUrl = () => {
    const url = newImageUrl.trim()
    if (!url) return
    if (formData.images.length >= 10) {
      showToast('Можно добавить не больше 10 фото', 'error')
      return
    }

    setFormData(prev => ({
      ...prev,
      images: [
        ...prev.images,
        {
          url,
          name: `Фото ${prev.images.length + 1}`,
          size: 'URL',
        },
      ],
    }))
    setNewImageUrl('')
  }

  const handleUpdateImage = (index: number, updates: Partial<EventImagePreview>) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, ...updates } : image
      ),
    }))
  }

  const handleMoveImage = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= formData.images.length) return

    setFormData(prev => {
      const images = [...prev.images]
      const current = images[index]
      images[index] = images[nextIndex]
      images[nextIndex] = current
      return { ...prev, images }
    })
  }

  const handleSetCoverImage = (index: number) => {
    if (index === 0) return

    setFormData(prev => {
      const images = [...prev.images]
      const [cover] = images.splice(index, 1)
      return { ...prev, images: [cover, ...images] }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Валидация
    if (!formData.title.trim()) {
      showToast('Пожалуйста, введите название мероприятия', 'error')
      return
    }
    
    if (!formData.date) {
      showToast('Пожалуйста, выберите дату', 'error')
      return
    }
    
    if (!formData.location.trim()) {
      showToast('Пожалуйста, укажите место проведения', 'error')
      return
    }
    
    if (!formData.description.trim()) {
      showToast('Пожалуйста, добавьте описание', 'error')
      return
    }

    if (!formData.responsible.trim()) {
      showToast('Укажите руководителя мероприятия', 'error')
      return
    }

    const selectedDateTime = new Date(`${formData.date}T${formData.time || '00:00'}`)
    if (selectedDateTime.getTime() < Date.now() - 60000) {
      showToast('Нельзя выбрать прошедшую дату и время', 'error')
      return
    }
    
    const participantLimit = formData.maxParticipants.trim()
      ? Math.max(0, Math.floor(Number(formData.maxParticipants) || 0))
      : 0

    // Форматируем данные для отправки
    const submitData: CreateEventDto = {
      title: formData.title.trim(),
      category: formData.category,
      date: formData.date,
      time: formData.time,
      duration: formData.duration,
      location: formData.location.trim(),
      description: formData.description.trim(),
      maxParticipants: participantLimit,
      requiresApproval: formData.requiresApproval,
      participants: formData.participants,
      participantGroups: formData.participantGroups,
      moderators: formData.moderators,
      images: formData.images.map(img => img.url),
      responsible: formData.responsible.trim(),
      responsibleId: formData.responsibleId || undefined,
      contact: formData.contact.trim() || undefined,
    }
    
    onSubmit(submitData)
  }

  const minDate = formatLocalDate(new Date())
  const minTime = formData.date === minDate ? formatLocalTime(new Date()) : undefined

  const formContent = (
      <form onSubmit={handleSubmit} className={variant === 'page' ? 'event-form-page-form' : undefined}>
        <div className="editor-tabs mb-6 flex flex-wrap gap-2 overflow-x-auto border-b border-primary/12 sm:flex-nowrap sm:gap-0">
          <button 
            type="button"
            className={`editor-tab rounded-t-xl px-4 py-2.5 text-sm font-medium transition-colors sm:px-6 sm:py-3 sm:text-base ${activeTab === 'basic' ? 'border-b-2 border-accent bg-white/70 text-primary' : 'text-gray-500'}`}
            onClick={() => setActiveTab('basic')}
          >
            Основное
          </button>
          <button 
            type="button"
            className={`editor-tab rounded-t-xl px-4 py-2.5 text-sm font-medium transition-colors sm:px-6 sm:py-3 sm:text-base ${activeTab === 'participants' ? 'border-b-2 border-accent bg-white/70 text-primary' : 'text-gray-500'}`}
            onClick={() => setActiveTab('participants')}
          >
            Участники
          </button>
        </div>
        
        {activeTab === 'basic' && (
          <div className="editor-section space-y-4">
            <div className="form-group">
              <label className="form-label">Название мероприятия *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-3 liquid-input"
                required
                placeholder="Введите название мероприятия"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">Категория *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                  required
                >
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Максимальное количество участников</label>
                <input
                  type="number"
                  name="maxParticipants"
                  value={formData.maxParticipants}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                  min="0"
                  placeholder="0 - без ограничений"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Требуется подтверждение участников</label>
              <label className="mt-1 flex cursor-pointer items-center justify-between rounded-2xl border border-primary/14 bg-white/80 px-4 py-3 transition-colors hover:border-primary/28">
                <span className="pr-3 text-sm text-primary/78">
                  {formData.requiresApproval
                    ? 'Новые участники попадают в заявки и ждут подтверждения'
                    : 'Участники после регистрации добавляются сразу'}
                </span>
                <input
                  type="checkbox"
                  name="requiresApproval"
                  checked={formData.requiresApproval}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      requiresApproval: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-primary"
                />
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="form-group">
                <label className="form-label">Дата *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                  required
                  min={minDate}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Время начала *</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                  required
                  min={minTime}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Продолжительность</label>
                <input
                  type="text"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                  placeholder="Например, 2 часа"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Место проведения *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-3 liquid-input"
                required
                placeholder="Например, Главный корпус, ауд. 301"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
              <div className="form-group">
                <label className="form-label">Руководитель *</label>
                <div className="relative">
                  <i className="fas fa-search pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-primary/38"></i>
                  <input
                    type="text"
                    name="responsible"
                    value={formData.responsible}
                    onChange={(event) => {
                      handleChange(event)
                      setIsResponsiblePickerOpen(true)
                    }}
                    onFocus={() => setIsResponsiblePickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setIsResponsiblePickerOpen(false), 120)}
                    onKeyDown={handleResponsibleKeyDown}
                    className="w-full px-4 py-3 pl-12 liquid-input"
                    placeholder="ФИО или email руководителя"
                    required
                        autoComplete="off"
                        role="combobox"
                        aria-controls="event-responsible-picker"
                        aria-expanded={isResponsiblePickerOpen}
                      />
                      {isResponsiblePickerOpen && (
                        <div id="event-responsible-picker" role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-2xl border border-primary/14 bg-white shadow-[0_18px_42px_rgba(22,46,86,0.18)]">
                      {filteredResponsibleOptions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-primary/58">Руководитель не найден</div>
                      ) : (
                        filteredResponsibleOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className="flex w-full items-center gap-3 border-b border-primary/8 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-primary/5"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              handleSelectResponsible(option)
                            }}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <i className="fas fa-user-tie"></i>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-primary">{option.name}</span>
                              <span className="block truncate text-xs text-primary/58">{option.email}</span>
                            </span>
                            <span className="hidden max-w-[13rem] truncate text-xs text-primary/48 sm:block">
                              {getDirectoryMeta(option).join(' · ')}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedResponsible ? (
                  <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                    <i className="fas fa-check"></i>
                    <span className="truncate">{selectedResponsible.name} · {selectedResponsible.email}</span>
                  </div>
                ) : formData.responsible.trim() ? (
                  <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                    <i className="fas fa-circle-info"></i>
                    <span className="truncate">ФИО сохранится без привязки к аккаунту</span>
                  </div>
                ) : null}
              </div>

              <div className="form-group">
                <label className="form-label">Контакт руководителя</label>
                <input
                  type="text"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                  placeholder="email или телефон"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Модераторы (преподаватели)</label>
              <p className="mb-2 text-xs text-gray-500">
                Добавьте преподавателей, которые получат права модерации мероприятия.
              </p>
              {canManageModerators ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative w-full sm:flex-grow">
                      <i className="fas fa-search pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-primary/38"></i>
                      <input
                        type="text"
                        value={newModerator}
                        onChange={(event) => {
                          setNewModerator(event.target.value)
                          setIsModeratorPickerOpen(true)
                        }}
                        onFocus={() => setIsModeratorPickerOpen(true)}
                        onBlur={() => window.setTimeout(() => setIsModeratorPickerOpen(false), 120)}
                        onKeyDown={handleModeratorSearchKeyDown}
                        className="w-full px-4 py-3 pl-12 liquid-input"
                        placeholder="ФИО или email модератора"
                        autoComplete="off"
                        role="combobox"
                        aria-controls="event-moderator-picker"
                        aria-expanded={isModeratorPickerOpen}
                      />
                      {isModeratorPickerOpen && (
                        <div id="event-moderator-picker" role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-2xl border border-primary/14 bg-white shadow-[0_18px_42px_rgba(22,46,86,0.18)]">
                          {filteredModeratorOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-primary/58">Подходящих преподавателей нет</div>
                          ) : (
                            filteredModeratorOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className="flex w-full items-center gap-3 border-b border-primary/8 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-primary/5"
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  handleAddModeratorByOption(option)
                                }}
                              >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <i className="fas fa-user-shield"></i>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-primary">{option.name}</span>
                                  <span className="block truncate text-xs text-primary/58">{option.email}</span>
                                </span>
                                <span className="hidden max-w-[13rem] truncate text-xs text-primary/48 sm:block">
                                  {getDirectoryMeta(option).join(' · ')}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddModerator}
                      disabled={!newModerator.trim()}
                      className="w-full sm:w-auto"
                    >
                      Добавить
                    </Button>
                  </div>
                  {formData.moderators.length > 0 && (
                    <div className="liquid-card max-h-40 overflow-y-auto mt-3">
                      {formData.moderators.map((moderator, index) => {
                        const moderatorOption = responsibleByEmail.get(moderator.toLowerCase())

                        return (
                          <div key={index} className="flex items-center justify-between gap-3 border-b border-primary/12 p-3 last:border-b-0">
                            <div className="min-w-0">
                              <span className="block truncate font-medium text-primary">{moderatorOption?.name || moderator}</span>
                              <span className="block truncate text-xs text-primary/55">{moderator}</span>
                            </div>
                            <button
                              type="button"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-50 hover:text-red-800"
                              onClick={() => handleRemoveModerator(moderator)}
                              title="Удалить модератора"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="liquid-card p-3 text-sm text-gray-600">
                  {formData.moderators.length === 0 ? 'Модераторы не назначены' : (
                    <ul className="space-y-2">
                      {formData.moderators.map((moderator, index) => {
                        const moderatorOption = responsibleByEmail.get(moderator.toLowerCase())

                        return (
                          <li key={index}>
                            <span className="font-medium text-primary">{moderatorOption?.name || moderator}</span>
                            {moderatorOption && <span className="text-primary/55"> · {moderator}</span>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label className="form-label">Описание *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-3 liquid-input"
                rows={5}
                required
                placeholder="Подробное описание мероприятия"
              />
            </div>

            <div className="form-group event-photo-editor">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="form-label mb-0">Фото мероприятия ({formData.images.length}/10)</label>
                <span className="text-xs text-primary/55">Первое фото становится обложкой карточки</span>
              </div>

              <div className="event-photo-toolbar">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(event) => setNewImageUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleAddImageUrl()
                    }
                  }}
                  className="liquid-input px-3 py-2 text-sm"
                  placeholder="Вставьте ссылку на фото"
                  disabled={formData.images.length >= 10}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim() || formData.images.length >= 10}
                >
                  Добавить ссылку
                </Button>
              </div>

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-3 py-2 liquid-input text-sm"
                disabled={formData.images.length >= 10}
              />

              {formData.images.length > 0 ? (
                <div className="event-photo-grid">
                  {formData.images.map((img, index) => (
                    <article key={`${img.url}-${index}`} className="event-photo-card">
                      <figure>
                        {index === 0 && <span className="event-photo-cover">Обложка</span>}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.name || `Фото ${index + 1}`} />
                        <div className="event-photo-actions">
                          <button type="button" onClick={() => handleSetCoverImage(index)} title="Сделать обложкой">
                            <i className="fas fa-star" />
                          </button>
                          <button type="button" onClick={() => handleRemoveImage(index)} title="Удалить фото">
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </figure>

                      <div className="event-photo-body">
                        <input
                          type="text"
                          value={img.name}
                          onChange={(event) => handleUpdateImage(index, { name: event.target.value })}
                          placeholder="Название фото"
                        />
                        <input
                          type="text"
                          value={img.url}
                          onChange={(event) => handleUpdateImage(index, { url: event.target.value, size: 'URL' })}
                          placeholder="URL или data:image"
                        />
                        <div className="event-photo-move">
                          <button type="button" onClick={() => handleMoveImage(index, -1)} disabled={index === 0}>
                            <i className="fas fa-arrow-left" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveImage(index, 1)}
                            disabled={index === formData.images.length - 1}
                          >
                            <i className="fas fa-arrow-right" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-primary/20 bg-white/70 px-4 py-5 text-center text-sm text-primary/58">
                  Фото пока не добавлены.
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'participants' && (
          <div className="editor-section space-y-4">
            <div className="form-group">
              <label className="form-label">Добавить группу целиком</label>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <select
                  value=""
                  onChange={(event) => {
                    handleAddParticipantGroup(event.target.value)
                    event.target.value = ''
                  }}
                  className="w-full px-4 py-3 liquid-input"
                  disabled={availableParticipantGroups.length === 0}
                >
                  <option value="">
                    {availableParticipantGroups.length === 0 ? 'Группы пока не найдены' : 'Выберите группу'}
                  </option>
                  {availableParticipantGroups.map((group) => (
                    <option key={group} value={group}>
                      {group} · {participantGroupCounts.get(group) || 0} чел.
                    </option>
                  ))}
                </select>
                <span className="text-xs text-primary/55">
                  Группа будет раскрыта в участников на сервере при сохранении.
                </span>
              </div>

              {formData.participantGroups.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.participantGroups.map((group) => (
                    <span
                      key={group}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/14 bg-white px-3 py-1.5 text-sm font-medium text-primary"
                    >
                      <span className="truncate">
                        {group} · {participantGroupCounts.get(group) || 0}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-primary/55 hover:bg-primary/8 hover:text-primary"
                        onClick={() => handleRemoveParticipantGroup(group)}
                        aria-label={`Убрать группу ${group}`}
                      >
                        <i className="fas fa-times text-[10px]" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Участник из базы</label>
              <div className="relative">
                <i className="fas fa-search pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-primary/38"></i>
                <input
                  type="text"
                  value={participantQuery}
                  onChange={(event) => {
                    setParticipantQuery(event.target.value)
                    setIsParticipantPickerOpen(true)
                  }}
                  onFocus={() => setIsParticipantPickerOpen(true)}
                  onBlur={() => window.setTimeout(() => setIsParticipantPickerOpen(false), 120)}
                  onKeyDown={handleParticipantSearchKeyDown}
                  className="w-full px-4 py-3 pl-12 liquid-input"
                  placeholder="ФИО, email, группа или кафедра"
                  autoComplete="off"
                  role="combobox"
                  aria-controls="event-participant-picker"
                  aria-expanded={isParticipantPickerOpen}
                />
                {isParticipantPickerOpen && (
                  <div id="event-participant-picker" role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-2xl border border-primary/14 bg-white shadow-[0_18px_42px_rgba(22,46,86,0.18)]">
                    {filteredParticipantOptions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-primary/58">Свободных участников не найдено</div>
                    ) : (
                      <>
                        {filteredParticipantOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className="flex w-full items-center gap-3 border-b border-primary/8 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-primary/5"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              handleAddParticipantByOption(option)
                            }}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <i className="fas fa-user-plus"></i>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-primary">{option.name}</span>
                              <span className="block truncate text-xs text-primary/58">{option.email}</span>
                            </span>
                            <span className="hidden max-w-[13rem] truncate text-xs text-primary/48 sm:block">
                              {getDirectoryMeta(option).join(' · ')}
                            </span>
                          </button>
                        ))}
                        {filteredParticipantMatches.length > filteredParticipantOptions.length && (
                          <div className="border-t border-primary/8 px-4 py-2 text-xs text-primary/50">
                            Уточните запрос, найдено ещё {filteredParticipantMatches.length - filteredParticipantOptions.length}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Добавить участника по email</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleAddParticipant()
                    }
                  }}
                  className="w-full sm:flex-grow px-4 py-3 liquid-input"
                  placeholder="email@example.com"
                />
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={handleAddParticipant}
                  disabled={!newParticipant.trim()}
                  className="w-full sm:w-auto"
                >
                  Добавить
                </Button>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Список участников ({formData.participants.length})</label>
              <div className="liquid-card max-h-60 overflow-y-auto">
                {formData.participants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-users text-3xl mb-3"></i>
                    <p>Нет участников</p>
                  </div>
                ) : (
                  formData.participants.map((participant, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-primary/12 p-4 last:border-b-0">
                      <div className="participant-info">
                        <span className="font-medium">
                          {participantByEmail.get(participant.toLowerCase())?.name || participant}
                        </span>
                        <div className="text-xs text-gray-500">{participant}</div>
                      </div>
                      <button 
                        type="button" 
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleRemoveParticipant(participant)}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {pendingEmails.length > 0 && (
              <div className="form-group">
                <label className="form-label">Ожидают подтверждения ({pendingEmails.length})</label>
                <div className="liquid-card max-h-60 overflow-y-auto bg-white/70">
                  {pendingEmails.map((email, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-primary/12 p-4 last:border-b-0">
                      <div>
                        <div className="font-medium text-gray-700">
                          {participantByEmail.get(email.toLowerCase())?.name || email}
                        </div>
                        <div className="text-xs text-gray-500">{email}</div>
                      </div>
                      <span className="text-xs uppercase text-amber-600">pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="editor-actions mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button 
            type="button" 
            variant="secondary" 
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Отмена
          </Button>
          <Button 
            type="submit" 
            variant="primary"
            className="w-full sm:w-auto"
          >
            {event ? "Сохранить изменения" : "Создать мероприятие"}
          </Button>
        </div>
      </form>
  )

  if (variant === 'page') {
    return (
      <div className="event-form-page-surface">
        {formContent}
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event ? "Редактирование мероприятия" : "Создание мероприятия"}
      size="xl"
    >
      {formContent}
    </Modal>
  )
}

export default EventForm




