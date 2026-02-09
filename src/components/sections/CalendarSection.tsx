'use client'

import { useState, useMemo } from 'react'
import Calendar from '@/components/events/Calendar'
import DayEventsModal from '@/components/events/DayEventsModal'
import MonthEventsModal from '@/components/events/MonthEventsModal'
import { Event } from '@/types'
import { isSameMonth, isSameYear } from 'date-fns'

interface CalendarSectionProps {
  events: Event[]
}


const CalendarSection = ({ events }: CalendarSectionProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayEventsModalOpen, setDayEventsModalOpen] = useState(false)
  const [monthEventsModalOpen, setMonthEventsModalOpen] = useState(false)
  const [dayEvents, setDayEvents] = useState<Event[]>([])
  const [monthEvents, setMonthEvents] = useState<Event[]>([])
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  const currentMonthEvents = useMemo(() => {
    return events.filter(event => {
      try {
        const eventDate = new Date(event.date)
        return isSameMonth(eventDate, calendarMonth) && 
               isSameYear(eventDate, calendarMonth) &&
               !event.removedFromCalendar
      } catch {
        return false
      }
    })
  }, [events, calendarMonth])

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
    const eventsForDay = events.filter(event => {
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
    const eventsForMonth = events.filter(event => {
      try {
        const eventDate = new Date(event.date)
        return isSameMonth(eventDate, calendarMonth) && 
               isSameYear(eventDate, calendarMonth) &&
               !event.removedFromCalendar
      } catch {
        return false
      }
    })
    
    setMonthEvents(eventsForMonth)
    setMonthEventsModalOpen(true)
  }

  return (
    <section className="calendar-section liquid-section p-3 sm:p-6 lg:p-8 mx-4 sm:mx-5% my-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <h2 className="section-title text-lg sm:text-2xl text-primary flex items-center gap-3">
          <i className="fas fa-calendar-alt"></i> Календарь мероприятий
        </h2>
        <div className="bg-light hidden sm:flex px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm text-primary items-center gap-2">
          <i className="fas fa-chart-bar"></i>
          <span>
            {calendarMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}: {currentMonthEvents.length} мероприятий
          </span>
        </div>
      </div>
      
      <Calendar 
        events={events} 
        onDayClick={handleDayClick} 
        onMonthChange={setCalendarMonth}
      />
      
      <button 
        className="view-all-btn w-full mt-5 sm:mt-6 p-3 sm:p-4 bg-white/70 border border-white/70 rounded-xl font-medium text-sm sm:text-base text-primary text-center hover:bg-white hover:border-accent transition-colors"
        onClick={handleViewAll}
      >
        <i className="fas fa-list mr-2"></i> Все события этого месяца ({currentMonthEvents.length})
      </button>
      
      <DayEventsModal
        isOpen={dayEventsModalOpen}
        onClose={() => setDayEventsModalOpen(false)}
        events={dayEvents}
        date={selectedDate}
      />
      
      <MonthEventsModal
        isOpen={monthEventsModalOpen}
        onClose={() => setMonthEventsModalOpen(false)}
        events={monthEvents}
        month={calendarMonth}
      />
    </section>
  )
}

export default CalendarSection
