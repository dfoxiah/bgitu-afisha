/**
 * File responsibility:
 * Events workspace page for teachers/admins to create, edit and complete events.
 *
 * Main logic:
 * - Display upcoming/past tabs
 * - Control event form and completion modal
 * - Delegate all data mutations to AppContext actions
 *
 * Integrations:
 * - src/components/events/EventForm.tsx
 * - src/components/events/CompleteEventModal.tsx
 * - src/contexts/AppContext.tsx
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAppContext } from '@/contexts/AppContext'
import EventCard from '@/components/events/EventCard'
import EventForm from '@/components/events/EventForm'
import CompleteEventModal from '@/components/events/CompleteEventModal'
import Button from '@/components/ui/Button'
import { Event } from '@/types'
import { showToast } from '@/lib/toast'
import type { CompleteEventDto, CreateEventDto } from '@/types/dto'

export default function EventsPage() {
  const { data: session } = useSession()
  const { createEvent, updateEvent, completeEvent, upcomingEvents, pastEvents } = useAppContext()

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [completingEvent, setCompletingEvent] = useState<Event | null>(null)
  const [completionEffect, setCompletionEffect] = useState(false)
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current)
      }
    }
  }, [])

  const triggerCompletionEffect = () => {
    setCompletionEffect(true)
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current)
    }
    completionTimeoutRef.current = setTimeout(() => setCompletionEffect(false), 1800)
  }

  const handleFormSubmit = async (formData: CreateEventDto) => {
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, formData)
      } else {
        await createEvent(formData)
      }
      setShowForm(false)
      setEditingEvent(null)
    } catch (error) {
      console.error('Event save error:', error)
      showToast('Произошла ошибка при сохранении мероприятия', 'error')
    }
  }

  const handleComplete = async (reportData: CompleteEventDto) => {
    if (completingEvent) {
      try {
        await completeEvent(completingEvent.id, reportData)
        triggerCompletionEffect()
        setCompletingEvent(null)
      } catch (error) {
        console.error('Event complete error:', error)
        showToast('Произошла ошибка при завершении мероприятия', 'error')
      }
    }
  }

  const handleEditClick = (event: Event) => {
    const canModerate =
      session?.user?.role === 'ADMIN' ||
      event.creatorId === session?.user?.id ||
      (event.moderators || []).some((moderator) => moderator.id === session?.user?.id)

    if (!canModerate) {
      showToast('Нет прав на редактирование этого мероприятия', 'error')
      return
    }

    setEditingEvent(event)
    setShowForm(true)
  }

  const handleCompleteClick = (event: Event) => {
    const canModerate =
      session?.user?.role === 'ADMIN' ||
      event.creatorId === session?.user?.id ||
      (event.moderators || []).some((moderator) => moderator.id === session?.user?.id)

    if (!canModerate) {
      showToast('Нет прав на завершение этого мероприятия', 'error')
      return
    }

    setCompletingEvent(event)
  }

  const handleCreateClick = () => {
    setEditingEvent(null)
    setShowForm(true)
  }

  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'
  const activeCollection = activeTab === 'upcoming' ? upcomingEvents : pastEvents

  const todayCount = useMemo(() => {
    const today = new Date().toDateString()
    return upcomingEvents.filter((event) => new Date(event.date).toDateString() === today).length
  }, [upcomingEvents])

  const pendingRequests = useMemo(
    () => upcomingEvents.reduce((acc, event) => acc + (event.pendingParticipants?.length || 0), 0),
    [upcomingEvents]
  )

  const completionRate = useMemo(() => {
    const total = upcomingEvents.length + pastEvents.length
    if (total === 0) return 0
    return Math.round((pastEvents.length / total) * 100)
  }, [upcomingEvents.length, pastEvents.length])

  return (
    <div className="events-page page-shell px-4 py-8 md:px-[5%]">
      {completionEffect && <div className="completion-celebration" aria-hidden="true" />}

      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid items-start gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="page-hero p-4 sm:p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">Events Workspace</p>
            <h1 className="section-title page-title mt-2 text-2xl font-bold sm:text-3xl md:text-4xl">
              Управление мероприятиями в одном окне
            </h1>
            <p className="page-subtitle mt-3 text-sm sm:text-base">
              Публикуйте анонсы, модерируйте участников и закрывайте события с итоговым отчетом. Раздел обновлен как рабочее пространство с быстрым доступом к основным операциям.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {isTeacher && (
                <Button variant="primary" icon="plus" onClick={handleCreateClick} className="px-5 py-2.5 text-sm sm:text-base">
                  Создать мероприятие
                </Button>
              )}
              <Button
                variant="secondary"
                icon="calendar-days"
                className="px-5 py-2.5 text-sm"
                onClick={() => setActiveTab('upcoming')}
              >
                Смотреть ближайшие
              </Button>
            </div>
          </article>

          <aside className="liquid-section grid gap-2 p-3.5 sm:grid-cols-3 xl:grid-cols-1">
            <article className="liquid-card px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/56">Событий сегодня</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{todayCount}</p>
            </article>

            <article className="liquid-card px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/56">Заявок на модерации</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{pendingRequests}</p>
            </article>

            <article className="liquid-card px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/56">Закрыто успешно</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{completionRate}%</p>
            </article>
          </aside>
        </section>

        <section className="liquid-section p-3 sm:p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="events-tabs flex flex-wrap gap-2">
              <button
                className={`events-tab rounded-full px-4 py-2 text-sm font-medium sm:px-6 sm:text-base ${
                  activeTab === 'upcoming' ? 'bg-gradient-to-r from-primary to-accent text-white shadow-[0_10px_20px_rgba(36,88,198,0.28)]' : ''
                }`}
                onClick={() => setActiveTab('upcoming')}
              >
                Ближайшие ({upcomingEvents.length})
              </button>

              <button
                className={`events-tab rounded-full px-4 py-2 text-sm font-medium sm:px-6 sm:text-base ${
                  activeTab === 'past' ? 'bg-gradient-to-r from-primary to-accent text-white shadow-[0_10px_20px_rgba(36,88,198,0.28)]' : ''
                }`}
                onClick={() => setActiveTab('past')}
              >
                Прошедшие ({pastEvents.length})
              </button>
            </div>

            <div className="rounded-full border border-primary/14 bg-white/78 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary/62">
              Активный режим: {activeTab === 'upcoming' ? 'Планирование' : 'Архив и отчеты'}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            {activeCollection.length === 0 ? (
              <div className="page-empty">
                <i className={`fas ${activeTab === 'upcoming' ? 'fa-calendar-plus' : 'fa-clock-rotate-left'} mb-4 text-4xl text-primary/25`} />
                <h3 className="mb-2 text-xl font-semibold text-primary/75">
                  {activeTab === 'upcoming' ? 'Нет запланированных мероприятий' : 'Нет завершенных мероприятий'}
                </h3>
                <p className="text-primary/60">
                  {activeTab === 'upcoming'
                    ? 'Создайте первое событие или дождитесь публикации новых.'
                    : 'Когда мероприятие будет закрыто, оно появится в этом разделе.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeCollection.map((event, index) => (
                  <div key={event.id} className={index === 0 ? 'md:col-span-2 lg:col-span-2' : ''}>
                    <EventCard
                      event={event}
                      onEdit={activeTab === 'upcoming' ? handleEditClick : undefined}
                      onComplete={activeTab === 'upcoming' ? handleCompleteClick : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-[124px] xl:h-fit">
            <section className="liquid-section p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Панель контроля</h2>
              <ul className="mt-3 space-y-2 text-sm text-primary/72">
                <li className="rounded-lg border border-primary/12 bg-white/80 px-3 py-2">Следите за заявками в карточках ближайших событий.</li>
                <li className="rounded-lg border border-primary/12 bg-white/80 px-3 py-2">После завершения сразу добавляйте отчет и фото.</li>
                <li className="rounded-lg border border-primary/12 bg-white/80 px-3 py-2">Используйте архив как базу для новостной ленты.</li>
              </ul>
            </section>

            {isTeacher && (
              <section className="liquid-section p-4">
                <p className="text-sm text-primary/72">Нужно быстро опубликовать новое событие?</p>
                <Button variant="primary" icon="plus" onClick={handleCreateClick} className="mt-3 w-full justify-center py-2.5 text-sm">
                  Открыть форму
                </Button>
              </section>
            )}
          </aside>
        </section>
      </div>

      {showForm && (
        <EventForm
          event={editingEvent}
          onClose={() => {
            setShowForm(false)
            setEditingEvent(null)
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      {completingEvent && <CompleteEventModal event={completingEvent} onClose={() => setCompletingEvent(null)} onSubmit={handleComplete} />}
    </div>
  )
}
