'use client'

import { useRouter } from 'next/navigation'
import { Event, CategoryDisplayMap } from '@/types'
import { EventCategory } from '@prisma/client'

interface UpcomingEventsProps {
  events: Event[]
}

const UpcomingEvents = ({ events }: UpcomingEventsProps) => {
  const router = useRouter()
  const now = new Date()
  const weekAhead = new Date(now)
  weekAhead.setDate(now.getDate() + 7)

  const weekEvents = events.filter(event => {
    try {
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
      return eventDate >= now && eventDate <= weekAhead
    } catch {
      return false
    }
  })

  if (weekEvents.length === 0) {
    return (
      <section className="upcoming-events liquid-section p-8 mx-5% my-4">
        <h2 className="section-title text-2xl text-primary mb-6 flex items-center gap-3">
          <i className="fas fa-clock"></i> Ближайшие мероприятия
        </h2>
        <div className="text-center py-12 text-gray-500">
          <i className="fas fa-calendar-plus text-5xl mb-4"></i>
          <p className="text-xl">Ближайших мероприятий на неделю нет</p>
        </div>
      </section>
    )
  }

  return (
    <section className="upcoming-events liquid-section p-8 mx-5% my-4">
      <h2 className="section-title text-2xl text-primary mb-6 flex items-center gap-3">
        <i className="fas fa-clock"></i> Ближайшие мероприятия
      </h2>
      
      <div className="upcoming-events-grid space-y-4">
        {weekEvents.slice(0, 5).map(event => (
          <div 
            key={event.id} 
            className="upcoming-event-card flex items-center p-4 bg-white/70 backdrop-blur-xl rounded-xl border border-white/70 cursor-pointer hover:border-accent hover:shadow-lg transition-all"
            onClick={() => router.push(`/events/${event.id}`)}
          >
            <div className="upcoming-event-date bg-accent text-white rounded-lg p-3 min-w-16 text-center">
              <div className="upcoming-event-day text-2xl font-bold">
                {new Date(event.date).getDate()}
              </div>
              <div className="upcoming-event-month text-xs uppercase">
                {new Date(event.date).toLocaleDateString('ru-RU', { month: 'short' })}
              </div>
            </div>
            
            <div className="upcoming-event-content ml-4 flex-grow">
              <h3 className="upcoming-event-title text-lg font-semibold text-primary mb-2">
                {event.title}
              </h3>
              <div className="upcoming-event-meta flex gap-4 text-sm text-gray-600 mb-2">
                <span><i className="fas fa-clock mr-1"></i> {event.time}</span>
                <span><i className="fas fa-map-marker-alt mr-1"></i> {event.location}</span>
              </div>
              <div className="upcoming-event-category inline-block px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium">
                {CategoryDisplayMap[event.category as EventCategory] || event.category}
              </div>
            </div>
            
            <div className="upcoming-event-arrow text-gray-400">
              <i className="fas fa-chevron-right"></i>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default UpcomingEvents
