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
import { useEffect, useMemo, useOptimistic, useRef, useState } from "react"
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
  CHANGE: "edit",
  COMPLETE: "check-circle",
  EVENT: "bell",
  SYSTEM: "info-circle",
}

type StatusFilter = "all" | "read" | "unread"
type TypeFilter = "all" | "NEW" | "CHANGE" | "COMPLETE" | "EVENT" | "SYSTEM"
type SortOrder = "newest" | "oldest"

type OptimisticAction =
  | { type: "markRead"; id: string }
  | { type: "clearAll" }

const applyOptimisticAction = (state: Notification[], action: OptimisticAction): Notification[] => {
  if (action.type === "clearAll") {
    return []
  }

  if (action.type === "markRead") {
    return state.map((notification) =>
      notification.id === action.id ? { ...notification, read: true } : notification
    )
  }

  return state
}

export default function NotificationsPage() {
  const { notifications, markNotificationAsRead, clearAllNotifications, refreshNotifications } =
    useAppContext()

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")

  const [optimisticNotifications, setOptimisticNotifications] = useOptimistic(
    notifications,
    applyOptimisticAction
  )

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

  const handleMarkRead = (id: string) => {
    setOptimisticNotifications({ type: "markRead", id })
    markNotificationAsRead(id)
  }

  const handleClearAll = () => {
    if (!window.confirm("Очистить историю уведомлений?")) return

    setOptimisticNotifications({ type: "clearAll" })
    clearAllNotifications()
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:py-8 md:px-[5%]">
      <div className="container mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Уведомления</h1>
            <p className="mt-1 text-sm text-gray-500">
              Всего: {optimisticNotifications.length} • Непрочитано: {unreadCount}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              onClick={handleClearAll}
              disabled={optimisticNotifications.length === 0}
            >
              Очистить историю
            </Button>
            <Link
              href="/dashboard"
              className="text-center text-sm text-gray-500 transition-colors hover:text-primary sm:text-left"
            >
              На главную
            </Link>
          </div>
        </div>

        <div className="liquid-section space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по тексту уведомления"
              className="liquid-input px-4 py-3"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="liquid-input px-4 py-3"
            >
              <option value="all">Все статусы</option>
              <option value="unread">Непрочитанные</option>
              <option value="read">Прочитанные</option>
            </select>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="liquid-input px-4 py-3"
            >
              <option value="all">Все типы</option>
              <option value="NEW">Новое событие</option>
              <option value="CHANGE">Изменение</option>
              <option value="COMPLETE">Завершение</option>
              <option value="EVENT">Событие</option>
              <option value="SYSTEM">Системное</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`liquid-chip px-4 py-2 ${
                sortOrder === "newest" ? "text-primary" : "text-gray-500"
              }`}
              onClick={() => setSortOrder("newest")}
            >
              Сначала новые
            </button>
            <button
              type="button"
              className={`liquid-chip px-4 py-2 ${
                sortOrder === "oldest" ? "text-primary" : "text-gray-500"
              }`}
              onClick={() => setSortOrder("oldest")}
            >
              Сначала старые
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="liquid-section p-8 text-center text-gray-500">
              Уведомлений не найдено.
            </div>
          ) : (
            filtered.map((notification) => {
              const eventId =
                typeof notification.metadata?.eventId === "string"
                  ? notification.metadata.eventId
                  : null

              return (
                <div
                  key={notification.id}
                  className={`liquid-card liquid-card-hover space-y-4 p-4 sm:p-6 ${
                    notification.read ? "opacity-85" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-accent shadow">
                        <i className={`fas fa-${typeIcons[notification.type] || "bell"}`}></i>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                          {typeLabels[notification.type] || notification.type}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-gray-900">
                          {notification.title || "Уведомление"}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                          {notification.content}
                        </div>
                      </div>
                    </div>

                    <div className="text-left text-xs text-gray-400 sm:text-right">
                      {new Date(notification.createdAt).toLocaleString("ru-RU")}
                      <div
                        className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                          notification.read
                            ? "bg-gray-100 text-gray-500"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
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
                      <Link href={`/events/${eventId}`} className="text-accent hover:text-primary">
                        Перейти к мероприятию
                      </Link>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}