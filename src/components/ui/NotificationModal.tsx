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

import { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '@/contexts/AppContext'
import Modal from './Modal'
import Button from './Button'
import { showToast } from '@/lib/toast'

interface NotificationModalProps {
  isOpen?: boolean
  onClose: () => void
}

type NotificationTemplate = 'change' | 'custom' | 'reminder'
type NotificationAudience = 'participants' | 'users'
type NotificationTargetUser = {
  id: string
  name: string | null
  email: string
  group?: string | null
  department?: string | null
}

const isNotificationTemplate = (value: string): value is NotificationTemplate =>
  value === 'change' || value === 'custom' || value === 'reminder'

const toEventDateTime = (date: Date | string, time?: string) => {
  const result = new Date(date)
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    const hh = Number(match[1])
    const mm = Number(match[2])
    if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      result.setHours(hh, mm, 0, 0)
      return result
    }
  }
  result.setHours(0, 0, 0, 0)
  return result
}

const NotificationModal = ({ isOpen = false, onClose }: NotificationModalProps) => {
  const { events, sendEventNotification, cancelNotificationBroadcast } = useAppContext()

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
    audience: 'participants' as NotificationAudience,
    template: 'change' as NotificationTemplate,
    content: templates.change,
    recipients: 'all' as 'all' | 'confirmed' | 'pending',
    userIds: [] as string[],
    groups: [] as string[],
    departments: [] as string[],
  })
  const [lastBroadcast, setLastBroadcast] = useState<{
    broadcastId: string
    created: number
  } | null>(null)
  const [isCancellingBroadcast, setIsCancellingBroadcast] = useState(false)
  const [directoryUsers, setDirectoryUsers] = useState<NotificationTargetUser[]>([])
  const [directoryUsersLoading, setDirectoryUsersLoading] = useState(false)

  const futureEvents = useMemo(
    () => events.filter((event) => toEventDateTime(event.date, event.time).getTime() >= Date.now()),
    [events]
  )
  const selectedEvent = futureEvents.find((event) => event.id === formData.eventId)

  useEffect(() => {
    if (!isOpen || directoryUsers.length > 0 || directoryUsersLoading) return

    let active = true
    const loadDirectoryUsers = async () => {
      try {
        setDirectoryUsersLoading(true)
        const response = await fetch('/api/users?role=ALL', { cache: 'no-store' })
        if (!response.ok) return
        const users = (await response.json()) as NotificationTargetUser[]
        if (active) setDirectoryUsers(users)
      } finally {
        if (active) setDirectoryUsersLoading(false)
      }
    }

    void loadDirectoryUsers()
    return () => {
      active = false
    }
  }, [directoryUsers.length, directoryUsersLoading, isOpen])

  const participantPool = useMemo(() => {
    if (!selectedEvent) return []
    return [...(selectedEvent.participants || []), ...(selectedEvent.pendingParticipants || [])]
  }, [selectedEvent])

  const recipientScopePool = useMemo(() => {
    if (formData.audience === 'users') return directoryUsers
    if (!selectedEvent) return []
    if (formData.recipients === 'confirmed') return selectedEvent.participants || []
    if (formData.recipients === 'pending') return selectedEvent.pendingParticipants || []
    return participantPool
  }, [directoryUsers, formData.audience, formData.recipients, participantPool, selectedEvent])

  const availableGroups = useMemo(
    () =>
      Array.from(
        new Set(
          recipientScopePool
            .map((user) => user.group || '')
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [recipientScopePool]
  )

  const availableDepartments = useMemo(
    () =>
      Array.from(
        new Set(
          recipientScopePool
            .map((user) => user.department || '')
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [recipientScopePool]
  )

  const previewRecipients = useMemo(() => {
    const uniqueById = new Map<string, typeof recipientScopePool[number]>()
    recipientScopePool.forEach((user) => {
      if (user?.id) uniqueById.set(user.id, user)
    })

    const hasGroupFilter = formData.groups.length > 0
    const hasDepartmentFilter = formData.departments.length > 0
    const hasUserFilter = formData.userIds.length > 0
    return Array.from(uniqueById.values()).filter((user) => {
      const inUserList = !hasUserFilter || formData.userIds.includes(user.id)
      const inGroup = !hasGroupFilter || formData.groups.includes((user.group || '').trim())
      const inDepartment =
        !hasDepartmentFilter || formData.departments.includes((user.department || '').trim())
      return inUserList && inGroup && inDepartment
    })
  }, [formData.departments, formData.groups, formData.userIds, recipientScopePool])

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      userIds: prev.userIds.filter((userId) => recipientScopePool.some((user) => user.id === userId)),
      groups: prev.groups.filter((group) => availableGroups.includes(group)),
      departments: prev.departments.filter((department) => availableDepartments.includes(department)),
    }))
  }, [availableGroups, availableDepartments, recipientScopePool])

  useEffect(() => {
    if (!formData.eventId) return
    if (futureEvents.some((event) => event.id === formData.eventId)) return
    setFormData((prev) => ({ ...prev, eventId: '' }))
  }, [formData.eventId, futureEvents])

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

    if (name === 'audience') {
      setFormData((prev) => ({
        ...prev,
        audience: value === 'users' ? 'users' : 'participants',
        recipients: value === 'users' ? 'all' : prev.recipients,
        userIds: [],
        groups: [],
        departments: [],
      }))
      return
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const toggleFilterValue = (field: 'userIds' | 'groups' | 'departments', value: string) => {
    setFormData((prev) => {
      const values = prev[field]
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]
      return { ...prev, [field]: nextValues }
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.eventId || !formData.content.trim()) {
      showToast('Заполните обязательные поля', 'error')
      return
    }

    if (previewRecipients.length === 0) {
      showToast('По выбранным фильтрам нет получателей', 'error')
      return
    }

    if (
      formData.audience === 'users' &&
      formData.userIds.length === 0 &&
      formData.groups.length === 0 &&
      formData.departments.length === 0
    ) {
      showToast('Для рассылки по базе выберите людей, группы или кафедры', 'error')
      return
    }

    try {
      const result = await sendEventNotification(
        formData.eventId,
        formData.content,
        formData.recipients,
        templateTypeMap[formData.template],
        {
          audience: formData.audience,
          groups: formData.groups,
          userIds: formData.userIds,
          departments: formData.departments,
        }
      )

      setLastBroadcast({
        broadcastId: result.broadcastId,
        created: result.created,
      })
      showToast(`Уведомление отправлено (${result.created})`, 'success')
    } catch (error) {
      console.error('Notification send error:', error)
      showToast('Не удалось отправить уведомление', 'error')
    }
  }

  const handleCancelLastBroadcast = async () => {
    if (!lastBroadcast || isCancellingBroadcast) return

    try {
      setIsCancellingBroadcast(true)
      const result = await cancelNotificationBroadcast(lastBroadcast.broadcastId)
      showToast(`Рассылка отменена. Удалено уведомлений: ${result.deleted}`, 'success')
      setLastBroadcast(null)
    } catch (error) {
      console.error('Cancel broadcast error:', error)
      showToast('Не удалось отменить рассылку', 'error')
    } finally {
      setIsCancellingBroadcast(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Создать уведомление" size="md">
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
          <label className="form-label">Область рассылки</label>
          <select name="audience" value={formData.audience} onChange={handleChange} className="liquid-input w-full px-4 py-3">
            <option value="participants">Участники выбранного мероприятия</option>
            <option value="users">Пользователи по людям, группам и кафедрам</option>
          </select>
          <p className="mt-2 text-xs text-primary/60">
            {formData.audience === 'participants'
              ? 'Фильтры применяются только к записавшимся на выбранное мероприятие.'
              : 'Можно отправить группе или конкретным людям, даже если они еще не записались на мероприятие.'}
          </p>
        </div>

        {formData.audience === 'participants' ? (
          <div>
            <label className="form-label">Получатели</label>
            <select name="recipients" value={formData.recipients} onChange={handleChange} className="liquid-input w-full px-4 py-3">
              <option value="all">Все участники</option>
              <option value="confirmed">Только подтвержденные</option>
              <option value="pending">Только ожидающие подтверждения</option>
            </select>
            <p className="mt-2 text-xs text-primary/60">
              В выбранной выборке: {recipientScopePool.length} чел.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-primary/12 bg-white/75 p-3 text-xs text-primary/70">
            Загружено пользователей для выбора: {directoryUsersLoading ? 'загрузка...' : directoryUsers.length}.
            Для безопасности рассылка по всей базе без фильтров заблокирована.
          </div>
        )}

        {recipientScopePool.length > 0 && (
          <div>
            <label className="form-label">Конкретные люди</label>
            <p className="mt-1 text-xs text-primary/60">
              {formData.audience === 'participants'
                ? 'Если никого не выбрать, рассылка пойдет по всей выбранной группе получателей.'
                : 'Выберите отдельных людей или используйте фильтр по группе/кафедре ниже.'}
            </p>
            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl border border-primary/12 bg-white/80 p-2">
              {recipientScopePool.map((user) => (
                <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-primary/5">
                  <input
                    type="checkbox"
                    checked={formData.userIds.includes(user.id)}
                    onChange={() => toggleFilterValue('userIds', user.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-primary">{user.name || user.email}</span>
                    <span className="block truncate text-xs text-primary/55">
                      {user.group || 'Без группы'} • {user.email}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {(availableGroups.length > 0 || availableDepartments.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Фильтр по группам</label>
              {availableGroups.length === 0 ? (
                <p className="text-xs text-primary/60">
                  {formData.audience === 'participants' ? 'У участников не заполнены группы.' : 'У пользователей не заполнены группы.'}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableGroups.map((group) => (
                    <button
                      key={group}
                      type="button"
                      className={`liquid-chip px-3 py-1.5 text-xs ${
                        formData.groups.includes(group)
                          ? 'bg-gradient-to-r from-primary to-accent text-white'
                          : ''
                      }`}
                      onClick={() => toggleFilterValue('groups', group)}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Фильтр по факультетам/кафедрам</label>
              {availableDepartments.length === 0 ? (
                <p className="text-xs text-primary/60">
                  {formData.audience === 'participants'
                    ? 'У участников не заполнены факультеты/кафедры.'
                    : 'У пользователей не заполнены факультеты/кафедры.'}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableDepartments.map((department) => (
                    <button
                      key={department}
                      type="button"
                      className={`liquid-chip px-3 py-1.5 text-xs ${
                        formData.departments.includes(department)
                          ? 'bg-gradient-to-r from-primary to-accent text-white'
                          : ''
                      }`}
                      onClick={() => toggleFilterValue('departments', department)}
                    >
                      {department}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-primary/12 bg-white p-3 text-xs text-primary/70">
          Получателей после фильтров: <span className="font-semibold text-primary">{previewRecipients.length}</span>
          {(formData.userIds.length > 0 || formData.groups.length > 0 || formData.departments.length > 0) && (
            <span className="ml-1">
              (люди: {formData.userIds.length}, группы: {formData.groups.length}, факультеты/кафедры: {formData.departments.length})
            </span>
          )}
        </div>

        <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-3 text-xs leading-5 text-sky-900">
          <div className="font-semibold">VK после отправки</div>
          <p>
            Для доставки в ВК нужен серверный мост: сохранить VK ID у пользователя, создать VK Community API token,
            после `createMany` уведомлений вызвать очередь/route handler, который отправит `messages.send` каждому получателю.
            Нужны согласия пользователей на сообщения сообщества и обработка ошибок/лимитов.
          </p>
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

        {lastBroadcast && (
          <div className="liquid-card border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">Последняя рассылка</p>
            <p className="mt-2 text-sm text-amber-900">
              Отправлено уведомлений: {lastBroadcast.created}. Если отправка была ошибочной, отмените её.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 w-full sm:w-auto"
              onClick={handleCancelLastBroadcast}
              loading={isCancellingBroadcast}
            >
              Отменить последнюю рассылку
            </Button>
          </div>
        )}

        <div className="modal-sticky-actions flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
