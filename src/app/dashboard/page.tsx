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
    <div className="dashboard-page page-shell pb-10">
      <div className="mx-auto max-w-[1320px] px-4 py-4 sm:px-6">
        <section className="grid items-start gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="page-hero p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">Командный центр</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-primary sm:text-3xl">
              Панель управления афишей, {session.user?.name || "пользователь"}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-primary/72">
              Следите за расписанием, публикуйте материалы и быстро переключайтесь между календарем, лентой и карточками событий. Мы вынесли ключевые действия на первый экран, чтобы не искать их по разделам.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href="/events" className="btn btn-primary px-4 py-2.5 text-sm">
                Открыть события
              </Link>
              <Link href="/events/create" className="btn btn-secondary px-4 py-2.5 text-sm">
                Создать мероприятие
              </Link>
              <Link href="/calendar" className="btn btn-outline px-4 py-2.5 text-sm">
                Календарь месяца
              </Link>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="liquid-card px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Поток задач</p>
                <p className="mt-1 text-sm text-primary/72">Проверка материалов и модерация заявок</p>
              </div>
              <div className="liquid-card px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Календарная сетка</p>
                <p className="mt-1 text-sm text-primary/72">Контроль дат и пересечений активности</p>
              </div>
              <div className="liquid-card px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Публикации</p>
                <p className="mt-1 text-sm text-primary/72">Новости и отчеты по прошедшим событиям</p>
              </div>
            </div>
          </article>

          <aside className="liquid-section p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/58">Оперативные метрики</h2>
            <div className="mt-4 grid gap-2.5">
              {stats.map((item) => (
                <article key={item.label} className="liquid-card flex items-center justify-between px-3.5 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/56">{item.label}</p>
                    <p className="mt-0.5 text-2xl font-semibold text-primary">{item.value}</p>
                    <p className="text-[11px] text-primary/55">{item.hint}</p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/16 bg-white text-primary">
                    <i className={`fas fa-${item.icon} text-sm`} />
                  </span>
                </article>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-primary/12 bg-white/75 p-3 text-sm text-primary/68">
              Метрики обновляются автоматически после изменения событий, публикации отчета или настройки категорий.
            </div>
          </aside>
        </section>

        {upcomingEvents.length > 0 && (
          <section className="mt-4">
            <Banner events={upcomingEvents.slice(0, 5)} />
          </section>
        )}

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <div className="liquid-section p-4">
                  <CategoryFilter />
                  <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-primary/65">Параметры ленты</h3>
                  <div className="mt-3 space-y-3 border-t border-primary/12 pt-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/56">Сортировка</label>
                      <select
                        value={sortBy}
                        onChange={(event) => {
                          const nextSort = event.target.value
                          if (isSortBy(nextSort)) setSortBy(nextSort)
                        }}
                        className="liquid-input w-full px-3 py-2 text-sm"
                      >
                        <option value="date_desc">Сначала новые</option>
                        <option value="date_asc">Сначала старые</option>
                        <option value="title_asc">Название А-Я</option>
                        <option value="title_desc">Название Я-А</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/56">Статус</label>
                      <select
                        value={statusFilter}
                        onChange={(event) => {
                          const nextStatus = event.target.value
                          if (isStatusFilter(nextStatus)) setStatusFilter(nextStatus)
                        }}
                        className="liquid-input w-full px-3 py-2 text-sm"
                      >
                        <option value="all">Все</option>
                        <option value="active">Активные</option>
                        <option value="past">Прошедшие</option>
                      </select>
                    </div>
                  </div>
                </div>
              </aside>

              <main className="space-y-5">
                {searchQuery.trim() && (
                  <section className="liquid-section p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold text-primary">Поиск по событиям</h2>
                        <p className="text-sm text-primary/62">Найдено: {searchResults.length}</p>
                      </div>
                      <span className="liquid-chip px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/62">
                        Запрос: {searchQuery}
                      </span>
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="liquid-card p-6 text-sm text-primary/62">По вашему запросу ничего не найдено.</div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-primary/12 bg-white/80">
                        {searchResults.slice(0, 20).map((event, index) => (
                          <Link
                            key={event.id}
                            href={`/events/${event.id}`}
                            className={`block px-3 py-3 transition-colors hover:bg-primary/5 ${index !== Math.min(searchResults.length, 20) - 1 ? "border-b border-primary/12" : ""}`}
                          >
                            <p className="line-clamp-1 text-sm font-semibold text-primary sm:text-base">{event.title}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-primary/62 sm:text-sm">
                              {new Date(event.date).toLocaleDateString("ru-RU")} • {event.time} • {event.location}
                            </p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section className="liquid-section p-4 sm:p-5">
                  <UpcomingEvents events={upcomingEvents} plain />
                </section>

                <section className="liquid-section p-4 sm:p-5">
                  <NewsSection events={pastEvents} plain />
                </section>
              </main>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="liquid-section p-4 sm:p-5">
              <CalendarSection events={events} compact plain />
            </section>

            <section className="liquid-section p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Как работать быстрее</h3>
              <ul className="mt-3 space-y-2 text-sm text-primary/70">
                <li className="rounded-lg border border-primary/12 bg-white/78 px-3 py-2">1. Настройте фильтр категории слева.</li>
                <li className="rounded-lg border border-primary/12 bg-white/78 px-3 py-2">2. Проверяйте пересечения по календарю справа.</li>
                <li className="rounded-lg border border-primary/12 bg-white/78 px-3 py-2">3. Завершайте события отчётом в карточках.</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>
    </div>
  )
}
