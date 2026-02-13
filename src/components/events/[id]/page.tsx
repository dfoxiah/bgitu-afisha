/**
 * File responsibility:
 * Event details page for participants and moderators.
 *
 * Main logic:
 * - Render event content, gallery and report
 * - Handle registration and gallery interactions
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - src/components/ui/ImageGalleryModal.tsx
 */
'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { useAppContext } from '@/contexts/AppContext'
import Button from '@/components/ui/Button'
import ImageGalleryModal from '@/components/ui/ImageGalleryModal'
import { Event } from '@/types'
import { CategoryDisplayMap } from '@/types'
import { EventCategory } from '@prisma/client'
import { showToast } from '@/lib/toast'

export default function EventDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { events, registerForEvent } = useAppContext()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [joinEffect, setJoinEffect] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (params.id && events.length > 0) {
      const eventId = params.id as string
      const foundEvent = events.find(e => e.id === eventId)
      setEvent(foundEvent || null)
      setLoading(false)
    } else if (params.id && events.length === 0) {
      // Если события еще не загружены, пытаемся загрузить
      setTimeout(() => {
        const eventId = params.id as string
        const foundEvent = events.find(e => e.id === eventId)
        setEvent(foundEvent || null)
        setLoading(false)
      }, 1000)
    }
  }, [params.id, events])

  useEffect(() => {
    return () => {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current)
      }
    }
  }, [])

  const triggerJoinEffect = () => {
    setJoinEffect(true)
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current)
    }
    joinTimeoutRef.current = setTimeout(() => setJoinEffect(false), 1400)
  }

  const getCategoryColor = (category: EventCategory): string => {
    const colors: Record<EventCategory, string> = {
      [EventCategory.CONCERT]: 'bg-sky-100 text-sky-700',
      [EventCategory.INTERNAL_ACTIVITY]: 'bg-blue-100 text-blue-700',
      [EventCategory.PUBLIC_EVENT]: 'bg-cyan-100 text-cyan-700',
      [EventCategory.COMPETITION]: 'bg-indigo-100 text-indigo-700',
      [EventCategory.LECTURE]: 'bg-violet-100 text-violet-700',
      [EventCategory.MASTERCLASS]: 'bg-teal-100 text-teal-700',
      [EventCategory.VOLUNTEER]: 'bg-slate-100 text-slate-700',
      [EventCategory.NEWS]: 'bg-sky-50 text-sky-700'
    }
    return colors[category] || 'bg-accent text-white'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <i className="fas fa-exclamation-triangle text-5xl text-yellow-500 mb-4"></i>
        <h2 className="text-2xl font-bold text-gray-700 mb-4">Мероприятие не найдено</h2>
        <p className="text-gray-500 mb-8">Запрошенное мероприятие не существует или было удалено</p>
        <Button variant="secondary" onClick={() => router.back()}>
          <i className="fas fa-arrow-left mr-2"></i>
          Вернуться назад
        </Button>
      </div>
    )
  }

  const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
  const isParticipant = event.participants?.some(p => p.id === session?.user?.id)
  const isPending = event.pendingParticipants?.some(p => p.id === session?.user?.id)
  const isPast = event.isPast || eventDate < new Date()
  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'
  const isFull = event.maxParticipants > 0 && event.currentParticipants >= event.maxParticipants
  const categoryDisplayName = CategoryDisplayMap[event.category as EventCategory] || event.category

  const handleRegister = async () => {
    if (!session) {
      router.push('/login')
      return
    }

    setIsRegistering(true)
    try {
      await registerForEvent(event.id) // Теперь передаем только eventId
      showToast('Вы успешно зарегистрированы на мероприятие!', 'success')
      triggerJoinEffect()
    } catch (error) {
      console.error('Registration error:', error)
      showToast('Произошла ошибка при регистрации', 'error')
    } finally {
      setIsRegistering(false)
    }
  }

  const openGallery = (images: string[], index: number) => {
    if (!images || images.length === 0) return
    setGalleryImages(images)
    setGalleryIndex(index)
    setGalleryOpen(true)
  }

  return (
    <div className="event-details-page px-4 md:px-[5%] py-8">
      <div className="container mx-auto max-w-6xl">
        <Button 
          variant="secondary" 
          onClick={() => router.back()}
          className="mb-6"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Назад
        </Button>
        
        <div className="liquid-section overflow-hidden">
          {/* Заголовок и категория */}
          <div className="p-4 sm:p-6 lg:p-8 border-b">
            <div className="flex flex-wrap items-center justify-between mb-4">
              <span className={`inline-block px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-medium mb-2 ${getCategoryColor(event.category as EventCategory)}`}>
                {categoryDisplayName}
              </span>
              <div className="text-sm text-gray-500">ID: {event.id.substring(0, 8)}...</div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{event.title}</h1>
            <div className="flex items-center text-gray-600">
              <i className="fas fa-user-circle mr-2"></i>
              <span>Создатель: </span>
              {event.creator?.id ? (
                <Link
                  href={`/users/${event.creator.id}`}
                  className="ml-1 text-accent hover:text-primary hover:underline underline-offset-4"
                  title="Перейти в профиль"
                >
                  {event.creator?.name || 'Профиль пользователя'}
                </Link>
              ) : (
                <span className="ml-1">{event.creator?.name || 'Не указан'}</span>
              )}
            </div>
          </div>

          {/* Основная информация */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/70 border border-white/70 rounded-xl flex items-center justify-center shadow">
                <i className="fas fa-calendar text-accent text-lg sm:text-xl"></i>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Дата</div>
                <div className="text-base sm:text-lg">{eventDate.toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/70 border border-white/70 rounded-xl flex items-center justify-center shadow">
                <i className="fas fa-clock text-accent text-lg sm:text-xl"></i>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Время</div>
                <div className="text-base sm:text-lg">{event.time} ({event.duration})</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/70 border border-white/70 rounded-xl flex items-center justify-center shadow">
                <i className="fas fa-map-marker-alt text-accent text-lg sm:text-xl"></i>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Место</div>
                <div className="text-base sm:text-lg">{event.location}</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/70 border border-white/70 rounded-xl flex items-center justify-center shadow">
                <i className="fas fa-users text-accent text-lg sm:text-xl"></i>
              </div>
              <div>
                <div className="font-semibold text-gray-700">Участники</div>
                <div className="text-base sm:text-lg">
                  {event.currentParticipants}{event.maxParticipants > 0 ? `/${event.maxParticipants}` : ''}
                </div>
                {event.pendingParticipants && event.pendingParticipants.length > 0 && (
                  <div className="text-xs text-sky-600 mt-1">
                    {event.pendingParticipants.length} ожидают подтверждения
                  </div>
                )}
                {event.maxParticipants > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-accent h-2 rounded-full" 
                      style={{ 
                        width: `${Math.min(100, (event.currentParticipants / event.maxParticipants) * 100)}%` 
                      }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Описание */}
          <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Описание</h3>
            <div className="prose max-w-none text-gray-700 leading-relaxed">
              {event.description.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4">{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Изображения */}
          {event.images && event.images.length > 0 && (
            <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Фотографии</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {event.images.map((image, index) => (
                  <button
                    key={index}
                    type="button"
                    className="block rounded-lg overflow-hidden border border-gray-200 bg-black/5 aspect-[4/3] shadow-md"
                    onClick={() => openGallery(event.images, index)}
                    title="Просмотр фото"
                  >
                    <div className="relative w-full h-full">
                      <Image
                        src={image}
                        alt={`${event.title} - фото ${index + 1}`}
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Контактная информация */}
          <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Контактная информация</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="liquid-card p-4">
                <div className="font-medium text-gray-600 mb-1">Ответственный</div>
                <div className="text-base sm:text-lg">{event.responsible}</div>
              </div>
              {event.contact && (
                <div className="liquid-card p-4">
                  <div className="font-medium text-gray-600 mb-1">Контакт</div>
                  <div className="text-base sm:text-lg">{event.contact}</div>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка регистрации */}
          {!isPast && !isTeacher && (
            <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
              <div className={`join-portal ${joinEffect ? 'is-celebrating' : ''}`}>
                <span className="join-sparkles" aria-hidden="true"></span>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleRegister}
                  disabled={isParticipant || isPending || isFull || isRegistering}
                  className={`py-3 sm:py-4 text-base sm:text-lg ${joinEffect ? 'btn-celebrate' : ''}`}
                  loading={isRegistering}
                >
                  {isParticipant ? (
                    <>
                      <i className="fas fa-check mr-2"></i>
                      Вы уже зарегистрированы
                    </>
                  ) : isPending ? (
                    <>
                      <i className="fas fa-hourglass-half mr-2"></i>
                      Заявка на подтверждении
                    </>
                  ) : isFull ? (
                    <>
                      <i className="fas fa-times mr-2"></i>
                      Мест нет
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-plus mr-2"></i>
                      Зарегистрироваться на мероприятие
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Отчет о мероприятии (если прошло) */}
          {isPast && event.report && (
            <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 border-t pt-6 sm:pt-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Отчет о мероприятии</h3>
              <div className="bg-white/70 border border-white/70 p-4 sm:p-6 rounded-2xl shadow">
                <h4 className="font-semibold text-lg mb-2">Итоги</h4>
                <p className="mb-4">{event.report.summary}</p>
                
                {event.report.tasks && event.report.tasks.length > 0 && (
                  <>
                    <h4 className="font-semibold text-lg mb-2">Выполненные задачи:</h4>
                    <ul className="list-disc pl-5 mb-4">
                      {event.report.tasks.map((task, index) => (
                        <li key={index}>{task}</li>
                      ))}
                    </ul>
                  </>
                )}
                
                {event.report.activeParticipants && event.report.activeParticipants.length > 0 && (
                  <>
                    <h4 className="font-semibold text-lg mb-2">Активные участники:</h4>
                    <div className="flex flex-wrap gap-2">
                      {event.report.activeParticipants.map((participant, index) => (
                        <span key={index} className="bg-white px-3 py-1 rounded-full text-sm">
                          {participant}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {event.report.images && event.report.images.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-lg mb-2">Фотографии:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {event.report.images.map((image, index) => (
                        <button
                          key={index}
                          type="button"
                          className="block rounded-lg overflow-hidden border border-gray-200 bg-black/5 aspect-[4/3] shadow-md"
                          onClick={() => openGallery(event.report?.images || [], index)}
                          title="Просмотр фото"
                        >
                          <div className="relative w-full h-full">
                            <Image
                              src={image}
                              alt={`${event.title} - фото ${index + 1}`}
                              fill
                              sizes="(max-width: 1024px) 50vw, 25vw"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <ImageGalleryModal
        isOpen={galleryOpen}
        images={galleryImages}
        startIndex={galleryIndex}
        title={event?.title || 'Просмотр фото'}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  )
}








