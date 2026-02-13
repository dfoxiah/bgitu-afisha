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
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  isSameYear,
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { Event } from '@/types'
import { EventCategory } from '@prisma/client'

interface CalendarProps {
  events: Event[]
  onDayClick?: (day: Date) => void
  onMonthChange?: (month: Date) => void
}

const Calendar = ({ events, onDayClick, onMonthChange }: CalendarProps) => {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [days, setDays] = useState<Date[]>([])

  useEffect(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    
    const daysInMonth = eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd
    })
    
    setDays(daysInMonth)
  }, [currentMonth])

  useEffect(() => {
    onMonthChange?.(currentMonth)
  }, [currentMonth, onMonthChange])

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const getEventsForDay = (day: Date): Event[] => {
    if (!day) return []
    return events.filter(event => {
      try {
        const eventDate = new Date(event.date)
        return isSameDay(eventDate, day) && isSameMonth(eventDate, currentMonth)
      } catch {
        return false
      }
    })
  }

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      [EventCategory.CONCERT]: '#e91e63',
      [EventCategory.INTERNAL_ACTIVITY]: '#9c27b0',
      [EventCategory.PUBLIC_EVENT]: '#3f51b5',
      [EventCategory.COMPETITION]: '#009688',
      [EventCategory.LECTURE]: '#4b86b4',
      [EventCategory.MASTERCLASS]: '#ff9800',
      [EventCategory.VOLUNTEER]: '#FF7043',
      [EventCategory.NEWS]: '#4CAF50'
    }
    return colors[category] || '#4b86b4'
  }

  const handleEventClick = (event: Event) => {
    router.push(`/events/${event.id}`)
  }

  const currentMonthEvents = events.filter(event => {
    try {
      const eventDate = new Date(event.date)
      return isSameMonth(eventDate, currentMonth) && 
             isSameYear(eventDate, currentMonth) &&
             !event.removedFromCalendar
    } catch {
      return false
    }
  })

  return (
    <div className="calendar-section rounded-xl sm:rounded-2xl bg-white/70 border border-white/70 p-3 sm:p-6 animate-fadeIn">
      <div className="calendar-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-5">
        <div className="calendar-title flex flex-wrap items-center gap-2 sm:gap-3">
          <i className="fas fa-calendar-alt text-accent text-lg sm:text-xl"></i>
          <h2 className="text-base sm:text-2xl font-semibold text-primary">
            {format(currentMonth, 'LLLL yyyy', { locale: ru })}
          </h2>
          <div className="calendar-count-badge hidden sm:inline-flex bg-accent text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-sm font-medium">
            {currentMonthEvents.length} мероприятий
          </div>
        </div>
        <div className="calendar-nav flex gap-2">
          <button 
            className="calendar-nav-btn w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center cursor-pointer hover:bg-white/90 hover:border-accent transition-colors"
            onClick={prevMonth}
            title="Предыдущий месяц"
          >
            <i className="fas fa-chevron-left text-[10px] sm:text-sm"></i>
          </button>
          <button 
            className="calendar-nav-btn w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center cursor-pointer hover:bg-white/90 hover:border-accent transition-colors"
            onClick={() => setCurrentMonth(new Date())}
            title="Текущий месяц"
          >
            <i className="fas fa-dot-circle text-[10px] sm:text-sm"></i>
          </button>
          <button 
            className="calendar-nav-btn w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center cursor-pointer hover:bg-white/90 hover:border-accent transition-colors"
            onClick={nextMonth}
            title="Следующий месяц"
          >
            <i className="fas fa-chevron-right text-[10px] sm:text-sm"></i>
          </button>
        </div>
      </div>
      
      <div className="calendar-grid grid grid-cols-7 gap-1 sm:gap-2 mb-3 sm:mb-5">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
          <div key={day} className="calendar-day text-center py-1.5 sm:py-3 font-semibold text-gray-500 text-[9px] sm:text-sm">
            {day}
          </div>
        ))}
        
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())
          const hasEvents = dayEvents.length > 0
          
          return (
            <div 
              key={index}
              className={`calendar-cell min-h-[44px] sm:min-h-[80px] lg:min-h-[90px] border rounded-radius-sm p-1.5 sm:p-3 relative overflow-hidden cursor-pointer transition-all duration-300 ${
                hasEvents ? 'has-event bg-accent/5 border-accent' : 'bg-white/60 border-white/70'
              } ${!isCurrentMonth ? 'other-month opacity-50' : ''} ${isToday ? 'today border-2 border-accent' : ''}`}
              onClick={() => {
                if (onDayClick) {
                  onDayClick(day)
                }
              }}
              title={hasEvents ? `${dayEvents.length} мероприятий` : 'Нет мероприятий'}
            >
              <div 
                className="calendar-date flex items-center justify-between mb-0.5 sm:mb-1 text-[11px] sm:text-sm"
                style={{ 
                  fontWeight: isCurrentMonth ? 600 : 400,
                  color: isCurrentMonth ? (isToday ? 'var(--accent)' : 'var(--text)') : 'var(--gray)'
                }}
              >
                <span>{format(day, 'd')}</span>
                {hasEvents && (
                  <span className="hidden sm:flex w-3.5 h-3.5 sm:w-4 sm:h-4 bg-accent text-white text-[10px] sm:text-xs rounded-full items-center justify-center">
                    {dayEvents.length}
                  </span>
                )}
              </div>
                            <div className="calendar-events hidden sm:block">
                {dayEvents.slice(0, 2).map(event => (
                  <div 
                    key={event.id} 
                    className="calendar-event text-xs px-2 py-1 rounded-sm mb-1 overflow-hidden whitespace-nowrap text-ellipsis"
                    style={{ 
                      backgroundColor: getCategoryColor(event.category),
                      color: "white",
                      cursor: "pointer"
                    }}
                    title={`${event.title} (${event.time})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEventClick(event)
                    }}
                  >
                    {event.title.length > 12 ? event.title.substring(0, 12) + "..." : event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="calendar-event-more text-xs bg-gray-500 text-white px-2 py-0.5 rounded-sm">
                    +{dayEvents.length - 2}
                  </div>
                )}
              </div>
              {hasEvents && (
                <div className="calendar-events sm:hidden mt-0.5 flex flex-wrap gap-1">
                  {dayEvents.slice(0, 4).map(event => (
                    <span
                      key={event.id}
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: getCategoryColor(event.category) }}
                    ></span>
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-[9px] text-gray-500">+{dayEvents.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      <div className="hidden sm:block mt-3 sm:mt-5 text-center text-gray-600 text-[10px] sm:text-sm p-2 sm:p-3 bg-light rounded-lg border border-border">
        <p>
          <i className="fas fa-info-circle mr-2"></i>
          В {format(currentMonth, 'LLLL yyyy', { locale: ru })}: <strong>{currentMonthEvents.length}</strong> мероприятий
          {currentMonthEvents.length === 0 && ' (нет мероприятий)'}
        </p>
      </div>
    </div>
  )
}

export default Calendar
