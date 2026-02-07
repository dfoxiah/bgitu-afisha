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
    <div className="calendar-section liquid-section p-7 animate-fadeIn">
      <div className="calendar-header flex justify-between items-center mb-5">
        <div className="calendar-title flex items-center gap-3">
          <i className="fas fa-calendar-alt text-accent text-xl"></i>
          <h2 className="text-2xl font-semibold text-primary">
            {format(currentMonth, 'LLLL yyyy', { locale: ru })}
          </h2>
          <div className="calendar-count-badge bg-accent text-white px-3 py-1 rounded-full text-sm font-medium">
            {currentMonthEvents.length} мероприятий
          </div>
        </div>
        <div className="calendar-nav flex gap-2">
          <button 
            className="calendar-nav-btn w-9 h-9 rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center cursor-pointer hover:bg-white/90 hover:border-accent transition-colors"
            onClick={prevMonth}
            title="Предыдущий месяц"
          >
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
          <button 
            className="calendar-nav-btn w-9 h-9 rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center cursor-pointer hover:bg-white/90 hover:border-accent transition-colors"
            onClick={() => setCurrentMonth(new Date())}
            title="Текущий месяц"
          >
            <i className="fas fa-dot-circle text-sm"></i>
          </button>
          <button 
            className="calendar-nav-btn w-9 h-9 rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center cursor-pointer hover:bg-white/90 hover:border-accent transition-colors"
            onClick={nextMonth}
            title="Следующий месяц"
          >
            <i className="fas fa-chevron-right text-sm"></i>
          </button>
        </div>
      </div>
      
      <div className="calendar-grid grid grid-cols-7 gap-2 mb-5">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
          <div key={day} className="calendar-day text-center py-3 font-semibold text-gray-500 text-sm">
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
              className={`calendar-cell min-h-[90px] border rounded-radius-sm p-3 relative overflow-hidden cursor-pointer transition-all duration-300 ${
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
                className="calendar-date flex items-center justify-between mb-1"
                style={{ 
                  fontWeight: isCurrentMonth ? 600 : 400,
                  color: isCurrentMonth ? (isToday ? 'var(--accent)' : 'var(--text)') : 'var(--gray)'
                }}
              >
                <span>{format(day, 'd')}</span>
                {hasEvents && (
                  <span className="w-4 h-4 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="calendar-events">
                {dayEvents.slice(0, 2).map(event => (
                  <div 
                    key={event.id} 
                    className="calendar-event text-xs px-2 py-1 rounded-sm mb-1 overflow-hidden whitespace-nowrap text-ellipsis"
                    style={{ 
                      backgroundColor: getCategoryColor(event.category),
                      color: 'white',
                      cursor: 'pointer'
                    }}
                    title={`${event.title} (${event.time})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEventClick(event)
                    }}
                  >
                    {event.title.length > 12 ? event.title.substring(0, 12) + '...' : event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="calendar-event-more text-xs bg-gray-500 text-white px-2 py-0.5 rounded-sm">
                    +{dayEvents.length - 2}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="mt-5 text-center text-gray-600 text-sm p-3 bg-light rounded-lg border border-border">
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
