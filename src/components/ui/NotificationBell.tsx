/**
 * File responsibility:
 * Header notification bell with readable dropdown and routing links.
 *
 * Main logic:
 * - Show stable unread badge and latest notifications.
 * - Support loading/error/empty states, outside click and Escape close.
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - src/components/ui/NotificationModal.tsx
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { useAppContext } from "@/contexts/AppContext"
import Button from "./Button"
import Modal from "./Modal"
import NotificationModal from "./NotificationModal"
import { isContentManagerRole } from "@/lib/roles"
import type { Notification } from "@/types"

const resolveNotificationHref = (notification: Notification) => {
  if (notification.link) return notification.link

  const metadata = notification.metadata || {}
  if (typeof metadata.eventId === "string") return `/events/${metadata.eventId}`
  if (typeof metadata.userId === "string") return `/users/${metadata.userId}`
  if (typeof metadata.reportId === "string" && typeof metadata.eventId === "string") {
    return `/events/${metadata.eventId}`
  }
  if (typeof metadata.adminSection === "string") return `/admin?tab=${metadata.adminSection}`
  return null
}

const typeIcon = (type: string) => {
  if (type === "NEW") return "calendar-plus"
  if (type === "CHANGE" || type === "PARTICIPATION_STATUS_CHANGED") return "pen-to-square"
  if (type === "COMPLETE" || type === "EVENT_COMPLETED") return "circle-check"
  if (type === "REPORT_DRAFT_CREATED") return "file-lines"
  if (type === "IMPORT_COMPLETED" || type === "IMPORT_COMPLETED_WITH_ERRORS") return "file-import"
  if (type === "ROLE_ASSIGNED" || type === "LEADER_ASSIGNED") return "user-shield"
  return "circle-info"
}

const NotificationBell = () => {
  const {
    notifications = [],
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshNotifications,
  } = useAppContext()

  const { data: session, status } = useSession()
  const canCreateNotifications = isContentManagerRole(session?.user?.role)
  const router = useRouter()
  const pathname = usePathname()

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null)
  const [dropdownLoading, setDropdownLoading] = useState(false)
  const [dropdownError, setDropdownError] = useState("")

  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  )
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount)
  const unread = notifications.filter((notification) => !notification.read)
  const read = notifications.filter((notification) => notification.read)
  const visibleNotifications = [...unread, ...read].slice(0, 12)

  const activeNotification =
    notifications.find((notification) => notification.id === activeNotificationId) || null
  const activeHref = activeNotification ? resolveNotificationHref(activeNotification) : null

  useEffect(() => {
    if (!isDropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDropdownOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isDropdownOpen])

  useEffect(() => {
    setIsDropdownOpen(false)
    setActiveNotificationId(null)
  }, [pathname])

  useEffect(() => {
    if (activeNotification && !activeNotification.read) {
      markNotificationAsRead(activeNotification.id)
    }
  }, [activeNotification, markNotificationAsRead])

  if (status !== "authenticated") {
    return null
  }

  const openDropdown = async () => {
    const nextState = !isDropdownOpen
    setIsDropdownOpen(nextState)
    if (!nextState) return

    setDropdownLoading(true)
    setDropdownError("")
    try {
      await refreshNotifications()
    } catch {
      setDropdownError("Не удалось обновить уведомления")
    } finally {
      setDropdownLoading(false)
    }
  }

  const handleMarkAllRead = async () => {
    setDropdownError("")
    try {
      markAllNotificationsAsRead()
    } catch {
      setDropdownError("Не удалось отметить уведомления")
    }
  }

  const openNotification = (notification: Notification) => {
    if (!notification.read) {
      markNotificationAsRead(notification.id)
    }

    const href = resolveNotificationHref(notification)
    setIsDropdownOpen(false)
    setIsComposerOpen(false)

    if (href) {
      router.push(href)
      return
    }

    setActiveNotificationId(notification.id)
  }

  return (
    <div className="notification-container relative z-10" ref={dropdownRef}>
      <button
        type="button"
        className="header-icon pressable relative z-10 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary/20 bg-white/90 !overflow-visible text-primary shadow-[0_8px_16px_rgba(18,39,76,0.12)] transition-colors hover:border-accent/60 hover:bg-primary/5"
        onClick={() => void openDropdown()}
        aria-label={`Уведомления${unreadCount ? `, непрочитанных: ${unreadLabel}` : ""}`}
        aria-expanded={isDropdownOpen}
      >
        <i className="fas fa-bell shrink-0" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-count pointer-events-none absolute -right-1 -top-1 z-20 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadLabel}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <div className="dropdown fixed inset-0 z-[960] sm:absolute sm:inset-auto sm:right-0 sm:top-14">
          <div
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm sm:hidden"
            onClick={() => setIsDropdownOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute left-2 right-2 top-[4.25rem] w-auto overflow-hidden rounded-2xl border border-primary/14 bg-white shadow-[0_26px_56px_rgba(16,37,77,0.24)] sm:static sm:max-h-[72vh] sm:w-[23rem]">
            <div className="border-b border-primary/10 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-primary">Уведомления</p>
                  <p className="mt-0.5 text-xs text-primary/58">
                    {unreadCount > 0 ? `${unreadLabel} непрочитанных` : "Все прочитано"}
                  </p>
                </div>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className="rounded-lg border border-primary/12 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                    onClick={() => void handleMarkAllRead()}
                  >
                    Отметить все
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto bg-white sm:max-h-96">
              {dropdownLoading && (
                <div className="space-y-2 p-4">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              )}

              {!dropdownLoading && dropdownError && (
                <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {dropdownError}
                </div>
              )}

              {!dropdownLoading && !dropdownError && notifications.length === 0 && (
                <div className="p-6 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/8 text-primary/45">
                    <i className="fas fa-bell-slash" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-primary">Уведомлений пока нет</p>
                  <p className="mt-1 text-xs text-primary/56">
                    Здесь появятся изменения по мероприятиям, импортам и отчетам.
                  </p>
                </div>
              )}

              {!dropdownLoading && !dropdownError && visibleNotifications.length > 0 && (
                <div>
                  {visibleNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`block w-full border-b border-primary/8 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-primary/5 ${
                        notification.read ? "bg-white" : "bg-primary/[0.045]"
                      }`}
                      onClick={() => openNotification(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            notification.read ? "bg-slate-100 text-slate-500" : "bg-primary text-white"
                          }`}
                        >
                          <i className={`fas fa-${typeIcon(notification.type)} text-xs`} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm font-semibold ${notification.read ? "text-primary/72" : "text-primary"}`}>
                            {notification.title || notification.content}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-primary/60">
                            {notification.content}
                          </span>
                          <span className="mt-1 block text-[11px] text-primary/45">
                            {new Date(notification.createdAt).toLocaleString("ru-RU")}
                          </span>
                        </span>
                        {!notification.read && (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid border-t border-primary/10 bg-white text-sm font-semibold text-primary/78 sm:grid-cols-2">
              <button
                type="button"
                className="px-4 py-3 hover:bg-primary/5"
                onClick={() => {
                  setIsDropdownOpen(false)
                  router.push("/notifications")
                }}
              >
                Все уведомления
              </button>

              {canCreateNotifications ? (
                <button
                  type="button"
                  className="border-t border-primary/10 px-4 py-3 hover:bg-primary/5 sm:border-l sm:border-t-0"
                  onClick={() => {
                    setIsDropdownOpen(false)
                    setIsComposerOpen(true)
                  }}
                >
                  Создать
                </button>
              ) : (
                <button
                  type="button"
                  className="border-t border-primary/10 px-4 py-3 hover:bg-primary/5 sm:border-l sm:border-t-0"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Закрыть
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isComposerOpen && <NotificationModal isOpen={isComposerOpen} onClose={() => setIsComposerOpen(false)} />}

      {activeNotification && (
        <Modal isOpen={Boolean(activeNotification)} onClose={() => setActiveNotificationId(null)} title="Уведомление">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-primary">{activeNotification.title}</p>
              <p className="mt-1 text-xs text-primary/56">
                {new Date(activeNotification.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-primary/78">{activeNotification.content}</div>

            {activeHref ? (
              <Button
                variant="primary"
                onClick={() => {
                  setActiveNotificationId(null)
                  router.push(activeHref)
                }}
              >
                Открыть
              </Button>
            ) : (
              <div className="text-sm text-primary/55">Для этого уведомления нет связанной страницы.</div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default NotificationBell
