/**
 * File responsibility:
 * Modal with aggregated events for selected month.
 *
 * Main logic:
 * - Render month-level grouped events.
 * - Allow transition to day/detail views.
 *
 * Integrations:
 * - Calendar.tsx
 * - Event list/detail components
 */

'use client'

import { useRouter } from 'next/navigation'
import { Event, CategoryDisplayMap } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { EventCategory } from '@prisma/client'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface MonthEventsModalProps {
  isOpen: boolean
  onClose: () => void
  events: Event[]
  month: Date
}

const MonthEventsModal = ({ isOpen, onClose, events, month }: MonthEventsModalProps) => {
  const router = useRouter()

  if (!isOpen) return null

  const currentMonth = format(month, 'LLLL yyyy', { locale: ru })

  const eventsByDate = events.reduce(
    (acc, event) => {
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
      const dateKey = eventDate.toISOString().split('T')[0]
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(event)
      return acc
    },
    {} as Record<string, Event[]>
  )

  const sortedDates = Object.keys(eventsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={`Все события за ${currentMonth}`}>
      {events.length === 0 ? (
        <div className="liquid-card py-10 text-center text-gray-500">
          <i className="fas fa-calendar-times mb-4 text-4xl" />
          <p>Нет событий на этот месяц</p>
        </div>
      ) : (
        <div className="events-list max-h-[56vh] space-y-5 overflow-y-auto pr-1">
          {sortedDates.map((date) => {
            const currentDate = new Date(date)

            return (
              <section key={date} className="liquid-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-primary/12 pb-2.5">
                  <h4 className="text-base font-semibold text-primary">
                    {currentDate.toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h4>

                  <span className="liquid-chip px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                    {eventsByDate[date].length} шт.
                  </span>
                </div>

                <div className="space-y-2">
                  {eventsByDate[date].map((event) => {
                    const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
                    const categoryDisplayName = CategoryDisplayMap[event.category as EventCategory] || event.category

                    return (
                      <article
                        key={event.id}
                        className="event-item rounded-xl border border-primary/14 bg-white/84 p-3 transition-colors hover:bg-primary/5"
                      >
                        <button
                          type="button"
                          className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between"
                          onClick={() => {
                            router.push(`/events/${event.id}`)
                            onClose()
                          }}
                        >
                          <div className="min-w-0 flex-grow">
                            <h5 className="line-clamp-1 text-sm font-semibold text-primary sm:text-base">{event.title}</h5>
                            <div className="mt-1.5 flex flex-col gap-1 text-xs text-primary/64 sm:flex-row sm:gap-4 sm:text-sm">
                              <span>
                                <i className="fas fa-clock mr-1" />
                                {event.time}
                              </span>
                              <span className="line-clamp-1">
                                <i className="fas fa-map-marker-alt mr-1" />
                                {event.location}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-row items-start gap-2 sm:flex-col sm:items-end">
                            <span className="liquid-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary sm:text-[11px]">
                              {categoryDisplayName}
                            </span>
                            <span className="text-xs text-primary/56">
                              {eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Button onClick={onClose} variant="secondary" fullWidth className="mt-6">
        Закрыть
      </Button>
    </Modal>
  )
}

export default MonthEventsModal
