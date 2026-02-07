// src/components/events/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useAppContext } from '@/contexts/AppContext'
import EventCard from '@/components/events/EventCard'
import EventForm from '@/components/events/EventForm'
import CompleteEventModal from '@/components/events/CompleteEventModal'
import Button from '@/components/ui/Button'
import { Event } from '@/types'
import { showToast } from '@/lib/toast'

export default function EventsPage() {
  const { data: session } = useSession()
  const { 
    createEvent, 
    updateEvent, 
    completeEvent,
    upcomingEvents,
    pastEvents 
  } = useAppContext()
  
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [completingEvent, setCompletingEvent] = useState<Event | null>(null)
  const [completionEffect, setCompletionEffect] = useState(false)
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  
  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current)
      }
    }
  }, [])

  const triggerCompletionEffect = () => {
    setCompletionEffect(true)
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current)
    }
    completionTimeoutRef.current = setTimeout(() => setCompletionEffect(false), 1800)
  }
  const handleFormSubmit = async (formData: any) => {
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, formData)
      } else {
        await createEvent(formData)
      }
      setShowForm(false)
      setEditingEvent(null)
    } catch (error) {
      console.error('Ошибка сохранения мероприятия:', error)
      showToast('Произошла ошибка при сохранении мероприятия', 'error')
    }
  }

  const handleComplete = async (reportData: any) => {
    if (completingEvent) {
      try {
        await completeEvent(completingEvent.id, reportData)
        triggerCompletionEffect()
        setCompletingEvent(null)
      } catch (error) {
        console.error('Ошибка завершения мероприятия:', error)
        showToast('Произошла ошибка при завершении мероприятия', 'error')
      }
    }
  }

  const handleEditClick = (event: Event) => {
    const canModerate =
      session?.user?.role === 'ADMIN' ||
      event.creatorId === session?.user?.id ||
      (event.moderators || []).some(m => m.id === session?.user?.id)

    if (!canModerate) {
      showToast('Нет прав на редактирование этого мероприятия', 'error')
      return
    }

    setEditingEvent(event)
    setShowForm(true)
  }

  const handleCompleteClick = (event: Event) => {
    const canModerate =
      session?.user?.role === 'ADMIN' ||
      event.creatorId === session?.user?.id ||
      (event.moderators || []).some(m => m.id === session?.user?.id)

    if (!canModerate) {
      showToast('Нет прав на завершение этого мероприятия', 'error')
      return
    }

    setCompletingEvent(event)
  }

  const handleCreateClick = () => {
    setEditingEvent(null)
    setShowForm(true)
  }

  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'

  return (
    <div className="events-page px-4 md:px-5% py-8">
      {completionEffect && (
        <div className="completion-celebration" aria-hidden="true"></div>
      )}
      <div className="container mx-auto">
        <h2 className="section-title text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <i className="fas fa-calendar-check text-accent"></i> Мои мероприятия
        </h2>
        
        <div className="events-tabs liquid-section flex gap-2 p-2 mb-6">
          <button 
            className={`events-tab px-6 py-2 rounded-full font-medium transition-colors relative ${activeTab === 'upcoming' ? 'text-primary bg-white/80 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Будущие события
          </button>
          <button 
            className={`events-tab px-6 py-2 rounded-full font-medium transition-colors relative ${activeTab === 'past' ? 'text-primary bg-white/80 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('past')}
          >
            Прошедшие события
          </button>
        </div>
        
        <div className="events-content">
          {activeTab === 'upcoming' && (
            <>
              {upcomingEvents.length === 0 ? (
                <div className="liquid-card text-center py-12">
                  <i className="fas fa-calendar-times text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-500 mb-2">Нет запланированных мероприятий</h3>
                  <p className="text-gray-400">Создайте первое мероприятие или дождитесь публикации новых</p>
                </div>
              ) : (
                <div className="events-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingEvents.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event}
                      onEdit={handleEditClick}
                      onComplete={handleCompleteClick}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          
          {activeTab === 'past' && (
            <>
              {pastEvents.length === 0 ? (
                <div className="liquid-card text-center py-12">
                  <i className="fas fa-history text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-500 mb-2">Нет завершенных мероприятий</h3>
                  <p className="text-gray-400">Здесь будут отображаться ваши прошедшие мероприятия</p>
                </div>
              ) : (
                <div className="events-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastEvents.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        
        {isTeacher && (
          <div className="create-event-btn text-center mt-10">
            <Button 
              variant="primary" 
              icon="plus" 
              onClick={handleCreateClick}
              className="px-8 py-3 text-lg"
            >
              Создать новое мероприятие
            </Button>
          </div>
        )}
      </div>
      
      {/* Модальное окно формы мероприятия */}
      {showForm && (
        <EventForm 
          event={editingEvent}
          onClose={() => {
            setShowForm(false)
            setEditingEvent(null)
          }}
          onSubmit={handleFormSubmit}
        />
      )}
      
      {/* Модальное окно завершения мероприятия */}
      {completingEvent && (
        <CompleteEventModal 
          event={completingEvent}
          onClose={() => setCompletingEvent(null)}
          onSubmit={handleComplete}
        />
      )}
    </div>
  )
}



