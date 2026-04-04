/**
 * File responsibility:
 * Calendar component for visual event distribution by dates.
 *
 * Main logic:
 * - Build month grid and date cells.
 * - Highlight dates with events and open detail modals.
 *
 * Integrations:
 * - AppContext events data
 * - Day/Month events modal components
 */
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ru } from "date-fns/locale"
import { EventCategory } from "@prisma/client"
import { Event } from "@/types"

interface CalendarProps {
  events: Event[]
  onDayClick?: (day: Date) => void
  onMonthChange?: (month: Date) => void
  compact?: boolean
}

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

const categoryColors: Record<string, string> = {
  [EventCategory.CONCERT]: "#3f7fe8",
  [EventCategory.INTERNAL_ACTIVITY]: "#6f79ff",
  [EventCategory.PUBLIC_EVENT]: "#22a6d8",
  [EventCategory.COMPETITION]: "#4f63f2",
  [EventCategory.LECTURE]: "#3f78d6",
  [EventCategory.MASTERCLASS]: "#f2a13a",
  [EventCategory.VOLUNTEER]: "#1ca88f",
  [EventCategory.NEWS]: "#5f98f9",
}

const Calendar = ({ events, onDayClick, onMonthChange, compact = false }: CalendarProps) => {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [days, setDays] = useState<Date[]>([])

  useEffect(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)

    const daysInView = eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    })

    setDays(daysInView)
  }, [currentMonth])

  useEffect(() => {
    onMonthChange?.(currentMonth)
  }, [currentMonth, onMonthChange])

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      try {
        const eventDate = new Date(event.date)
        return isSameDay(eventDate, day) && isSameMonth(eventDate, currentMonth) && !event.removedFromCalendar
      } catch {
        return false
      }
    })
  }

  const currentMonthEvents = events.filter((event) => {
    try {
      const eventDate = new Date(event.date)
      return isSameMonth(eventDate, currentMonth) && isSameYear(eventDate, currentMonth) && !event.removedFromCalendar
    } catch {
      return false
    }
  })

  const handleEventClick = (event: Event) => {
    router.push(`/events/${event.id}`)
  }

  return (
    <div className={`calendar-block rounded-2xl border border-primary/14 bg-white/82 ${compact ? "p-2.5" : "p-3 sm:p-4"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 ${compact ? "mb-2.5 pb-2.5" : "mb-3 pb-3"}`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/58">Расписание</p>
          <h2 className={`mt-1 font-semibold capitalize text-primary ${compact ? "text-base" : "text-lg sm:text-2xl"}`}>
            {format(currentMonth, "LLLL yyyy", { locale: ru })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-lg border border-primary/16 bg-white/88 text-primary transition-colors hover:bg-primary/5 ${compact ? "h-8 w-8" : "h-9 w-9"}`}
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            title="Предыдущий месяц"
          >
            <i className="fas fa-chevron-left text-[11px]" />
          </button>

          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-lg border border-primary/16 bg-white/92 text-xs font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/6 ${compact ? "h-8 px-2.5" : "h-9 px-3"}`}
            onClick={() => setCurrentMonth(new Date())}
            title="Текущий месяц"
          >
            Сегодня
          </button>

          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-lg border border-primary/16 bg-white/88 text-primary transition-colors hover:bg-primary/5 ${compact ? "h-8 w-8" : "h-9 w-9"}`}
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            title="Следующий месяц"
          >
            <i className="fas fa-chevron-right text-[11px]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day} className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/56 sm:text-[11px]">
            {day}
          </div>
        ))}

        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())
          const hasEvents = dayEvents.length > 0

          return (
            <button
              key={`${day.toISOString()}-${index}`}
              type="button"
              className={`relative rounded-lg border px-1.5 py-1 text-left transition-colors ${
                hasEvents
                  ? "border-primary/26 bg-gradient-to-br from-primary/7 via-white to-accent/10"
                  : "border-primary/12 bg-white/84"
              } ${!isCurrentMonth ? "opacity-40" : ""} ${isToday ? "ring-1 ring-secondary/80" : ""} ${
                compact ? "min-h-[36px]" : "min-h-[42px] sm:min-h-[52px] lg:min-h-[60px] sm:px-2 sm:py-1.5"
              }`}
              onClick={() => onDayClick?.(day)}
              title={hasEvents ? `Событий: ${dayEvents.length}` : "Нет событий"}
            >
              <div className={`flex items-center justify-between font-semibold text-primary ${compact ? "text-[10px]" : "text-[11px] sm:text-xs"}`}>
                <span>{format(day, "d")}</span>
                {hasEvents && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] text-white">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className={`mt-1 ${compact ? "hidden" : "hidden lg:block"}`}>
                {dayEvents.slice(0, 1).map((event) => (
                  <div
                    key={event.id}
                    className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: categoryColors[event.category] || "#4f8cf2" }}
                    onClick={(evt) => {
                      evt.stopPropagation()
                      handleEventClick(event)
                    }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>

              {hasEvents && (
                <div className={`mt-1 flex flex-wrap gap-1 ${compact ? "" : "lg:hidden"}`}>
                  {dayEvents.slice(0, 4).map((event) => (
                    <span
                      key={event.id}
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: categoryColors[event.category] || "#4f8cf2" }}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 text-xs text-primary/62 ${compact ? "mt-2.5 pt-2.5" : "mt-3 pt-3"}`}>
        <p>
          <i className="fas fa-calendar-check mr-1" /> В {format(currentMonth, "LLLL yyyy", { locale: ru })}: {currentMonthEvents.length}
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" /> Событие
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-secondary" /> Сегодня
          </span>
        </div>
      </div>
    </div>
  )
}

export default Calendar
