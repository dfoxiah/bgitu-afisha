// src/components/events/MonthEventsModal.tsx
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

  // Группируем события по датам (используем строку как ключ)
  const eventsByDate = events.reduce((acc, event) => {
    const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
    const dateKey = eventDate.toISOString().split('T')[0]
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(event)
    return acc
  }, {} as Record<string, Event[]>)

  const sortedDates = Object.keys(eventsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
        <i className="fas fa-calendar-alt text-accent"></i> Все события за {currentMonth}
      </h3>
      
      {events.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <i className="fas fa-calendar-times text-4xl mb-4"></i>
          <p>Нет событий на этот месяц</p>
        </div>
      ) : (
        <div className="events-list space-y-6 max-h-96 overflow-y-auto">
          {sortedDates.map(date => {
            const currentDate = new Date(date)
            return (
              <div key={date} className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b-2 border-accent">
                  {currentDate.toLocaleDateString('ru-RU', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </h4>
                
                {eventsByDate[date].map(event => {
                  const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
                  const categoryDisplayName = CategoryDisplayMap[event.category as EventCategory] || event.category
                  return (
                    <div 
                      key={event.id}
                      className="event-item liquid-card liquid-card-hover p-4 mb-3 cursor-pointer"
                      onClick={() => {
                        router.push(`/events/${event.id}`)
                        onClose()
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-grow">
                          <h5 className="font-semibold text-gray-900 mb-1">{event.title}</h5>
                          <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 text-sm text-gray-500">
                            <span><i className="fas fa-clock mr-1"></i> {event.time}</span>
                            <span><i className="fas fa-map-marker-alt mr-1"></i> {event.location}</span>
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 sm:gap-1">
                          <span className="liquid-chip px-3 py-1 text-xs text-primary">
                            {categoryDisplayName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
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

export default MonthEventsModal
