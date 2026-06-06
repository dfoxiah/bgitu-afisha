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

const PublicEventCard = ({ event, authenticated }: { event: Event; authenticated: boolean }) => {
  const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
  const status = getEventStatus(event)
  const departments = getDepartments(event)
  const categoryName = CategoryDisplayMap[event.category as EventCategory] || event.category
  const eventHref = `/events/${event.id}`
  const loginHref = `/login?callbackUrl=${encodeURIComponent(eventHref)}`
  const [imageError, setImageError] = useState(false)

  return (
    <article className="liquid-card liquid-card-hover flex h-full flex-col overflow-hidden">
      <Link href={eventHref} className="relative block h-44 overflow-hidden border-b border-primary/10">
        <Image
          src={imageError ? getPlaceholderImage(event) : getHeroImage(event)}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover transition-transform duration-500 hover:scale-105"
          onError={() => setImageError(true)}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#041126]/8 via-[#041126]/12 to-[#041126]/70" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/35 bg-white/92 px-3 py-1 text-xs font-semibold text-primary">
            {categoryName}
          </span>
          <span className="rounded-full border border-white/25 bg-[#06172e]/72 px-3 py-1 text-xs font-semibold text-white">
            {status === "past" ? "Завершено" : "Скоро"}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white">
          {eventDate.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {event.time ? `, ${event.time}` : ""}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={eventHref} className="line-clamp-2 text-lg font-semibold leading-snug text-primary hover:underline">
          {event.title}
        </Link>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-primary/68">{event.description}</p>

        <div className="mt-4 space-y-2 text-sm text-primary/72">
          <div className="flex gap-2">
            <i className="fas fa-location-dot mt-1 w-4 text-accent" aria-hidden="true" />
            <span className="line-clamp-2">{event.location}</span>
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

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Link
            href={eventHref}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-primary/14 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
          >
            Подробнее
          </Link>
          {status === "upcoming" && (
            <Link
              href={authenticated ? eventHref : loginHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              {authenticated ? "Участвовать" : "Войти"}
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
      const status = getEventStatus(event)
      const haystack = [
        event.title,
        event.description,
        event.location,
        event.responsible,
        CategoryDisplayMap[event.category as EventCategory] || event.category,
      ]
        .join(" ")
        .toLowerCase()

      if (statusFilter !== "all" && status !== statusFilter) return false
      if (categoryFilter !== "all" && event.category !== categoryFilter) return false
      if (departmentFilter !== "all" && !getDepartments(event).includes(departmentFilter)) return false
      if (dateFilter && formatDateKey(event.date) !== dateFilter) return false
      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false
      return true
    })
  }, [categoryFilter, dateFilter, departmentFilter, events, search, statusFilter])

  const upcomingCount = events.filter((event) => getEventStatus(event) === "upcoming").length
  const pastCount = events.length - upcomingCount

  return (
    <div className="page-shell min-h-screen px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="page-hero overflow-hidden p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">
                БГИТУ Афиша
              </p>
              <h1 className="page-title mt-3 text-3xl font-semibold sm:text-4xl">
                Публичная афиша мероприятий
              </h1>
              <p className="page-subtitle mt-4 max-w-2xl text-base leading-7">
                Открытые события университета доступны без авторизации. Заявка на участие,
                личные уведомления и закрытые разделы открываются после входа.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <article className="liquid-card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/55">Скоро</p>
                <p className="mt-1 text-3xl font-semibold text-primary">{upcomingCount}</p>
              </article>
              <article className="liquid-card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/55">Архив</p>
                <p className="mt-1 text-3xl font-semibold text-primary">{pastCount}</p>
              </article>
              <article className="liquid-card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/55">Доступ</p>
                <p className="mt-1 text-sm font-semibold text-primary">{authenticated ? "Вы вошли" : "Гостевой"}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="liquid-section p-4">
          <div className="grid gap-3 md:grid-cols-[1.3fr_0.75fr_0.75fr] xl:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.8fr]">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Поиск</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-1 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="Название, место, описание"
              />
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
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Факультет/направление</span>
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
        </section>

        {loading && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-2xl bg-white/70 shadow-[0_18px_36px_rgba(16,37,77,0.08)]" />
            ))}
          </section>
        )}

        {!loading && error && (
          <section className="page-empty">
            <i className="fas fa-triangle-exclamation mb-4 text-4xl text-red-400" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-primary">Афиша временно недоступна</h2>
            <p className="mt-2 text-primary/62">{error}</p>
          </section>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <section className="page-empty">
            <i className="fas fa-calendar-days mb-4 text-4xl text-primary/25" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-primary">Мероприятий не найдено</h2>
            <p className="mt-2 text-primary/62">Измените фильтры или вернитесь к афише позже.</p>
          </section>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredEvents.map((event) => (
              <PublicEventCard key={event.id} event={event} authenticated={authenticated} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
