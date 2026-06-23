/**
 * File responsibility:
 * Public event poster page available without authentication.
 *
 * Main logic:
 * - Load public events from the shared events API.
 * - Provide safe filters and cards without participant/private data.
 * - Send protected actions to the login flow with callback URL.
 *
 * Integrations:
 * - src/app/page.tsx
 * - src/app/afisha/page.tsx
 * - src/features/events/client/events-api.ts
 */
"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { EventCategory } from "@prisma/client"
import { fetchPublicEventsApi } from "@/features/events/client/events-api"
import { CategoryDisplayMap, type Event } from "@/types"

const formatDateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getEventStatus = (event: Event) => {
  const date = event.date instanceof Date ? event.date : new Date(event.date)
  return event.isPast || date < new Date() ? "past" : "upcoming"
}

const getDepartments = (event: Event) =>
  [
    event.creator?.department,
    ...(event.moderators || []).map((moderator) => moderator.department),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)

const getHeroImage = (event: Event) =>
  event.images?.[0] ||
  `https://placehold.co/1200x800/1f5fe0/ffffff?text=${encodeURIComponent(event.title.slice(0, 28))}`

const getPlaceholderImage = (event: Event) =>
  `https://placehold.co/1200x800/1f5fe0/ffffff?text=${encodeURIComponent(event.title.slice(0, 28))}`

const getCategoryColor = (category: EventCategory) => {
  const colors: Record<EventCategory, string> = {
    [EventCategory.CONCERT]: "bg-blue-100/95 text-blue-800 border-blue-200",
    [EventCategory.INTERNAL_ACTIVITY]: "bg-indigo-100/95 text-indigo-800 border-indigo-200",
    [EventCategory.PUBLIC_EVENT]: "bg-cyan-100/95 text-cyan-800 border-cyan-200",
    [EventCategory.COMPETITION]: "bg-violet-100/95 text-violet-800 border-violet-200",
    [EventCategory.LECTURE]: "bg-sky-100/95 text-sky-800 border-sky-200",
    [EventCategory.MASTERCLASS]: "bg-amber-100/95 text-amber-800 border-amber-200",
    [EventCategory.VOLUNTEER]: "bg-emerald-100/95 text-emerald-800 border-emerald-200",
    [EventCategory.NEWS]: "bg-slate-100/95 text-slate-800 border-slate-200",
  }

  return colors[category] || "bg-white/95 text-primary border-white/70"
}

const hasReadableText = (value: string | null | undefined) => {
  const normalized = String(value || "").trim()
  if (!normalized) return false
  return /[\p{L}\p{N}]/u.test(normalized)
}

const getDisplayText = (value: string | null | undefined, fallback: string) =>
  hasReadableText(value) ? String(value).trim() : fallback

const formatEventDateTime = (date: Date, time?: string | null) =>
  `${date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}${time ? `, ${time}` : ""}`

const getStatusButtonClass = (active: boolean) =>
  active
    ? "border-transparent bg-gradient-to-r from-primary to-accent text-white shadow-[0_12px_22px_rgba(36,88,198,0.22)]"
    : "border-primary/12 bg-white/70 text-primary/74 hover:border-primary/24 hover:bg-white"

