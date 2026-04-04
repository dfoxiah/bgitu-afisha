/**
 * File responsibility:
 * Modal for completing an event with a structured report payload.
 *
 * Main logic:
 * - Collect summary, tasks, active participants and report images
 * - Validate required fields before submit
 * - Convert local form state into `CompleteEventDto`
 *
 * Integrations:
 * - src/components/events/page.tsx
 * - src/contexts/AppContext.tsx completeEvent()
 */
'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Event, CategoryDisplayMap } from '@/types'
import { EventCategory } from '@prisma/client'
import { showToast } from '@/lib/toast'
import type { CompleteEventDto } from '@/types/dto'

interface ReportImagePreview {
  url: string
  name: string
  size: string
}

interface ActiveParticipantState {
  name: string
  active: boolean
}

interface CompletionFormState {
  title: string
  summary: string
  tasks: string[]
  images: ReportImagePreview[]
  activeParticipants: ActiveParticipantState[]
}

interface CompleteEventModalProps {
  event: Event
  onClose: () => void
  onSubmit: (reportData: CompleteEventDto) => void
}

const CompleteEventModal = ({ event, onClose, onSubmit }: CompleteEventModalProps) => {
  const [formData, setFormData] = useState<CompletionFormState>({
    title: `Отчет: ${event?.title || 'Мероприятие'}`,
    summary: '',
    tasks: [''],
    images: [],
    activeParticipants: event?.participants?.map(p => ({ 
      name: p.name || p.email, 
      active: true 
    })) || []
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleTaskChange = (index: number, value: string) => {
    const newTasks = [...formData.tasks]
    newTasks[index] = value
    setFormData(prev => ({ ...prev, tasks: newTasks }))
  }

  const handleAddTask = () => {
    setFormData(prev => ({ ...prev, tasks: [...prev.tasks, ''] }))
  }

  const handleRemoveTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
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

  const handleParticipantToggle = (index: number) => {
    const newParticipants = [...formData.activeParticipants]
    newParticipants[index].active = !newParticipants[index].active
    setFormData(prev => ({
      ...prev,
      activeParticipants: newParticipants
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.summary.trim()) {
      showToast('Пожалуйста, заполните описание мероприятия', 'error')
      return
    }
    
    const reportData: CompleteEventDto = {
      summary: formData.summary,
      tasks: formData.tasks.filter(task => task.trim()),
      activeParticipants: formData.activeParticipants
        .filter(p => p.active)
        .map(p => p.name),
      images: formData.images.map(img => img.url),
      reportDate: new Date().toISOString()
    }
    
    onSubmit(reportData)
  }

  const eventDate = event?.date instanceof Date ? event.date : new Date(event?.date || Date.now())
  const categoryDisplayName = CategoryDisplayMap[event?.category as EventCategory] || event?.category

  return (
    <Modal isOpen={true} onClose={onClose} title="Завершение мероприятия" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="liquid-card mb-4 border-l-4 border-accent p-3.5">
          <p className="font-semibold text-primary">Завершаем: {event?.title}</p>
          <p className="text-sm text-gray-600 mt-1">
            Категория: {categoryDisplayName} | 
            Дата: {eventDate.toLocaleDateString('ru-RU')} | 
            Участников: {event?.currentParticipants || 0}
          </p>
        </div>

        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Заголовок отчета (опционально)</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-3 liquid-input"
              placeholder="Если оставить пустым, отчет не будет опубликован как новость"
            />
            <p className="mt-2 text-sm text-gray-500">
              Оставьте пустым, если не хотите публиковать отчет как новость
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Описание мероприятия <span className="text-red-500">*</span>
            </label>
            <textarea
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              className="w-full px-4 py-3 liquid-input"
              rows={4}
              placeholder="Расскажите о том, как прошло мероприятие, что было интересного, какие результаты достигнуты..."
              required
            />
          </div>

          <div className="form-group">
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Выполненные задачи (опционально)</label>
              <button
                type="button"
                onClick={handleAddTask}
                className="text-sm text-accent hover:text-primary"
              >
                + Добавить задачу
              </button>
            </div>
            {formData.tasks.map((task, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={task}
                  onChange={(e) => handleTaskChange(index, e.target.value)}
                  className="w-full px-4 py-3 liquid-input"
                  placeholder={`Задача ${index + 1} (например: "Подготовили зал", "Зарегистрировали участников")`}
                />
                {formData.tasks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTask(index)}
                    className="text-red-600 hover:text-red-800 px-2"
                    title="Удалить задачу"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Фотоотчет (максимум 10 фото)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full px-4 py-3 liquid-input"
              disabled={formData.images.length >= 10}
            />
            {formData.images.length >= 10 && (
              <p className="text-red-500 text-sm mt-2">
                Достигнут лимит в 10 фотографий. Удалите некоторые, чтобы добавить новые.
              </p>
            )}
            
            {formData.images.length > 0 && (
              <>
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
                <div className="flex justify-between items-center text-sm text-gray-500 mt-3">
                  <span>Загружено: {formData.images.length} фото</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Удалить все фотографии?')) {
                        setFormData(prev => ({ ...prev, images: [] }))
                      }
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Удалить все
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Активные участники</label>
            <div className="liquid-card max-h-60 overflow-y-auto">
              {formData.activeParticipants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-users text-3xl mb-3"></i>
                  <p>Нет участников</p>
                </div>
              ) : (
                formData.activeParticipants.map((participant, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border-b border-gray-200 last:border-b-0">
                    <label className="flex items-center gap-3 cursor-pointer flex-grow">
                      <input
                        type="checkbox"
                        checked={participant.active}
                        onChange={() => handleParticipantToggle(index)}
                        className="w-5 h-5 text-accent rounded focus:ring-2 focus:ring-accent"
                      />
                      <span className={participant.active ? 'text-gray-800' : 'text-gray-400 line-through'}>
                        {participant.name}
                      </span>
                    </label>
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      participant.active 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {participant.active ? 'Активен' : 'Не активен'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="editor-actions mt-8 flex justify-end gap-4 border-t border-primary/12 pt-6">
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
            <i className="fas fa-check-circle mr-2"></i>
            Завершить мероприятие
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CompleteEventModal




