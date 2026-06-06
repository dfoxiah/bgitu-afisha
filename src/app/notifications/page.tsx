/**
 * File responsibility:
 * Notifications center page with search/filter/sort controls.
 *
 * Main logic:
 * - Render current user notifications with filtering
 * - Apply optimistic UI updates for read/clear actions
 *
 * Integrations:
 * - src/contexts/AppContext.tsx notification actions
 */

"use client"

import Link from "next/link"
import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react"
import Button from "@/components/ui/Button"
import { useAppContext } from "@/contexts/AppContext"
import type { Notification } from "@/types"

const typeLabels: Record<string, string> = {
  NEW: "Новое событие",
  CHANGE: "Изменение",
  COMPLETE: "Завершение",
  EVENT: "Событие",
  SYSTEM: "Системное",
}

const typeIcons: Record<string, string> = {
  NEW: "calendar-plus",
  CHANGE: "pen-to-square",
  COMPLETE: "check-circle",
  EVENT: "bell",
  SYSTEM: "circle-info",
}

type StatusFilter = "all" | "read" | "unread"
type TypeFilter = "all" | "NEW" | "CHANGE" | "COMPLETE" | "EVENT" | "SYSTEM"
type SortOrder = "newest" | "oldest"

type OptimisticAction = { type: "markRead"; id: string } | { type: "clearAll" }

const applyOptimisticAction = (state: Notification[], action: OptimisticAction): Notification[] => {
  if (action.type === "clearAll") {
    return []
  }

  if (action.type === "markRead") {
    return state.map((notification) => (notification.id === action.id ? { ...notification, read: true } : notification))
  }

  return state
}

export default function NotificationsPage() {
  const { notifications, markNotificationAsRead, clearAllNotifications, refreshNotifications } = useAppContext()

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")

  const [optimisticNotifications, setOptimisticNotifications] = useOptimistic(notifications, applyOptimisticAction)

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    refreshNotifications()
  }, [refreshNotifications])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const result = optimisticNotifications.filter((notification) => {
      if (statusFilter === "read" && !notification.read) return false
      if (statusFilter === "unread" && notification.read) return false
      if (typeFilter !== "all" && notification.type !== typeFilter) return false

      if (normalizedQuery) {
        const haystack = `${notification.title} ${notification.content}`.toLowerCase()
        if (!haystack.includes(normalizedQuery)) return false
      }

      return true
    })

    result.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime
    })

    return result
  }, [optimisticNotifications, query, statusFilter, typeFilter, sortOrder])

  const unreadCount = optimisticNotifications.filter((notification) => !notification.read).length
  const totalCount = optimisticNotifications.length

  const todayCount = optimisticNotifications.filter((notification) => {
    const date = new Date(notification.createdAt)
    return date.toDateString() === new Date().toDateString()
  }).length

  const handleMarkRead = (id: string) => {
    startTransition(() => {
      setOptimisticNotifications({ type: "markRead", id })
    })
    markNotificationAsRead(id)
  }

  const handleClearAll = () => {
    if (!window.confirm("Очистить историю уведомлений?")) return

    startTransition(() => {
      setOptimisticNotifications({ type: "clearAll" })
    })
    clearAllNotifications()
  }

  return (
    <div className="notifications-page page-shell min-h-screen px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="page-hero p-4 sm:p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">Notification Center</p>
            <h1 className="page-title mt-2 text-2xl font-semibold sm:text-4xl">Уведомления</h1>
            <p className="mt-3 text-sm text-primary/66 sm:text-base">
              Контролируйте изменения по событиям, быстро фильтруйте сообщения и отмечайте прочитанные уведомления без лишних действий.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button variant="secondary" onClick={handleClearAll} disabled={totalCount === 0}>
                Очистить историю
              </Button>
              <Link href="/dashboard" className="btn btn-outline px-4 py-2 text-sm">
                На dashboard
              </Link>
            </div>
          </article>

          <aside className="liquid-section grid gap-2 p-3.5 sm:grid-cols-3 xl:grid-cols-1">
            <div className="liquid-card px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Всего</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{totalCount}</p>
            </div>
            <div className="liquid-card px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Непрочитано</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{unreadCount}</p>
            </div>
            <div className="liquid-card px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Сегодня</p>
              <p className="mt-1 text-3xl font-semibold text-primary">{todayCount}</p>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-[124px] xl:h-fit">
            <section className="liquid-section space-y-4 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Фильтры</h2>

              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по уведомлениям"
                className="liquid-input w-full px-4 py-3"
              />

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="liquid-input w-full px-4 py-3">
                <option value="all">Все статусы</option>
                <option value="unread">Непрочитанные</option>
                <option value="read">Прочитанные</option>
              </select>

              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="liquid-input w-full px-4 py-3">
                <option value="all">Все типы</option>
                <option value="NEW">Новое событие</option>
                <option value="CHANGE">Изменение</option>
                <option value="COMPLETE">Завершение</option>
                <option value="EVENT">Событие</option>
                <option value="SYSTEM">Системное</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={`liquid-chip px-3 py-2 text-xs ${sortOrder === "newest" ? "bg-gradient-to-r from-primary to-accent text-white" : ""}`} onClick={() => setSortOrder("newest")}>
                  Сначала новые
                </button>
                <button type="button" className={`liquid-chip px-3 py-2 text-xs ${sortOrder === "oldest" ? "bg-gradient-to-r from-primary to-accent text-white" : ""}`} onClick={() => setSortOrder("oldest")}>
                  Сначала старые
                </button>
              </div>
            </section>

            <section className="liquid-section p-4 text-sm text-primary/68">
              <p className="font-semibold text-primary">Совет</p>
              <p className="mt-2">Непрочитанные уведомления подсвечены. Откройте событие прямо из карточки, если к уведомлению привязан `eventId`.</p>
            </section>
          </aside>

          <section className="space-y-4">
            {filtered.length === 0 ? (
              <div className="page-empty">Уведомления не найдены.</div>
            ) : (
              filtered.map((notification) => {
                const eventId = typeof notification.metadata?.eventId === "string" ? notification.metadata.eventId : null

                return (
                  <article key={notification.id} className={`notification-stream-row space-y-4 p-4 sm:p-5 ${notification.read ? "opacity-90" : "is-unread"}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/18 bg-[#fff8e8] text-primary">
                          <i className={`fas fa-${typeIcons[notification.type] || "bell"}`} />
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-primary/54">{typeLabels[notification.type] || notification.type}</div>
                          <div className="mt-1 text-lg font-semibold text-primary">{notification.title || "Уведомление"}</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-primary/72">{notification.content}</div>
                        </div>
                      </div>

                      <div className="text-left text-xs text-primary/52 sm:text-right">
                        {new Date(notification.createdAt).toLocaleString("ru-RU")}
                        <div className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${notification.read ? "border-primary/16 bg-white text-primary/58" : "border-primary/26 bg-primary/10 text-primary"}`}>
                          {notification.read ? "прочитано" : "не прочитано"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {!notification.read && (
                        <Button variant="secondary" onClick={() => handleMarkRead(notification.id)}>
                          Отметить как прочитанное
                        </Button>
                      )}

                      {eventId && (
                        <Link href={`/events/${eventId}`} className="rounded-lg border border-primary/16 bg-[#fff8e8] px-3 py-1.5 text-sm font-medium text-primary hover:bg-white">
                          Открыть мероприятие
                        </Link>
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </section>
        </section>
      </div>
    </div>
  )
}
