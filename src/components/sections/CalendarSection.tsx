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
    <section className="calendar-section liquid-section p-8 mx-5% my-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="section-title text-2xl text-primary flex items-center gap-3">
          <i className="fas fa-calendar-alt"></i> Календарь мероприятий
        </h2>
        <div className="bg-light px-4 py-2 rounded-full text-sm text-primary flex items-center gap-2">
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
        className="view-all-btn w-full mt-6 p-4 bg-white/70 border border-white/70 rounded-xl font-medium text-primary text-center hover:bg-white hover:border-accent transition-colors"
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
