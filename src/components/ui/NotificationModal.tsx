'use client'

import { useMemo, useState } from 'react'
import { useAppContext } from '@/contexts/AppContext'
import Modal from './Modal'
import Button from './Button'
import { showToast } from '@/lib/toast'

interface NotificationModalProps {
  onClose: () => void
}

const NotificationModal = ({ onClose }: NotificationModalProps) => {
  const { events, sendEventNotification } = useAppContext()
  const [formData, setFormData] = useState({
    eventId: '',
    template: 'change' as 'change' | 'new' | 'reminder',
    content: '',
    recipients: 'all' as 'all' | 'confirmed' | 'pending'
  })

  const futureEvents = events.filter(event => !event.isPast)
  const selectedEvent = futureEvents.find(event => event.id === formData.eventId)
  
  const templates = {
    change: 'Изменение времени: Мероприятие "[Название]" перенесено на [Дата] [Время]',
    new: 'Новое мероприятие: Приглашаем на [Название мероприятия] [Дата] [Время]',
    reminder: 'Напоминание: Завтра в [Время] состоится мероприятие "[Название]"'
  }

  const templateTypeMap = {
    change: 'CHANGE',
    new: 'NEW',
    reminder: 'EVENT'
  } as const

  const previewContent = useMemo(() => {
    if (!formData.content) return ''

    const eventDate = selectedEvent ? new Date(selectedEvent.date).toLocaleDateString('ru-RU') : '[Дата]'
    const eventTime = selectedEvent?.time || '[Время]'
    const eventTitle = selectedEvent?.title || '[Название]'

    return formData.content
      .replace(/\[Название мероприятия\]/gi, eventTitle)
      .replace(/\[Название\]/gi, eventTitle)
      .replace(/\[Дата\]/gi, eventDate)
      .replace(/\[Время\]/gi, eventTime)
  }, [formData.content, selectedEvent])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'template') {
      setFormData(prev => ({
        ...prev,
        template: value as any,
        content: templates[value as keyof typeof templates]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.eventId || !formData.content) {
      showToast("Пожалуйста, заполните все обязательные поля", 'error')
      return
    }
    
    try {
      // Исправлено: передаем eventId как string, а не number
      await sendEventNotification(
        formData.eventId, // string, а не число
        formData.content,
        formData.recipients,
        templateTypeMap[formData.template]
      )
      showToast("Уведомление успешно отправлено!", 'success')
      onClose()
    } catch (error) {
      console.error("Ошибка при отправке уведомления:", error)
      showToast("Произошла ошибка при отправке уведомления", 'error')
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Создать уведомление">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-group">
          <label className="form-label">Выберите мероприятие</label>
          <select
            name="eventId"
            value={formData.eventId}
            onChange={handleChange}
            className="liquid-input w-full px-4 py-3"
            required
          >
            <option value="">Выберите мероприятие</option>
            {futureEvents.map(event => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Шаблон уведомления</label>
          <select
            name="template"
            value={formData.template}
            onChange={handleChange}
            className="liquid-input w-full px-4 py-3"
          >
            <option value="change">Изменение деталей</option>
            <option value="new">Новое мероприятие</option>
            <option value="reminder">Напоминание</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Текст уведомления *</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            className="liquid-input w-full px-4 py-3"
            rows={4}
            required
          />
        </div>

        {formData.content && (
          <div className="liquid-card p-4">
            <div className="text-xs uppercase text-gray-500 mb-2">Превью</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {previewContent}
            </div>
            {!selectedEvent && (
              <div className="text-xs text-amber-600 mt-2">
                Выберите мероприятие, чтобы подставить дату и время.
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Получатели</label>
          <select
            name="recipients"
            value={formData.recipients}
            onChange={handleChange}
            className="liquid-input w-full px-4 py-3"
          >
            <option value="all">Все участники</option>
            <option value="confirmed">Только подтвердившие</option>
            <option value="pending">Только ожидающие подтверждения</option>
          </select>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary">
            Отправить уведомление
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default NotificationModal


