// src/components/events/EventCard.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Event } from '@/types'
import { useSession } from 'next-auth/react'
import { useAppContext } from '@/contexts/AppContext'
import { CategoryDisplayMap } from '@/types'
import { EventCategory } from '@prisma/client'
import { showToast } from '@/lib/toast'

interface EventCardProps {
  event: Event
  onClick?: (event: Event) => void
  onEdit?: (event: Event) => void
  onComplete?: (event: Event) => void
}

export default function EventCard({ 
  event, 
  onClick, 
  onEdit, 
  onComplete 
}: EventCardProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { updateParticipantStatus } = useAppContext()
  const [imageError, setImageError] = useState(false)
  const [updatingParticipantId, setUpdatingParticipantId] = useState<string | null>(null)
  const [updatingAction, setUpdatingAction] = useState<'confirm' | 'reject' | null>(null)
  
  const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
  const isPast = event.isPast || eventDate < new Date()
  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'
  const moderatorIds = event.moderators?.map(m => m.id) || []
  const canModerate =
    isTeacher &&
    (session?.user?.role === 'ADMIN' ||
      event.creatorId === session?.user?.id ||
      moderatorIds.includes(session?.user?.id || ''))
  const categoryDisplayName = CategoryDisplayMap[event.category as EventCategory] || event.category
  const pendingParticipants = event.pendingParticipants || []

  const handleParticipantAction = async (userId: string, action: 'confirm' | 'reject') => {
    if (updatingParticipantId) return
    setUpdatingParticipantId(userId)
    setUpdatingAction(action)
    try {
      await updateParticipantStatus(event.id, userId, action)
    } catch (error) {
      console.error('Participant update error:', error)
      showToast('Не удалось обновить статус участника', 'error')
    } finally {
      setUpdatingParticipantId(null)
      setUpdatingAction(null)
    }
  }

  const handleImageError = () => {
    setImageError(true)
  }

  const placeholderImage = `https://placehold.co/600x400/6fa3f4/ffffff?text=${encodeURIComponent(event.title.substring(0, 20))}`

  const getCategoryColor = (category: EventCategory): string => {
    const colors: Record<EventCategory, string> = {
      [EventCategory.CONCERT]: 'bg-sky-100 text-sky-700 border-sky-200',
      [EventCategory.INTERNAL_ACTIVITY]: 'bg-blue-100 text-blue-700 border-blue-200',
      [EventCategory.PUBLIC_EVENT]: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      [EventCategory.COMPETITION]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      [EventCategory.LECTURE]: 'bg-violet-100 text-violet-700 border-violet-200',
      [EventCategory.MASTERCLASS]: 'bg-teal-100 text-teal-700 border-teal-200',
      [EventCategory.VOLUNTEER]: 'bg-slate-100 text-slate-700 border-slate-200',
      [EventCategory.NEWS]: 'bg-sky-50 text-sky-700 border-sky-100'
    }
    return colors[category] || 'bg-accent text-white border-accent'
  }

  return (
    <div 
      className="event-card liquid-card liquid-card-hover overflow-hidden cursor-pointer flex flex-col h-full"
      onClick={() => onClick ? onClick(event) : router.push(`/events/${event.id}`)}
    >
      <div className="relative h-40 sm:h-48 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageError || !event.images || event.images.length === 0 ? placeholderImage : event.images[0]}
          alt={event.title}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        <div className="absolute top-3 right-3">
          <span className={`text-xs px-3 py-1 rounded-full ${getCategoryColor(event.category as EventCategory)}`}>
            {categoryDisplayName}
          </span>
        </div>
      </div>
      
      <div className="p-4 sm:p-5 flex flex-col flex-grow">
        <h3 className="event-card-title text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 line-clamp-2">
          {event.title}
        </h3>
        
        <div className="event-card-meta space-y-2 mb-4 text-xs sm:text-sm text-gray-600 flex-grow">
          <div className="flex items-center gap-2">
            <i className="fas fa-calendar text-accent w-4"></i>
            <span>{eventDate.toLocaleDateString('ru-RU')}</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="fas fa-clock text-accent w-4"></i>
            <span>{event.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="fas fa-map-marker-alt text-accent w-4"></i>
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </div>

        {canModerate && !isPast && pendingParticipants.length > 0 && (
          <div
            className="mb-4 rounded-2xl border border-white/70 bg-white/70 p-3 shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase text-sky-600 mb-2">
              Ожидают подтверждения: {pendingParticipants.length}
            </div>
            <div className="space-y-2">
              {pendingParticipants.slice(0, 3).map(user => (
                <div key={user.id} className="flex items-center justify-between gap-2">
                  <div className="text-sm text-gray-700 truncate">
                    {user.name || user.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-blue-200 transition-colors disabled:opacity-60"
                      onClick={() => handleParticipantAction(user.id, 'confirm')}
                      disabled={!!updatingParticipantId}
                    >
                      {updatingParticipantId === user.id && updatingAction === 'confirm' ? '...' : 'Принять'}
                    </button>
                    <button
                      className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-60"
                      onClick={() => handleParticipantAction(user.id, 'reject')}
                      disabled={!!updatingParticipantId}
                    >
                      {updatingParticipantId === user.id && updatingAction === 'reject' ? '...' : 'Отклонить'}
                    </button>
                  </div>
                </div>
              ))}
              {pendingParticipants.length > 3 && (
                <div className="text-xs text-gray-500">и ещё {pendingParticipants.length - 3}</div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
          <span className={`event-card-status text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full ${
            isPast 
              ? 'bg-gray-100 text-gray-600' 
              : 'bg-sky-50 text-sky-700'
          }`}>
            {isPast ? 'Завершено' : `Участников: ${event.currentParticipants}${event.maxParticipants > 0 ? `/${event.maxParticipants}` : ''}`}
          </span>
          
          {canModerate && !isPast && (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button 
                className="edit-btn text-[10px] sm:text-xs bg-sky-100 text-sky-700 px-2.5 sm:px-3 py-1 rounded-full hover:bg-sky-200 transition-colors"
                onClick={() => onEdit && onEdit(event)}
              >
                <i className="fas fa-edit mr-1"></i>
                Редактировать
              </button>
              <button 
                className="complete-btn text-[10px] sm:text-xs bg-blue-100 text-blue-700 px-2.5 sm:px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
                onClick={() => onComplete && onComplete(event)}
              >
                <i className="fas fa-check mr-1"></i>
                Завершить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}





