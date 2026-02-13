/**
 * File responsibility:
 * Dashboard section listing near-future events.
 *
 * Main logic:
 * - Render upcoming events subset.
 * - Provide navigation actions for registration/details.
 *
 * Integrations:
 * - Dashboard page
 * - EventCard/UI components
 */
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
      <section className="upcoming-events liquid-section p-5 sm:p-6 lg:p-8 mx-4 sm:mx-[5%] my-4">
        <h2 className="section-title text-lg sm:text-2xl text-primary mb-5 sm:mb-6 flex items-center gap-3">
          <i className="fas fa-clock"></i> Ближайшие мероприятия
        </h2>
        <div className="text-center py-8 sm:py-12 text-gray-500">
          <i className="fas fa-calendar-plus text-4xl sm:text-5xl mb-3 sm:mb-4"></i>
          <p className="text-base sm:text-xl">Ближайших мероприятий на неделю нет</p>
        </div>
      </section>
    )
  }

  return (
    <section className="upcoming-events liquid-section p-5 sm:p-6 lg:p-8 mx-4 sm:mx-[5%] my-4">
      <h2 className="section-title text-lg sm:text-2xl text-primary mb-5 sm:mb-6 flex items-center gap-3">
        <i className="fas fa-clock"></i> Ближайшие мероприятия
      </h2>
      
      <div className="upcoming-events-grid space-y-4">
        {weekEvents.slice(0, 5).map(event => (
          <div 
            key={event.id} 
            className="upcoming-event-card flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/70 backdrop-blur-xl rounded-xl border border-white/70 cursor-pointer hover:border-accent hover:shadow-lg transition-all"
            onClick={() => router.push(`/events/${event.id}`)}
          >
            <div className="upcoming-event-date bg-accent text-white rounded-lg p-2.5 sm:p-3 min-w-14 sm:min-w-16 text-center">
              <div className="upcoming-event-day text-xl sm:text-2xl font-bold">
                {new Date(event.date).getDate()}
              </div>
              <div className="upcoming-event-month text-xs uppercase">
                {new Date(event.date).toLocaleDateString('ru-RU', { month: 'short' })}
              </div>
            </div>
            
            <div className="upcoming-event-content ml-0 sm:ml-4 flex-grow">
              <h3 className="upcoming-event-title text-base sm:text-lg font-semibold text-primary mb-1 sm:mb-2">
                {event.title}
              </h3>
              <div className="upcoming-event-meta flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-2">
                <span><i className="fas fa-clock mr-1"></i> {event.time}</span>
                <span><i className="fas fa-map-marker-alt mr-1"></i> {event.location}</span>
              </div>
              <div className="upcoming-event-category inline-block px-2.5 sm:px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] sm:text-xs font-medium">
                {CategoryDisplayMap[event.category as EventCategory] || event.category}
              </div>
            </div>
            
            <div className="upcoming-event-arrow text-gray-400 hidden sm:block">
              <i className="fas fa-chevron-right"></i>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default UpcomingEvents