const PublicEventCard = ({ event, authenticated }: { event: Event; authenticated: boolean }) => {
  const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
  const status = getEventStatus(event)
  const departments = getDepartments(event)
  const categoryName = CategoryDisplayMap[event.category as EventCategory] || event.category
  const eventHref = `/events/${event.id}`
  const loginHref = `/login?callbackUrl=${encodeURIComponent(eventHref)}`
  const [imageError, setImageError] = useState(false)

  const safeLocation = getDisplayText(event.location, "Место уточняется")
  const safeDescription = getDisplayText(event.description, "Описание события скоро появится.")
  const departmentSummary =
    departments.length > 0
      ? departments.slice(0, 2).join(" • ")
      : status === "past"
        ? "Событие из архива афиши"
        : "Открытое событие кампуса"

  return (
    <article className="liquid-card liquid-card-hover group flex h-full flex-col overflow-hidden rounded-[1.55rem] border-white/70 shadow-[0_20px_44px_rgba(16,37,77,0.1)]">
      <Link href={eventHref} className="relative block h-48 overflow-hidden border-b border-primary/10 sm:h-52">
        <Image
          src={imageError ? getPlaceholderImage(event) : getHeroImage(event)}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          onError={() => setImageError(true)}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#041126]/10 via-[#041126]/16 to-[#041126]/78" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm ${getCategoryColor(
              event.category as EventCategory
            )}`}
          >
            {categoryName}
          </span>
          <span className="rounded-full border border-white/25 bg-[#06172e]/72 px-3 py-1 text-xs font-semibold text-white">
            {status === "past" ? "Завершено" : "Скоро"}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="text-sm font-semibold text-white">{formatEventDateTime(eventDate, event.time)}</div>
          <span className="hidden rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/88 backdrop-blur-md sm:inline-flex">
            {departmentSummary}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/6 px-3 py-1 text-[11px] font-semibold text-primary/72">
            {status === "past" ? "Архив афиши" : "Регистрация и детали внутри"}
          </span>
          {departments.length > 0 && (
            <span className="rounded-full bg-accent/8 px-3 py-1 text-[11px] font-semibold text-accent">
              {departments[0]}
            </span>
          )}
        </div>

        <Link href={eventHref} className="line-clamp-2 text-lg font-semibold leading-snug text-primary hover:underline">
          {event.title}
        </Link>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-primary/68">{safeDescription}</p>

        <div className="mt-4 space-y-2 text-sm text-primary/72">
          <div className="flex gap-2">
            <i className="fas fa-location-dot mt-1 w-4 text-accent" aria-hidden="true" />
            <span className="line-clamp-2">{safeLocation}</span>
          </div>

          {departments.length > 0 && (
            <div className="flex gap-2">
              <i className="fas fa-building-columns mt-1 w-4 text-accent" aria-hidden="true" />
              <span className="line-clamp-2">{departments.join(", ")}</span>
            </div>
          )}

          <div className="flex gap-2">
            <i className="fas fa-users mt-1 w-4 text-accent" aria-hidden="true" />
            <span>
              {event.currentParticipants}
              {event.maxParticipants > 0 ? `/${event.maxParticipants}` : ""} участников
            </span>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap">
          <Link
            href={eventHref}
            className="inline-flex w-full flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/14 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5"
          >
            <i className="fas fa-eye text-xs" aria-hidden="true" />
            Подробнее
          </Link>

          {status === "upcoming" && (
            <Link
              href={authenticated ? eventHref : loginHref}
              className="inline-flex w-full flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(36,88,198,0.2)] transition hover:bg-primary/90"
            >
              <i
                className={`fas ${authenticated ? "fa-ticket" : "fa-right-to-bracket"} text-xs`}
                aria-hidden="true"
              />
              {authenticated ? "Участвовать" : "Войти и записаться"}
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

export default function PublicAfishaPage() {
  const { status } = useSession()
  const authenticated = status === "authenticated"
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past">("upcoming")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")

    fetchPublicEventsApi({ signal: controller.signal })
      .then((data) => setEvents(data))
      .catch((reason) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить афишу")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const departments = useMemo(
    () => Array.from(new Set(events.flatMap(getDepartments))).sort((left, right) => left.localeCompare(right, "ru")),
    [events]
  )

  const categories = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.category))).sort((left, right) =>
        String(left).localeCompare(String(right), "ru")
      ),
    [events]
  )

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return events.filter((event) => {
      const statusValue = getEventStatus(event)
      const haystack = [
        event.title,
        event.description,
        event.location,
        event.responsible,
        CategoryDisplayMap[event.category as EventCategory] || event.category,
      ]
        .join(" ")
        .toLowerCase()

      if (statusFilter !== "all" && statusValue !== statusFilter) return false
      if (categoryFilter !== "all" && event.category !== categoryFilter) return false
      if (departmentFilter !== "all" && !getDepartments(event).includes(departmentFilter)) return false
      if (dateFilter && formatDateKey(event.date) !== dateFilter) return false
      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false

      return true
    })
  }, [categoryFilter, dateFilter, departmentFilter, events, search, statusFilter])

  const upcomingCount = events.filter((event) => getEventStatus(event) === "upcoming").length
  const pastCount = events.length - upcomingCount

  const nextUpcomingEvent = useMemo(() => {
    return (
      [...events]
        .filter((event) => getEventStatus(event) === "upcoming")
        .sort((left, right) => {
          const leftDate = left.date instanceof Date ? left.date.getTime() : new Date(left.date).getTime()
          const rightDate = right.date instanceof Date ? right.date.getTime() : new Date(right.date).getTime()
          return leftDate - rightDate
        })[0] || null
    )
  }, [events])

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "upcoming" ||
    categoryFilter !== "all" ||
    departmentFilter !== "all" ||
    Boolean(dateFilter)

  const activeFilters = useMemo(() => {
    const filters: string[] = []

    if (search.trim()) filters.push(`Поиск: ${search.trim()}`)
    if (statusFilter === "all") filters.push("Статус: все")
    if (statusFilter === "past") filters.push("Статус: завершённые")
    if (categoryFilter !== "all") {
      filters.push(`Категория: ${CategoryDisplayMap[categoryFilter as EventCategory] || categoryFilter}`)
    }
    if (departmentFilter !== "all") filters.push(`Подразделение: ${departmentFilter}`)
    if (dateFilter) filters.push(`Дата: ${new Date(dateFilter).toLocaleDateString("ru-RU")}`)

    return filters
  }, [categoryFilter, dateFilter, departmentFilter, search, statusFilter])

  const resetFilters = () => {
    setSearch("")
    setStatusFilter("upcoming")
    setCategoryFilter("all")
    setDepartmentFilter("all")
    setDateFilter("")
  }

  return (
    <div className="page-shell min-h-screen px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="page-hero overflow-hidden p-5 sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(36,88,198,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,143,140,0.1),transparent_32%)]" />

          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px] xl:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="liquid-chip px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  БГИТУ Афиша
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Без авторизации
                </span>
                <span className="rounded-full border border-primary/10 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/62">
                  Обновляется по мере публикаций
                </span>
              </div>

              <h1 className="page-title mt-4 text-3xl font-semibold sm:text-4xl lg:text-[3.35rem] lg:leading-[1.04]">
                Публичная афиша мероприятий
              </h1>
              <p className="page-subtitle mt-4 max-w-2xl text-base leading-7">
                Открытые события университета доступны без авторизации. Здесь можно быстро посмотреть афишу, а после
                входа — записаться, получать уведомления и открыть личный кабинет без лишних шагов.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#public-afisha-grid" className="btn btn-primary px-4 py-3 text-sm">
                  <i className="fas fa-calendar-days text-xs" aria-hidden="true" />
                  Смотреть события
                </a>
                <Link href={authenticated ? "/dashboard" : "/login"} className="btn btn-secondary px-4 py-3 text-sm">
                  <i
                    className={`fas ${authenticated ? "fa-table-columns" : "fa-right-to-bracket"} text-xs`}
                    aria-hidden="true"
                  />
                  {authenticated ? "Открыть кабинет" : "Войти и настроить уведомления"}
                </Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <article className="liquid-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <i className="fas fa-calendar-days text-sm" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/52">Скоро</p>
                      <p className="mt-1 text-3xl font-semibold text-primary">{upcomingCount}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-primary/58">
                    Актуальные события с открытым просмотром и подробной карточкой.
                  </p>
                </article>

                <article className="liquid-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      <i className="fas fa-box-archive text-sm" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/52">Архив</p>
                      <p className="mt-1 text-3xl font-semibold text-primary">{pastCount}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-primary/58">
                    Прошедшие мероприятия остаются доступны для просмотра и истории.
                  </p>
                </article>

                <article className="liquid-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                      <i className="fas fa-unlock-keyhole text-sm" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/52">Доступ</p>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {authenticated ? "Вы уже вошли" : "Гостевой просмотр"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-primary/58">
                    Личный кабинет, участие и уведомления открываются сразу после входа.
                  </p>
                </article>
              </div>
            </div>

            <aside className="liquid-card rounded-[1.65rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,247,255,0.92))] p-5 shadow-[0_22px_48px_rgba(18,39,76,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">Следующее событие</p>
                  <h2 className="mt-2 text-lg font-semibold text-primary">Ближайшая точка входа в афишу</h2>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <i className="fas fa-star text-sm" aria-hidden="true" />
                </span>
              </div>

              {nextUpcomingEvent ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.4rem] border border-primary/10 bg-white/78 p-4 shadow-[0_12px_26px_rgba(18,39,76,0.08)]">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${getCategoryColor(
                        nextUpcomingEvent.category as EventCategory
                      )}`}
                    >
                      {CategoryDisplayMap[nextUpcomingEvent.category as EventCategory] || nextUpcomingEvent.category}
                    </span>
                    <p className="mt-3 text-lg font-semibold leading-7 text-primary">{nextUpcomingEvent.title}</p>
                    <div className="mt-3 space-y-2 text-sm text-primary/68">
                      <p className="flex gap-2">
                        <i className="fas fa-calendar-day mt-1 w-4 text-accent" aria-hidden="true" />
                        <span>
                          {formatEventDateTime(
                            nextUpcomingEvent.date instanceof Date
                              ? nextUpcomingEvent.date
                              : new Date(nextUpcomingEvent.date),
                            nextUpcomingEvent.time
                          )}
                        </span>
                      </p>
                      <p className="flex gap-2">
                        <i className="fas fa-location-dot mt-1 w-4 text-accent" aria-hidden="true" />
                        <span>{getDisplayText(nextUpcomingEvent.location, "Место уточняется")}</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.3rem] border border-primary/10 bg-primary/[0.04] p-4 text-sm leading-6 text-primary/70">
                    Сначала можно просто изучить афишу, а потом — войти через Telegram, Яндекс или email и подключить
                    уведомления для важных событий.
                  </div>

                  <Link
                    href={`/events/${nextUpcomingEvent.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(36,88,198,0.2)] transition hover:bg-primary/90"
                  >
                    <i className="fas fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
                    Открыть карточку события
                  </Link>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.4rem] border border-dashed border-primary/16 bg-white/70 p-5 text-sm leading-6 text-primary/62">
                  Новые открытые мероприятия появятся здесь сразу после публикации. Пока можно войти в систему и
                  подготовить уведомления заранее.
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="liquid-section p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/52">Поиск и фильтры</p>
                <h2 className="mt-2 text-2xl font-semibold text-primary">Найдите событие за пару секунд</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-primary/64">
                  Оставили понятные фильтры по статусу, дате, категории и подразделению — чтобы афиша оставалась
                  лёгкой даже при большом количестве карточек.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-2xl border border-primary/10 bg-white/70 px-4 py-2.5 text-sm text-primary/64">
                  Показано: <span className="font-semibold text-primary">{filteredEvents.length}</span>
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="inline-flex items-center justify-center rounded-2xl border border-primary/14 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Сбросить фильтры
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("upcoming")}
                className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition ${getStatusButtonClass(statusFilter === "upcoming")}`}
              >
                Ближайшие
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition ${getStatusButtonClass(statusFilter === "all")}`}
              >
                Все публикации
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("past")}
                className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition ${getStatusButtonClass(statusFilter === "past")}`}
              >
                Архив
              </button>
            </div>

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <span
                    key={filter}
                    className="inline-flex items-center rounded-full border border-primary/10 bg-primary/[0.04] px-3 py-1.5 text-xs font-semibold text-primary/70"
                  >
                    {filter}
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[1.3fr_0.75fr_0.75fr] xl:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.8fr]">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Поиск</span>
                <div className="mt-1 flex items-center gap-3 rounded-xl border border-primary/14 bg-white px-3 py-2.5 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <i className="fas fa-magnifying-glass text-sm text-primary/42" aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full bg-transparent text-sm text-primary outline-none"
                    placeholder="Название, место, описание"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Статус</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | "upcoming" | "past")}
                  className="mt-1 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="upcoming">Ближайшие</option>
                  <option value="all">Все</option>
                  <option value="past">Завершённые</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Дата</span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Категория</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="all">Все категории</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {CategoryDisplayMap[category as EventCategory] || category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">
                  Факультет/направление
                </span>
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="all">Все</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        {loading && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-[25rem] animate-pulse rounded-[1.6rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,247,255,0.78))] shadow-[0_18px_36px_rgba(16,37,77,0.08)]"
              />
            ))}
          </section>
        )}

        {!loading && error && (
          <section className="page-empty rounded-[1.7rem]">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-500">
              <i className="fas fa-triangle-exclamation text-xl" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-primary">Афиша временно недоступна</h2>
            <p className="mt-2 text-primary/62">{error}</p>
          </section>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <section className="page-empty rounded-[1.7rem]">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/8 text-primary/45">
              <i className="fas fa-calendar-days text-xl" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-primary">Мероприятий не найдено</h2>
            <p className="mt-2 text-primary/62">Измените фильтры или вернитесь к афише позже.</p>
          </section>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <section id="public-afisha-grid" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredEvents.map((event) => (
              <PublicEventCard key={event.id} event={event} authenticated={authenticated} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
