/**
 * File responsibility:
 * Modal to send event notifications to selected participant groups.
 *
 * Main logic:
 * - Provide message templates with token preview
 * - Validate required form fields
 * - Call AppContext notification sender with typed template mapping
 *
 * Integrations:
 * - src/contexts/AppContext.tsx sendEventNotification()
 */
'use client'

import { useMemo, useState } from 'react'
import { useAppContext } from '@/contexts/AppContext'
import Modal from './Modal'
import Button from './Button'
import { showToast } from '@/lib/toast'

interface NotificationModalProps {
  onClose: () => void
}

type NotificationTemplate = 'change' | 'custom' | 'reminder'

const isNotificationTemplate = (value: string): value is NotificationTemplate =>
  value === 'change' || value === 'custom' || value === 'reminder'

const NotificationModal = ({ onClose }: NotificationModalProps) => {
  const { events, sendEventNotification } = useAppContext()

  const templates: Record<NotificationTemplate, string> = {
    change: 'Изменение: мероприятие "[Название]" перенесено на [Дата] [Время].',
    custom: '',
    reminder: 'Напоминание: завтра в [Время] состоится мероприятие "[Название]".',
  }

  const templateTypeMap = {
    change: 'CHANGE',
    custom: 'EVENT',
    reminder: 'EVENT',
  } as const

  const [formData, setFormData] = useState({
    eventId: '',
    template: 'change' as NotificationTemplate,
    content: templates.change,
    recipients: 'all' as 'all' | 'confirmed' | 'pending',
  })

  const futureEvents = events.filter((event) => !event.isPast)
  const selectedEvent = futureEvents.find((event) => event.id === formData.eventId)

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

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target

    if (name === 'template' && isNotificationTemplate(value)) {
      setFormData((prev) => ({
        ...prev,
        template: value,
        content: templates[value],
      }))
      return
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.eventId || !formData.content.trim()) {
      showToast('Заполните обязательные поля', 'error')
      return
    }

    try {
      await sendEventNotification(
        formData.eventId,
        formData.content,
        formData.recipients,
        templateTypeMap[formData.template]
      )

      showToast('Уведомление отправлено', 'success')
      onClose()
    } catch (error) {
      console.error('Notification send error:', error)
      showToast('Не удалось отправить уведомление', 'error')
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Создать уведомление" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">Мероприятие *</label>
            <select name="eventId" value={formData.eventId} onChange={handleChange} className="liquid-input w-full px-4 py-3" required>
              <option value="">Выберите мероприятие</option>
              {futureEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Шаблон</label>
            <select name="template" value={formData.template} onChange={handleChange} className="liquid-input w-full px-4 py-3">
              <option value="change">Изменение деталей</option>
              <option value="reminder">Напоминание</option>
              <option value="custom">Свой шаблон</option>
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Получатели</label>
          <select name="recipients" value={formData.recipients} onChange={handleChange} className="liquid-input w-full px-4 py-3">
            <option value="all">Все участники</option>
            <option value="confirmed">Только подтвержденные</option>
            <option value="pending">Только ожидающие подтверждения</option>
          </select>
        </div>

        <div>
          <label className="form-label">Текст уведомления *</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            className="liquid-input w-full px-4 py-3"
            rows={5}
            required
          />
        </div>

        {formData.content && (
          <div className="liquid-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Превью</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-primary/76">{previewContent}</p>
            {!selectedEvent && <p className="mt-2 text-xs text-amber-700">Выберите мероприятие, чтобы подставить дату и время.</p>}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-primary/12 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Отмена
          </Button>
          <Button type="submit" variant="primary" className="w-full sm:w-auto">
            Отправить уведомление
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default NotificationModal
