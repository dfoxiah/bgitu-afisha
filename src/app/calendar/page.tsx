/**
 * File responsibility:
 * Calendar route page for monthly/day event navigation.
 *
 * Main logic:
 * - Render calendar module with selected dates.
 * - Display events grouped by date.
 *
 * Integrations:
 * - src/components/events/Calendar.tsx
 * - AppContext events data
 */
"use client"
import { useSession } from "next-auth/react"
import { endOfWeek, isWithinInterval, startOfWeek } from "date-fns"
import { useAppContext } from "@/contexts/AppContext"
import CalendarSection from "@/components/sections/CalendarSection"

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const { events } = useAppContext()

  const now = new Date()
  const monthCount = events.filter((event) => {
    const date = new Date(event.date)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && !event.removedFromCalendar
  }).length

  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const weekCount = events.filter((event) => {
    const date = new Date(event.date)
    return isWithinInterval(date, { start: weekStart, end: weekEnd }) && !event.removedFromCalendar
  }).length

  const upcomingCount = events.filter((event) => new Date(event.date) >= now && !event.removedFromCalendar).length

  const nearestEvents = [...events]
    .filter((event) => !event.removedFromCalendar && new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6)

  if (status === "loading") {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="status-spinner" />
          <p className="text-lg text-gray-600">Загрузка календаря...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <p className="text-lg text-gray-600">Вы не авторизованы</p>
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-page page-shell px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="grid items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="page-hero p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">Planning Board</p>
            <h1 className="page-title mt-2 text-2xl font-bold sm:text-4xl">Календарь мероприятий</h1>
            <p className="page-subtitle mt-3 text-sm sm:text-base">
              Планируйте активность по датам, отслеживайте загруженность недели и быстро открывайте карточки событий из календарной сетки.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              <div className="liquid-card px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Режим</p>
                <p className="mt-1 text-sm font-semibold text-primary">Месячный обзор</p>
              </div>
              <div className="liquid-card px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Навигация</p>
                <p className="mt-1 text-sm font-semibold text-primary">По дням и месяцам</p>
              </div>
              <div className="liquid-card px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Модальные окна</p>
                <p className="mt-1 text-sm font-semibold text-primary">Список за день/месяц</p>
              </div>
            </div>
          </article>

          <aside className="liquid-section grid gap-2 p-3.5 sm:grid-cols-3 xl:grid-cols-1">
            <div className="liquid-card px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/58">В этом месяце</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{monthCount}</p>
            </div>
            <div className="liquid-card px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/58">На этой неделе</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{weekCount}</p>
            </div>
            <div className="liquid-card px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/58">Предстоит</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{upcomingCount}</p>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <CalendarSection events={events} />

          <aside className="space-y-4 xl:sticky xl:top-[124px] xl:h-fit">
            <section className="liquid-section p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Ближайшие даты</h2>
              {nearestEvents.length === 0 ? (
                <p className="mt-3 text-sm text-primary/62">Ближайших событий пока нет.</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-primary/12 bg-white/82">
                  {nearestEvents.map((event, index) => (
                    <div key={event.id} className={`px-3 py-2.5 ${index !== nearestEvents.length - 1 ? 'border-b border-primary/12' : ''}`}>
                      <p className="line-clamp-1 text-sm font-semibold text-primary">{event.title}</p>
                      <p className="mt-1 text-xs text-primary/62">
                        {new Date(event.date).toLocaleDateString('ru-RU')} • {event.time}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="liquid-section p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Подсказка</h3>
              <p className="mt-3 text-sm text-primary/68">
                Нажмите на день, чтобы сразу открыть список событий за дату. Кнопка «Список месяца» в календаре показывает все активности выбранного месяца.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </div>
  )
}
