// bgitu-afisha/src/components/events/DayEventsModal.tsx

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <h3 className="text-xl font-semibold text-primary mb-5 flex items-center gap-3">
        <i className="fas fa-calendar-day"></i> События на {date?.toLocaleDateString('ru-RU')}
      </h3>
      
      {events.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <i className="fas fa-calendar-times text-3xl mb-3"></i>
          <p>На этот день нет мероприятий</p>
        </div>
      ) : (
        <div className="events-list space-y-3 max-h-80 overflow-y-auto">
          {events.map(event => (
            <div 
              key={event.id}
              className="event-item liquid-card liquid-card-hover p-4 cursor-pointer"
              onClick={() => {
                router.push(`/events/${event.id}`)
                onClose()
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-primary mb-2">{event.title}</h4>
                  <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 text-sm text-gray-500">
                    <span><i className="fas fa-clock"></i> {event.time}</span>
                    <span><i className="fas fa-map-marker-alt"></i> {event.location}</span>
                  </div>
                </div>
                <span className="liquid-chip px-3 py-1 text-xs text-primary self-start sm:self-auto">
                  {CategoryDisplayMap[event.category as EventCategory] || event.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <Button
        onClick={onClose}
        variant="secondary"
        fullWidth
        className="mt-6"
      >
        Закрыть
      </Button>
    </Modal>
  )
}

export default DayEventsModal
