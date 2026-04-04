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

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Event } from '@/types'
import { EventCategory, CategoryReverseMap } from '@/types'
import { showToast } from '@/lib/toast'
import type { CreateEventDto } from '@/types/dto'

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
  maxParticipants: number
  participants: string[]
  moderators: string[]
  responsible: string
  responsibleId: string
  contact: string
  images: EventImagePreview[]
}

interface EventFormProps {
  event?: Event | null
  onClose: () => void
  onSubmit: (formData: CreateEventDto) => void
}

type ResponsibleOption = {
  id: string
  name: string
  email: string
}

const EventForm = ({ event, onClose, onSubmit }: EventFormProps) => {
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
    maxParticipants: 0,
    participants: [] as string[],
    moderators: [] as string[],
    responsible: '',
    responsibleId: '',
    contact: '',
    images: []
  })
  
  const [newParticipant, setNewParticipant] = useState('')
  const [newModerator, setNewModerator] = useState('')
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([])
  const pendingEmails = event?.pendingParticipants?.map(p => p.email) || []
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
      if (session?.user?.role !== 'TEACHER' && session?.user?.role !== 'ADMIN') {
        setResponsibleOptions([])
        return
      }

      try {
        const [teachersResponse, adminsResponse] = await Promise.all([
          fetch('/api/users?role=TEACHER', { cache: 'no-store' }),
          fetch('/api/users?role=ADMIN', { cache: 'no-store' }),
        ])

        if (!teachersResponse.ok || !adminsResponse.ok) {
          throw new Error('Failed to load responsible users')
        }

        const [teachersRaw, adminsRaw] = await Promise.all([
          teachersResponse.json(),
          adminsResponse.json(),
        ])

        const rows = [...(teachersRaw as Array<Record<string, unknown>>), ...(adminsRaw as Array<Record<string, unknown>>)]
        const unique = new Map<string, ResponsibleOption>()
        rows.forEach((row) => {
          const id = String(row.id || '').trim()
          if (!id) return
          const email = String(row.email || '').trim()
          const name = String(row.name || '').trim() || email
          unique.set(id, { id, name, email })
        })

        const options = Array.from(unique.values()).sort((left, right) =>
          left.name.localeCompare(right.name, 'ru-RU')
        )
        if (active) setResponsibleOptions(options)
      } catch {
        if (active) setResponsibleOptions([])
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
        maxParticipants: event.maxParticipants || 0,
        participants: event.participants?.map(p => p.email) || [],
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
        maxParticipants: 0,
        participants: [],
        moderators: [],
        responsible: session?.user?.name || '',
        responsibleId:
          session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'
            ? session.user.id || ''
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

    const normalized = formData.responsible.trim().toLowerCase()
    const matched = responsibleOptions.find((option) => option.name.trim().toLowerCase() === normalized)
    if (!matched) return

    setFormData((prev) => ({
      ...prev,
      responsibleId: matched.id,
      contact: prev.contact || matched.email,
    }))
  }, [formData.responsible, formData.responsibleId, responsibleOptions])

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
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleAddParticipant = () => {
    const email = newParticipant.trim()
    if (!email) return

    if (pendingEmails.includes(email)) {
      showToast('Этот участник уже ожидает подтверждения', 'error')
      return
    }

    if (!formData.participants.includes(email)) {
      setFormData(prev => ({
        ...prev,
        participants: [...prev.participants, email]
      }))
      setNewParticipant('')
    }
  }

  const handleRemoveParticipant = (participant: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participant)
    }))
  }

  const handleAddModerator = () => {
    const email = newModerator.trim()
    if (!email) return

    if (!formData.moderators.includes(email)) {
      setFormData(prev => ({
        ...prev,
        moderators: [...prev.moderators, email]
      }))
      setNewModerator('')
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
    
    // Форматируем данные для отправки
    const submitData: CreateEventDto = {
      title: formData.title.trim(),
      category: formData.category,
      date: formData.date,
      time: formData.time,
      duration: formData.duration,
      location: formData.location.trim(),
      description: formData.description.trim(),
      maxParticipants: formData.maxParticipants,
      participants: formData.participants,
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

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      title={event ? "Редактирование мероприятия" : "Создание мероприятия"}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
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

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="form-group">
                <label className="form-label">Руководитель (выбор по ФИО)</label>
                <select
                  name="responsibleId"
                  value={formData.responsibleId}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                >
                  <option value="">Выберите руководителя</option>
                  {responsibleOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Можно выбрать преподавателя/администратора и ФИО подставится автоматически.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">ФИО руководителя *</label>
                <input
                  type="text"
                  name="responsible"
                  value={formData.responsible}
                  onChange={handleChange}
                  className="w-full px-4 py-3 liquid-input"
                  placeholder="Иванов Иван Иванович"
                  required
                />
              </div>
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

            <div className="form-group">
              <label className="form-label">Модераторы (преподаватели)</label>
              <p className="mb-2 text-xs text-gray-500">
                Добавьте преподавателей, которые получат права модерации мероприятия.
              </p>
              {canManageModerators ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={newModerator}
                      onChange={(e) => setNewModerator(e.target.value)}
                      className="w-full sm:flex-grow px-4 py-3 liquid-input"
                      placeholder="email преподавателя"
                    />
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
                      {formData.moderators.map((moderator, index) => (
                        <div key={index} className="flex items-center justify-between border-b border-primary/12 p-3 last:border-b-0">
                          <span className="font-medium">{moderator}</span>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => handleRemoveModerator(moderator)}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="liquid-card p-3 text-sm text-gray-600">
                  {formData.moderators.length === 0 ? 'Модераторы не назначены' : (
                    <ul className="space-y-2">
                      {formData.moderators.map((moderator, index) => (
                        <li key={index}>{moderator}</li>
                      ))}
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

            <div className="form-group">
              <label className="form-label">Изображения (до 10 фото)</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-4 py-3 liquid-input"
                disabled={formData.images.length >= 10}
              />
              {formData.images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {formData.images.map((img, index) => (
                    <div key={index} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Preview ${index}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-sm text-white"
                        title="Удалить"
                      >
                        ×
                      </button>
                      <div className="truncate bg-black/70 p-2 text-xs text-white">
                        {img.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'participants' && (
          <div className="editor-section space-y-4">
            <div className="form-group">
              <label className="form-label">Добавить участника по email</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
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
                        <span className="font-medium">{participant}</span>
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
                      <span className="font-medium text-gray-700">{email}</span>
                      <span className="text-xs uppercase text-amber-600">pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="editor-actions mt-8 flex flex-col gap-3 border-t border-primary/12 pt-6 sm:flex-row sm:justify-end">
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
    </Modal>
  )
}

export default EventForm




