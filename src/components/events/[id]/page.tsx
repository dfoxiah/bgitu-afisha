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
import { Event, CategoryDisplayMap } from '@/types'
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
      const foundEvent = events.find((item) => item.id === eventId)
      setEvent(foundEvent || null)
      setLoading(false)
      return
    }

    if (params.id && events.length === 0) {
      const timer = setTimeout(() => {
        const eventId = params.id as string
        const foundEvent = events.find((item) => item.id === eventId)
        setEvent(foundEvent || null)
        setLoading(false)
      }, 1000)

      return () => clearTimeout(timer)
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
      [EventCategory.INTERNAL_ACTIVITY]: 'bg-indigo-100 text-indigo-700',
      [EventCategory.PUBLIC_EVENT]: 'bg-cyan-100 text-cyan-700',
      [EventCategory.COMPETITION]: 'bg-violet-100 text-violet-700',
      [EventCategory.LECTURE]: 'bg-blue-100 text-blue-700',
      [EventCategory.MASTERCLASS]: 'bg-amber-100 text-amber-700',
      [EventCategory.VOLUNTEER]: 'bg-emerald-100 text-emerald-700',
      [EventCategory.NEWS]: 'bg-slate-100 text-slate-700',
    }
    return colors[category] || 'bg-accent text-white'
  }

  if (loading) {
    return (
      <div className="status-screen">
        <div className="status-spinner" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="status-screen text-center">
        <div className="status-card">
          <i className="fas fa-exclamation-triangle mb-4 text-5xl text-yellow-500" />
          <h2 className="mb-4 text-2xl font-bold text-gray-700">Мероприятие не найдено</h2>
          <p className="mb-8 text-gray-500">Запрошенное мероприятие не существует или было удалено.</p>
          <Button variant="secondary" onClick={() => router.back()}>
            <i className="fas fa-arrow-left mr-2" />
            Вернуться назад
          </Button>
        </div>
      </div>
    )
  }

  const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
  const heroImage = (event.images && event.images.length > 0 ? event.images[0] : null) || (event.report?.images && event.report.images.length > 0 ? event.report.images[0] : null)
  const viewerStatusFromLists = event.participants?.some((participant) => participant.id === session?.user?.id)
    ? 'CONFIRMED'
    : event.pendingParticipants?.some((participant) => participant.id === session?.user?.id)
      ? 'PENDING'
      : null
  const viewerStatus = event.viewerParticipationStatus || viewerStatusFromLists
  const isParticipant = viewerStatus === 'CONFIRMED'
  const isPending = viewerStatus === 'PENDING'
  const isPast = event.isPast || eventDate < new Date()
  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'
  const canViewParticipants = isTeacher && (event.canViewParticipants ?? true)
  const confirmedParticipants = event.participants || []
  const pendingParticipants = event.pendingParticipants || []
  const pendingCount = event.pendingParticipantsCount ?? pendingParticipants.length
  const isFull = event.maxParticipants > 0 && event.currentParticipants >= event.maxParticipants
  const categoryDisplayName = CategoryDisplayMap[event.category as EventCategory] || event.category

  const handleRegister = async () => {
    if (!session) {
      router.push('/login')
      return
    }

    setIsRegistering(true)
    try {
      await registerForEvent(event.id)
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
    <div className="event-details-page page-shell px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => router.back()}>
            <i className="fas fa-arrow-left mr-2" />
            Назад
          </Button>

          {event.creator?.id ? (
            <Link
              href={`/users/${event.creator.id}`}
              className="rounded-full border border-primary/18 bg-white/84 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary/70 transition-colors hover:border-primary/34 hover:text-primary"
              title="Перейти в профиль создателя"
            >
              Создатель: {event.creator.name || 'Профиль'}
            </Link>
          ) : null}
        </div>

        <section className="liquid-section overflow-hidden">
          <div className="relative min-h-[12rem] border-b border-primary/12 p-4 sm:min-h-[14rem] sm:p-5">
            {heroImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroImage} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#041126]/74 via-[#041126]/52 to-[#041126]/18" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f2f68] via-[#1f5fe0] to-[#2f8df3]" />
            )}

            <div className="relative z-10 flex h-full flex-col justify-end">
              <div className="mb-3">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getCategoryColor(event.category as EventCategory)}`}>
                  {categoryDisplayName}
                </span>
              </div>
              <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">{event.title}</h1>
              <p className="mt-2 text-sm text-white/90 sm:text-base">
                {eventDate.toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr] lg:p-6">
            <div className="space-y-4">
              <article className="liquid-card p-4 sm:p-5">
                <h2 className="text-xl font-semibold text-primary">Описание</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-primary/78 sm:text-base">
                  {event.description.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </article>

              {(event.images && event.images.length > 0) && (
                <article className="liquid-card p-4 sm:p-5">
                  <h3 className="text-lg font-semibold text-primary">Фотографии</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {event.images.map((image, index) => (
                      <button
                        key={index}
                        type="button"
                        className="relative block aspect-[4/3] overflow-hidden rounded-xl border border-primary/14"
                        onClick={() => openGallery(event.images, index)}
                        title="Просмотр фото"
                      >
                        <Image
                          src={image}
                          alt={`${event.title} - фото ${index + 1}`}
                          fill
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                </article>
              )}

              {isPast && event.report && (
                <article className="liquid-card p-4 sm:p-5">
                  <h3 className="text-lg font-semibold text-primary">Отчет о мероприятии</h3>
                  <p className="mt-3 text-sm leading-7 text-primary/78 sm:text-base">{event.report.summary}</p>

                  {event.report.tasks && event.report.tasks.length > 0 && (
                    <>
                      <h4 className="mt-5 text-sm font-semibold uppercase tracking-[0.08em] text-primary/65">Выполненные задачи</h4>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-primary/75 sm:text-base">
                        {event.report.tasks.map((task, index) => (
                          <li key={index}>{task}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {event.report.activeParticipants && event.report.activeParticipants.length > 0 && (
                    <>
                      <h4 className="mt-5 text-sm font-semibold uppercase tracking-[0.08em] text-primary/65">Активные участники</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {event.report.activeParticipants.map((participant, index) => (
                          <span key={index} className="rounded-full border border-primary/15 bg-white px-3 py-1 text-sm text-primary/75">
                            {participant}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  {event.report.images && event.report.images.length > 0 && (
                    <>
                      <h4 className="mt-5 text-sm font-semibold uppercase tracking-[0.08em] text-primary/65">Фотоотчет</h4>
                      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                        {event.report.images.map((image, index) => (
                          <button
                            key={index}
                            type="button"
                            className="relative block aspect-[4/3] overflow-hidden rounded-xl border border-primary/14"
                            onClick={() => openGallery(event.report?.images || [], index)}
                            title="Просмотр фото"
                          >
                            <Image
                              src={image}
                              alt={`${event.title} - фотоотчет ${index + 1}`}
                              fill
                              sizes="(max-width: 1024px) 50vw, 25vw"
                              className="object-cover transition-transform duration-300 hover:scale-105"
                              unoptimized
                            />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              )}

              {canViewParticipants && (
                <article className="liquid-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-primary">Участники мероприятия</h3>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                        Подтверждено: {confirmedParticipants.length}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                        Pending: {pendingParticipants.length}
                      </span>
                    </div>
                  </div>

                  {confirmedParticipants.length === 0 && pendingParticipants.length === 0 ? (
                    <p className="mt-3 text-sm text-primary/62">Пока нет зарегистрированных участников.</p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {confirmedParticipants.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-primary/12">
                          <table className="min-w-[620px] w-full text-sm">
                            <thead className="bg-primary/5 text-left text-primary/64">
                              <tr>
                                <th className="px-3 py-2">ФИО</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Группа</th>
                                <th className="px-3 py-2">Факультет/кафедра</th>
                              </tr>
                            </thead>
                            <tbody>
                              {confirmedParticipants.map((participant) => (
                                <tr key={participant.id} className="border-t border-primary/10">
                                  <td className="px-3 py-2">{participant.name || "Не указано"}</td>
                                  <td className="px-3 py-2">{participant.email}</td>
                                  <td className="px-3 py-2">{participant.group || "Не указана"}</td>
                                  <td className="px-3 py-2">{participant.department || "Не указан"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {pendingParticipants.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-primary/62">
                            Заявки на подтверждение
                          </h4>
                          <div className="mt-2 space-y-2">
                            {pendingParticipants.map((participant) => (
                              <div
                                key={participant.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/12 bg-white/80 px-3 py-2"
                              >
                                <span className="text-sm text-primary/78">
                                  {participant.name || participant.email}
                                </span>
                                <span className="text-xs text-primary/56">{participant.group || "Группа не указана"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )}
            </div>

            <aside className="space-y-4">
              <article className="liquid-card p-4 sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary/60">Параметры</h3>
                <div className="mt-4 space-y-3 text-sm text-primary/78">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-clock w-4 text-accent" />
                    <span>{event.time} ({event.duration})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-location-dot w-4 text-accent" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-users w-4 text-accent" />
                    <span>
                      {event.currentParticipants}
                      {event.maxParticipants > 0 ? `/${event.maxParticipants}` : ''} участников
                    </span>
                  </div>
                </div>

                {event.maxParticipants > 0 && (
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-primary/10">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (event.currentParticipants / event.maxParticipants) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {pendingCount > 0 && (
                  <p className="mt-3 text-xs text-primary/62">{pendingCount} заявок ожидают подтверждения</p>
                )}
              </article>

              <article className="liquid-card p-4 sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary/60">Контакты</h3>
                <p className="mt-3 text-sm text-primary/75">
                  <span className="font-semibold text-primary/82">Ответственный:</span> {event.responsible}
                </p>
                {event.contact && (
                  <p className="mt-2 text-sm text-primary/75">
                    <span className="font-semibold text-primary/82">Контакт:</span> {event.contact}
                  </p>
                )}
              </article>

              {!isPast && !isTeacher && (
                <article className={`liquid-card p-4 sm:p-5 ${joinEffect ? 'join-portal is-celebrating' : 'join-portal'}`}>
                  <span className="join-sparkles" aria-hidden="true" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary/60">Регистрация</h3>
                  <div className="mt-3">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleRegister}
                      disabled={isParticipant || isPending || isFull || isRegistering}
                      className={`py-3 text-sm sm:text-base ${joinEffect ? 'btn-celebrate' : ''}`}
                      loading={isRegistering}
                    >
                      {isParticipant ? (
                        <>
                          <i className="fas fa-check mr-2" />
                          Вы уже зарегистрированы
                        </>
                      ) : isPending ? (
                        <>
                          <i className="fas fa-hourglass-half mr-2" />
                          Заявка на подтверждении
                        </>
                      ) : isFull ? (
                        <>
                          <i className="fas fa-times mr-2" />
                          Мест нет
                        </>
                      ) : (
                        <>
                          <i className="fas fa-user-plus mr-2" />
                          Зарегистрироваться
                        </>
                      )}
                    </Button>
                  </div>
                </article>
              )}
            </aside>
          </div>
        </section>
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
