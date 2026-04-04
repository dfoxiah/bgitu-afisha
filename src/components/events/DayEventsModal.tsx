/**
 * File responsibility:
 * Modal with events for a specific selected day.
 *
 * Main logic:
 * - Render day-level event list.
 * - Provide quick navigation to event details.
 *
 * Integrations:
 * - Calendar.tsx
 * - Event card/detail routes
 */

'use client'

import { useRouter } from 'next/navigation'
import { Event, CategoryDisplayMap } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { EventCategory } from '@prisma/client'

interface DayEventsModalProps {
  isOpen: boolean
  onClose: () => void
  events: Event[]
  date: Date | null
}

const DayEventsModal = ({ isOpen, onClose, events, date }: DayEventsModalProps) => {
  const router = useRouter()

  if (!isOpen) return null

  const dayLabel = date ? date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'выбранную дату'

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" title={`События на ${dayLabel}`}>
      {events.length === 0 ? (
        <div className="liquid-card py-10 text-center text-gray-500">
          <i className="fas fa-calendar-times mb-3 text-3xl" />
          <p>На этот день нет мероприятий</p>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-primary/14 bg-white/80 px-3 py-2.5 text-sm text-primary/68">
            Найдено событий: <span className="font-semibold text-primary">{events.length}</span>
          </div>

          <div className="events-list max-h-[54vh] space-y-3 overflow-y-auto pr-1">
            {events.map((event) => (
              <article
                key={event.id}
                className="event-item liquid-card liquid-card-hover cursor-pointer p-4"
                onClick={() => {
                  router.push(`/events/${event.id}`)
                  onClose()
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h4 className="line-clamp-1 text-base font-semibold text-primary">{event.title}</h4>
                    <div className="mt-1.5 flex flex-col gap-1.5 text-sm text-primary/65 sm:flex-row sm:gap-4">
                      <span>
                        <i className="fas fa-clock mr-1" /> {event.time}
                      </span>
                      <span className="line-clamp-1">
                        <i className="fas fa-map-marker-alt mr-1" /> {event.location}
                      </span>
                    </div>
                  </div>

                  <span className="liquid-chip self-start px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary sm:self-auto">
                    {CategoryDisplayMap[event.category as EventCategory] || event.category}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <Button onClick={onClose} variant="secondary" fullWidth className="mt-6">
        Закрыть
      </Button>
    </Modal>
  )
}

export default DayEventsModal
