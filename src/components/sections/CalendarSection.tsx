/**
 * File responsibility:
 * Dashboard section embedding the event calendar module.
 *
 * Main logic:
 * - Render calendar in dashboard composition.
 * - Pass normalized event collections to calendar.
 *
 * Integrations:
 * - Dashboard page
 * - src/components/events/Calendar.tsx
 */
"use client"

import { useMemo, useState } from "react"
import { isSameMonth, isSameYear } from "date-fns"
import Calendar from "@/components/events/Calendar"
import DayEventsModal from "@/components/events/DayEventsModal"
import MonthEventsModal from "@/components/events/MonthEventsModal"
import { Event } from "@/types"

interface CalendarSectionProps {
  events: Event[]
  compact?: boolean
  plain?: boolean
}

const CalendarSection = ({ events, compact = false, plain = false }: CalendarSectionProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayEventsModalOpen, setDayEventsModalOpen] = useState(false)
  const [monthEventsModalOpen, setMonthEventsModalOpen] = useState(false)
  const [dayEvents, setDayEvents] = useState<Event[]>([])
  const [monthEvents, setMonthEvents] = useState<Event[]>([])
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  const currentMonthEvents = useMemo(() => {
    return events.filter((event) => {
      try {
        const eventDate = new Date(event.date)
        return isSameMonth(eventDate, calendarMonth) && isSameYear(eventDate, calendarMonth) && !event.removedFromCalendar
      } catch {
        return false
      }
    })
  }, [events, calendarMonth])

  const monthPreviewEvents = useMemo(() => {
    return [...currentMonthEvents]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
  }, [currentMonthEvents])

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)

    const eventsForDay = events.filter((event) => {
      try {
        const eventDate = new Date(event.date)
        return eventDate.toDateString() === day.toDateString() && !event.removedFromCalendar
      } catch {
        return false
      }
    })

    setDayEvents(eventsForDay)
    setDayEventsModalOpen(true)
  }

  const handleViewAll = () => {
    const eventsForMonth = events.filter((event) => {
      try {
        const eventDate = new Date(event.date)
        return isSameMonth(eventDate, calendarMonth) && isSameYear(eventDate, calendarMonth) && !event.removedFromCalendar
      } catch {
        return false
      }
    })

    setMonthEvents(eventsForMonth)
    setMonthEventsModalOpen(true)
  }

  return (
    <section className={plain ? "" : "liquid-section p-4 sm:p-5"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Календарь</h2>
          <p className="mt-1 text-xs text-primary/56">Событий в текущем месяце: {currentMonthEvents.length}</p>
        </div>
        <button
          type="button"
          className="liquid-chip px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-primary"
          onClick={handleViewAll}
        >
          Список месяца
        </button>
      </div>

      <Calendar events={events} onDayClick={handleDayClick} onMonthChange={setCalendarMonth} compact={compact} />

      <div className="mt-4 border-t border-primary/12 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/56">Ближайшие даты</p>
        {monthPreviewEvents.length === 0 ? (
          <p className="mt-2 text-xs text-primary/62">В этом месяце пока нет событий.</p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border border-primary/12 bg-white/82">
            {monthPreviewEvents.map((event, index) => (
              <div key={event.id} className={`px-3 py-2 ${index !== monthPreviewEvents.length - 1 ? "border-b border-primary/12" : ""}`}>
                <p className="line-clamp-1 text-xs font-semibold text-primary">{event.title}</p>
                <p className="mt-1 text-[11px] text-primary/62">
                  {new Date(event.date).toLocaleDateString("ru-RU")} • {event.time}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <DayEventsModal isOpen={dayEventsModalOpen} onClose={() => setDayEventsModalOpen(false)} events={dayEvents} date={selectedDate} />

      <MonthEventsModal isOpen={monthEventsModalOpen} onClose={() => setMonthEventsModalOpen(false)} events={monthEvents} month={calendarMonth} />
    </section>
  )
}

export default CalendarSection
