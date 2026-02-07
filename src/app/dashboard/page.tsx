// src/app/dashboard/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/contexts/AppContext'
import CategoryFilter from '@/components/events/CategoryFilter'
import EventCard from '@/components/events/EventCard'
import UpcomingEvents from '@/components/sections/UpcomingEvents'
import CalendarSection from '@/components/sections/CalendarSection'
import NewsSection from '@/components/sections/NewsSection'
import Banner from '@/components/sections/Banner'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { 
    events, 
    upcomingEvents, 
    pastEvents, 
    filteredEvents,
    searchQuery 
  } = useAppContext()

  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [sessionStuck, setSessionStuck] = useState(false)

  useEffect(() => {
    if (status === 'loading') {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => {
          setSessionStuck(true)
        }, 8000)
      }
      return
    }

    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
  }, [status])

  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(async () => {
      const freshSession = await getSession()
      if (freshSession) {
        router.refresh()
        return
      }
      router.replace('/login?fallback=1')
    }, 6000)

    return () => clearTimeout(timer)
  }, [status, router])

  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'title_asc' | 'title_desc'>('date_desc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'past'>('all')

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const now = new Date()
    let results = [...filteredEvents]

    if (statusFilter !== 'all') {
      results = results.filter(event => {
        const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
        const isPast = event.isPast || eventDate < now
        return statusFilter === 'past' ? isPast : !isPast
      })
    }

    results.sort((a, b) => {
      const aDate = a.date instanceof Date ? a.date : new Date(a.date)
      const bDate = b.date instanceof Date ? b.date : new Date(b.date)

      if (sortBy === 'date_desc') return bDate.getTime() - aDate.getTime()
      if (sortBy === 'date_asc') return aDate.getTime() - bDate.getTime()
      if (sortBy === 'title_asc') return a.title.localeCompare(b.title, 'ru')
      return b.title.localeCompare(a.title, 'ru')
    })

    return results
  }, [filteredEvents, searchQuery, sortBy, statusFilter])

  if (status === 'loading') {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-light-gray">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-accent mx-auto"></div>
          <p className="text-gray-600 text-lg">Загрузка дашборда...</p>
          {sessionStuck && (
            <div className="text-sm text-gray-500">
              Сессия грузится слишком долго. Попробуйте перейти на страницу входа.
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-light-gray">
        <div className="text-center space-y-4">
          <p className="text-gray-600 text-lg">Вы не авторизованы</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page pb-8">
      <div className="search-section px-5% py-6">
        <div className="container mx-auto">
          <div className="liquid-section p-6">
            <h1 className="text-3xl font-bold text-primary mb-2">
              Добро пожаловать, {session.user?.name}!
            </h1>
            <p className="text-gray-600">
              БГИТУ Афиша - агрегатор мероприятий университета
            </p>
          </div>
        </div>
      </div>

      <CategoryFilter />

      {searchQuery.trim() && (
        <section className="search-results liquid-section p-6 mx-5% my-4">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-primary">
                Результаты поиска
              </h2>
              <p className="text-sm text-gray-500">
                Найдено: {searchResults.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="date_desc">Сначала новые</option>
                <option value="date_asc">Сначала старые</option>
                <option value="title_asc">По названию А-Я</option>
                <option value="title_desc">По названию Я-А</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="all">Все мероприятия</option>
                <option value="active">Активные</option>
                <option value="past">Завершенные</option>
              </select>
            </div>
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Ничего не найдено по запросу
            </div>
          ) : (
            <div className="events-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      )}
      
      {events.length > 0 && (
        <>
          <Banner events={upcomingEvents.slice(0, 3)} />
          <UpcomingEvents events={upcomingEvents} />
          <CalendarSection events={events} />
          <NewsSection events={pastEvents} />
        </>
      )}
      
      {events.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-white rounded-lg shadow-md p-8 mx-5%">
            <i className="fas fa-calendar-plus text-5xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Нет мероприятий
            </h3>
            <p className="text-gray-500">
              В данный момент нет доступных мероприятий
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
