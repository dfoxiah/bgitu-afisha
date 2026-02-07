// src/components/events/EventForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Event } from '@/types'
import { EventCategory, CategoryReverseMap } from '@/types'
import { showToast } from '@/lib/toast'

interface EventFormProps {
  event?: Event | null
  onClose: () => void
  onSubmit: (formData: any) => void
}

const EventForm = ({ event, onClose, onSubmit }: EventFormProps) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'participants'>('basic')
  const { data: session } = useSession()
  const [formData, setFormData] = useState({
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
    images: [] as Array<{ url: string; name: string; size: string }>
  })
  
  const [newParticipant, setNewParticipant] = useState('')
  const [newModerator, setNewModerator] = useState('')
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
        images: []
      })
    }
  }, [event])

  useEffect(() => {
    const today = formatLocalDate(new Date())
    if (formData.date !== today) return

    const nowTime = formatLocalTime(new Date())
    if (formData.time && formData.time < nowTime) {
      setFormData(prev => ({ ...prev, time: nowTime }))
    }
  }, [formData.date, formData.time])

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

    const selectedDateTime = new Date(`${formData.date}T${formData.time || '00:00'}`)
    if (selectedDateTime.getTime() < Date.now() - 60000) {
      showToast('Нельзя выбрать прошедшую дату и время', 'error')
      return
    }
    
    // Форматируем данные для отправки
    const submitData = {
      ...formData,
      date: formData.date,
      category: formData.category,
      moderators: formData.moderators,
      images: formData.images.map(img => img.url)
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
        <div className="editor-tabs flex border-b border-gray-200 mb-6">
          <button 
            type="button"
            className={`editor-tab px-6 py-3 font-medium transition-colors ${activeTab === 'basic' ? 'text-primary border-b-2 border-accent' : 'text-gray-500'}`}
            onClick={() => setActiveTab('basic')}
          >
            Основное
          </button>
          <button 
            type="button"
            className={`editor-tab px-6 py-3 font-medium transition-colors ${activeTab === 'participants' ? 'text-primary border-b-2 border-accent' : 'text-gray-500'}`}
            onClick={() => setActiveTab('participants')}
          >
            Участники
          </button>
        </div>
        
        {activeTab === 'basic' && (
          <div className="editor-section space-y-6">
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

            <div className="form-group">
              <label className="form-label">Модераторы (преподаватели)</label>
              <p className="text-xs text-gray-500 mb-2">
                Добавьте преподавателей, которые получат права модерации мероприятия.
              </p>
              {canManageModerators ? (
                <>
                  <div className="flex gap-3">
                    <input
                      type="email"
                      value={newModerator}
                      onChange={(e) => setNewModerator(e.target.value)}
                      className="flex-grow px-4 py-3 liquid-input"
                      placeholder="email преподавателя"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddModerator}
                      disabled={!newModerator.trim()}
                    >
                      Добавить
                    </Button>
                  </div>
                  {formData.moderators.length > 0 && (
                    <div className="liquid-card max-h-40 overflow-y-auto mt-3">
                      {formData.moderators.map((moderator, index) => (
                        <div key={index} className="flex justify-between items-center p-3 border-b border-gray-200 last:border-b-0">
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
                    <div key={index} className="relative rounded-2xl overflow-hidden border border-white/70 bg-white/70 shadow aspect-[4/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Preview ${index}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm"
                        title="Удалить"
                      >
                        ×
                      </button>
                      <div className="p-2 bg-black/70 text-white text-xs truncate">
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
          <div className="editor-section space-y-6">
            <div className="form-group">
              <label className="form-label">Добавить участника по email</label>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  className="flex-grow px-4 py-3 liquid-input"
                  placeholder="email@example.com"
                />
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={handleAddParticipant}
                  disabled={!newParticipant.trim()}
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
                    <div key={index} className="flex justify-between items-center p-4 border-b border-gray-200 last:border-b-0">
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
                    <div key={index} className="flex items-center justify-between p-4 border-b border-gray-200 last:border-b-0">
                      <span className="font-medium text-gray-700">{email}</span>
                      <span className="text-xs uppercase text-amber-600">pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="editor-actions flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
          <Button 
            type="button" 
            variant="secondary" 
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button 
            type="submit" 
            variant="primary"
          >
            {event ? "Сохранить изменения" : "Создать мероприятие"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default EventForm




