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
"use client"

import { EventCategory } from "@prisma/client"
import { useRouter } from "next/navigation"
import { CategoryDisplayMap, Event } from "@/types"

interface UpcomingEventsProps {
  events: Event[]
  plain?: boolean
}

const UpcomingEvents = ({ events, plain = false }: UpcomingEventsProps) => {
  const router = useRouter()
  const now = new Date()

  const nearestEvents = events
    .filter((event) => {
      try {
        const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
        return eventDate >= now
      } catch {
        return false
      }
    })
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
    .slice(0, 6)

  return (
    <section className={plain ? "" : "liquid-section p-4 sm:p-5"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Ближайшие мероприятия</h2>
          <p className="mt-1 text-sm text-primary/62">Показываем ближайшие запланированные события.</p>
        </div>

        <span className="liquid-chip px-3 py-1 text-xs font-semibold uppercase tracking-[0.09em] text-primary/62">
          {nearestEvents.length} записей
        </span>
      </div>

      {nearestEvents.length === 0 ? (
        <div className="liquid-card py-8 text-center text-primary/62">
          <i className="fas fa-calendar-plus mb-3 text-4xl" />
          <p>Пока нет запланированных событий.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-primary/12 bg-white/82">
          {nearestEvents.map((event, index) => {
            const date = new Date(event.date)

            return (
              <article
                key={event.id}
                className={`grid cursor-pointer gap-3 px-3 py-3 transition-colors hover:bg-primary/5 sm:grid-cols-[68px_minmax(0,1fr)_auto] sm:items-center ${
                  index !== nearestEvents.length - 1 ? "border-b border-primary/12" : ""
                }`}
                onClick={() => router.push(`/events/${event.id}`)}
              >
                <div className="rounded-xl border border-primary/14 bg-white/84 px-2 py-2 text-center text-primary">
                  <div className="text-xl font-semibold leading-none">{date.getDate()}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.06em]">
                    {date.toLocaleDateString("ru-RU", { month: "short" })}
                  </div>
                </div>

                <div className="min-w-0">
                  <h3 className="line-clamp-1 text-sm font-semibold text-primary sm:text-base">{event.title}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-primary/65 sm:text-sm">
                    {event.time} • {event.location}
                  </p>
                  <div className="mt-2 inline-flex rounded-full border border-primary/14 bg-white/84 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-primary/68">
                    {CategoryDisplayMap[event.category as EventCategory] || event.category}
                  </div>
                </div>

                <div className="text-right text-primary/45">
                  <i className="fas fa-chevron-right text-xs" />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default UpcomingEvents
