/**
 * File responsibility:
 * Main dashboard page with global search and event sections.
 *
 * Main logic:
 * - Handle session fallback when NextAuth is stuck in loading state
 * - Build filtered/sorted search results on top of AppContext collections
 * - Render key dashboard sections
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - src/components/events/CategoryFilter.tsx
 * - src/components/sections/*
 */
"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { getSession, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/contexts/AppContext"
import CategoryFilter from "@/components/events/CategoryFilter"
import Banner from "@/components/sections/Banner"
import UpcomingEvents from "@/components/sections/UpcomingEvents"
import CalendarSection from "@/components/sections/CalendarSection"
import NewsSection from "@/components/sections/NewsSection"

type SortBy = "date_desc" | "date_asc" | "title_asc" | "title_desc"
type StatusFilter = "all" | "active" | "past"

const SORT_OPTIONS: ReadonlyArray<SortBy> = ["date_desc", "date_asc", "title_asc", "title_desc"]
const STATUS_OPTIONS: ReadonlyArray<StatusFilter> = ["all", "active", "past"]

const isSortBy = (value: string): value is SortBy => SORT_OPTIONS.includes(value as SortBy)
const isStatusFilter = (value: string): value is StatusFilter => STATUS_OPTIONS.includes(value as StatusFilter)

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { events, upcomingEvents, pastEvents, filteredEvents, searchQuery } = useAppContext()

  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [sessionStuck, setSessionStuck] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>("date_desc")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  useEffect(() => {
    if (status === "loading") {
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
    if (status !== "loading") return

    const timer = setTimeout(async () => {
      const freshSession = await getSession()
      if (freshSession) {
        router.refresh()
        return
      }

      router.replace("/login?fallback=1")
    }, 6000)

    return () => clearTimeout(timer)
  }, [status, router])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const now = new Date()
    let results = [...filteredEvents]

    if (statusFilter !== "all") {
      results = results.filter((event) => {
        const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
        const isPast = event.isPast || eventDate < now
        return statusFilter === "past" ? isPast : !isPast
      })
    }

    results.sort((a, b) => {
      const aDate = a.date instanceof Date ? a.date : new Date(a.date)
      const bDate = b.date instanceof Date ? b.date : new Date(b.date)

      if (sortBy === "date_desc") return bDate.getTime() - aDate.getTime()
      if (sortBy === "date_asc") return aDate.getTime() - bDate.getTime()
      if (sortBy === "title_asc") return a.title.localeCompare(b.title, "ru")
      return b.title.localeCompare(a.title, "ru")
    })

    return results
  }, [filteredEvents, searchQuery, sortBy, statusFilter])

  const monthEventsCount = useMemo(() => {
    const now = new Date()

    return events.filter((event) => {
      const date = event.date instanceof Date ? event.date : new Date(event.date)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length
  }, [events])

  const stats = useMemo(
    () => [
      {
        label: "Всего событий",
        value: events.length,
        hint: "в базе",
        icon: "calendar-days",
      },
      {
        label: "Ближайшие",
        value: upcomingEvents.length,
        hint: "впереди",
        icon: "bolt",
      },
      {
        label: "Материалы",
        value: pastEvents.filter((event) => event.isNews || event.report).length,
        hint: "архив",
        icon: "newspaper",
      },
      {
        label: "В этом месяце",
        value: monthEventsCount,
        hint: "активность",
        icon: "clock",
      },
    ],
    [events.length, upcomingEvents.length, pastEvents, monthEventsCount]
  )

  const nextEvent = useMemo(() => {
    return [...upcomingEvents].sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
    )[0]
  }, [upcomingEvents])

  if (status === "loading") {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="status-spinner" />
          <p className="text-lg text-gray-600">Загрузка dashboard...</p>
          {sessionStuck && <div className="text-sm text-gray-500">Сессия загружается дольше обычного. Попробуйте обновить страницу.</div>}
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <p className="text-lg text-gray-600">Вы не авторизованы</p>
          <Link href="/login" className="btn btn-primary">
            Войти
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page dashboard-redesign pb-10">
      <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6">
        <section className="dashboard-hero-strip">
          <div className="dashboard-hero-copy">
            <p className="dashboard-kicker">БГИТУ Афиша</p>
            <h1>Главная</h1>
            <p>
              События, отчеты, календарь и публикации собраны в одном рабочем экране без лишней витрины.
            </p>
            <div className="dashboard-actions">
              <Link href="/events" className="btn btn-primary w-full px-4 py-2 text-sm sm:w-auto">
                Открыть события
              </Link>
              <Link href="/events/create" className="btn btn-secondary w-full px-4 py-2 text-sm sm:w-auto">
                Создать мероприятие
              </Link>
              <Link href="/calendar" className="btn btn-outline w-full px-4 py-2 text-sm sm:w-auto">
                Календарь
              </Link>
            </div>
          </div>

          <div className="dashboard-next-card">
            <span className="dashboard-kicker">Ближайшее</span>
            {nextEvent ? (
              <>
                <strong>{nextEvent.title}</strong>
                <span>
                  {new Date(nextEvent.date).toLocaleDateString("ru-RU")} • {nextEvent.time} • {nextEvent.location}
                </span>
              </>
            ) : (
              <>
                <strong>Нет ближайших событий</strong>
                <span>Календарь свободен для новых публикаций.</span>
              </>
            )}
          </div>
        </section>

        <section className="dashboard-stat-strip" aria-label="Оперативные метрики">
          {stats.map((item) => (
            <article key={item.label} className="dashboard-stat">
              <i className={`fas fa-${item.icon}`} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </article>
          ))}
        </section>

        {upcomingEvents.length > 0 && (
          <section className="dashboard-banner">
            <Banner events={upcomingEvents.slice(0, 5)} />
          </section>
        )}

        <section className="dashboard-workbench">
          <aside className="dashboard-filter-panel order-3 xl:order-none">
            <CategoryFilter />
            <div className="dashboard-controls">
              <label>
                <span>Сортировка</span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    const nextSort = event.target.value
                    if (isSortBy(nextSort)) setSortBy(nextSort)
                  }}
                >
                  <option value="date_desc">Сначала новые</option>
                  <option value="date_asc">Сначала старые</option>
                  <option value="title_asc">Название А-Я</option>
                  <option value="title_desc">Название Я-А</option>
                </select>
              </label>

              <label>
                <span>Статус</span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    const nextStatus = event.target.value
                    if (isStatusFilter(nextStatus)) setStatusFilter(nextStatus)
                  }}
                >
                  <option value="all">Все</option>
                  <option value="active">Активные</option>
                  <option value="past">Прошедшие</option>
                </select>
              </label>
            </div>
          </aside>

          <main className="dashboard-feed-panel order-1 xl:order-none">
            {searchQuery.trim() && (
              <section className="dashboard-module">
                <div className="dashboard-module-head">
                  <div>
                    <h2>Поиск</h2>
                    <p>Найдено: {searchResults.length}</p>
                  </div>
                  <span>{searchQuery}</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="dashboard-empty">По вашему запросу ничего не найдено.</div>
                ) : (
                  <div className="dashboard-list">
                    {searchResults.slice(0, 20).map((event) => (
                      <Link key={event.id} href={`/events/${event.id}`} className="dashboard-row">
                        <strong>{event.title}</strong>
                        <span>
                          {new Date(event.date).toLocaleDateString("ru-RU")} • {event.time} • {event.location}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="dashboard-module">
              <UpcomingEvents events={upcomingEvents} plain />
            </section>

            <section className="dashboard-module">
              <NewsSection events={pastEvents} plain />
            </section>
          </main>

          <aside className="dashboard-calendar-panel order-2 xl:order-none">
            <CalendarSection events={events} compact plain />
          </aside>
        </section>
      </div>
    </div>
  )
}
