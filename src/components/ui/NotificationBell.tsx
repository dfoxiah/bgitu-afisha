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
        className="header-icon pressable flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-white/70 bg-white/70 shadow transition-colors hover:border-accent hover:bg-white/90"
        onClick={() => {
          const nextState = !isDropdownOpen
          setIsDropdownOpen(nextState)
          if (nextState) {
            refreshNotifications()
          }
        }}
      >
        <i className="fas fa-bell text-gray-600"></i>
        {unreadCount > 0 && (
          <div className="notification-count absolute -right-1 -top-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </div>

      {isDropdownOpen && (
        <div className="dropdown fixed inset-0 z-[960] sm:absolute sm:inset-auto sm:right-0 sm:top-14">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm sm:hidden"
            onClick={() => setIsDropdownOpen(false)}
            aria-hidden="true"
          ></div>

          <div className="absolute left-3 right-3 top-[4.5rem] w-auto overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl sm:static sm:w-80 sm:max-h-[70vh]">
            <div className="dropdown-header rounded-t-2xl border-b border-white/70 bg-white px-4 py-3 font-semibold text-primary">
              Уведомления
              {notifications.length > 0 && (
                <span className="ml-2 text-sm text-gray-600">{unreadCount} непрочитанных</span>
              )}
            </div>

            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto sm:max-h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">Нет уведомлений</div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`dropdown-item cursor-pointer border-b border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50 ${
                      !notification.read ? "bg-blue-50" : ""
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
                        <div
                          className={`font-medium ${
                            notification.read ? "text-gray-700" : "text-primary"
                          }`}
                        >
                          {notification.content}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
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
                className="dropdown-item cursor-pointer border-t border-gray-200 px-4 py-3 font-semibold text-red-600 hover:bg-red-50"
                onClick={handleMarkAllRead}
              >
                <i className="fas fa-check-double mr-2"></i>
                Отметить все прочитанными
              </div>
            )}

            <div
              className="dropdown-item cursor-pointer border-t border-gray-200 px-4 py-3 hover:bg-gray-50"
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
                className="dropdown-item cursor-pointer border-t border-gray-200 px-4 py-3 hover:bg-gray-50"
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
        <Modal
          isOpen
          onClose={() => setActiveNotificationId(null)}
          title="Уведомление"
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              {new Date(activeNotification.createdAt).toLocaleString("ru-RU")}
            </div>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Статус: {activeNotification.read ? "прочитано" : "непрочитано"}
            </div>
            <div className="whitespace-pre-wrap text-gray-800">{activeNotification.content}</div>

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
              <div className="text-sm text-gray-500">
                Для этого уведомления не привязано мероприятие.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default NotificationBell
