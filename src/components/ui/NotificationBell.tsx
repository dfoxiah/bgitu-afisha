/**
 * File responsibility:
 * Header notification bell with quick actions and preview modal.
 *
 * Main logic:
 * - Show unread counter and latest notifications
 * - Allow mark-all-read and open notification details
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - src/components/ui/NotificationModal.tsx
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/contexts/AppContext"
import Button from "./Button"
import Modal from "./Modal"
import NotificationModal from "./NotificationModal"

const NotificationBell = () => {
  const {
    notifications = [],
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshNotifications,
  } = useAppContext()

  const { data: session } = useSession()
  const canCreateNotifications = session?.user?.role === "TEACHER" || session?.user?.role === "ADMIN"
  const router = useRouter()

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  )

  const activeNotification =
    notifications.find((notification) => notification.id === activeNotificationId) || null
  const activeEventId =
    typeof activeNotification?.metadata?.eventId === "string"
      ? activeNotification.metadata.eventId
      : null

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (activeNotification && !activeNotification.read) {
      markNotificationAsRead(activeNotification.id)
    }
  }, [activeNotification, markNotificationAsRead])

  const handleMarkAllRead = () => {
    if (!window.confirm("Отметить все уведомления как прочитанные?")) return

    markAllNotificationsAsRead()
    setIsDropdownOpen(false)
    setActiveNotificationId(null)
  }

  return (
    <div className="notification-container relative" ref={dropdownRef}>
      <div
        className="header-icon pressable flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary/20 bg-white/88 text-primary shadow-[0_8px_16px_rgba(18,39,76,0.12)] transition-colors hover:border-accent/60 hover:bg-primary/5"
        onClick={() => {
          const nextState = !isDropdownOpen
          setIsDropdownOpen(nextState)
          if (nextState) {
            refreshNotifications()
          }
        }}
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <div className="notification-count absolute -right-1 -top-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </div>

      {isDropdownOpen && (
        <div className="dropdown fixed inset-0 z-[960] sm:absolute sm:inset-auto sm:right-0 sm:top-14">
          <div
            className="absolute inset-0 bg-primary/25 backdrop-blur-sm sm:hidden"
            onClick={() => setIsDropdownOpen(false)}
            aria-hidden="true"
          ></div>

          <div className="absolute left-3 right-3 top-[4.5rem] w-auto overflow-hidden rounded-2xl border border-primary/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,255,0.95))] shadow-[0_26px_44px_rgba(21,47,90,0.22)] sm:static sm:max-h-[70vh] sm:w-80">
            <div className="dropdown-header rounded-t-2xl border-b border-primary/12 bg-gradient-to-r from-white via-white to-primary/6 px-4 py-3 font-semibold text-primary">
              Уведомления
              {notifications.length > 0 && (
                <span className="ml-2 text-sm text-primary/65">{unreadCount} непрочитанных</span>
              )}
            </div>

            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto sm:max-h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-primary/60">Нет уведомлений</div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`dropdown-item cursor-pointer border-b border-primary/10 px-4 py-3 transition-colors hover:bg-primary/5 ${
                      !notification.read ? "bg-primary/6" : ""
                    }`}
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setIsComposerOpen(false)
                      setActiveNotificationId(notification.id)
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <i
                        className={`mt-1 fas text-accent fa-${
                          notification.type === "NEW"
                            ? "calendar-plus"
                            : notification.type === "CHANGE"
                              ? "edit"
                              : notification.type === "COMPLETE"
                                ? "check-circle"
                                : "info-circle"
                        }`}
                      ></i>

                      <div className="flex-grow">
                        <div className={`font-medium ${notification.read ? "text-primary/75" : "text-primary"}`}>
                          {notification.content}
                        </div>
                        <div className="mt-1 text-xs text-primary/55">
                          {new Date(notification.createdAt).toLocaleDateString("ru-RU")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div
                className="dropdown-item cursor-pointer border-t border-primary/10 px-4 py-3 font-semibold text-red-600 hover:bg-red-50"
                onClick={handleMarkAllRead}
              >
                <i className="fas fa-check-double mr-2"></i>
                Отметить все прочитанными
              </div>
            )}

            <div
              className="dropdown-item cursor-pointer border-t border-primary/10 px-4 py-3 text-primary/80 hover:bg-primary/5"
              onClick={() => {
                setIsDropdownOpen(false)
                router.push("/notifications")
              }}
            >
              <i className="fas fa-layer-group mr-2"></i>
              Все уведомления
            </div>

            {canCreateNotifications && (
              <div
                className="dropdown-item cursor-pointer border-t border-primary/10 px-4 py-3 text-primary/80 hover:bg-primary/5"
                onClick={() => {
                  setIsDropdownOpen(false)
                  setIsComposerOpen(true)
                }}
              >
                <i className="fas fa-plus mr-2"></i>
                Создать уведомление
              </div>
            )}
          </div>
        </div>
      )}

      {isComposerOpen && <NotificationModal onClose={() => setIsComposerOpen(false)} />}

      {activeNotification && (
        <Modal isOpen onClose={() => setActiveNotificationId(null)} title="Уведомление">
          <div className="space-y-4">
            <div className="text-sm text-primary/60">
              {new Date(activeNotification.createdAt).toLocaleString("ru-RU")}
            </div>
            <div className="text-xs uppercase tracking-wide text-primary/55">
              Статус: {activeNotification.read ? "прочитано" : "непрочитано"}
            </div>
            <div className="whitespace-pre-wrap text-primary/80">{activeNotification.content}</div>

            {activeEventId ? (
              <Button
                variant="primary"
                onClick={() => {
                  setActiveNotificationId(null)
                  router.push(`/events/${activeEventId}`)
                }}
              >
                Открыть мероприятие
              </Button>
            ) : (
              <div className="text-sm text-primary/55">Для этого уведомления не привязано мероприятие.</div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default NotificationBell
