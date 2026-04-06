/**
 * File responsibility:
 * Central application context that orchestrates events, notifications and profile actions.
 *
 * Main logic:
 * - Store and filter event collections
 * - Manage notification state with throttled background refresh
 * - Expose typed client actions for pages/components
 *
 * Integrations:
 * - src/features/<domain>/client/<domain>-api.ts adapters
 * - App pages/components via useAppContext()
 */

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useSession } from "next-auth/react"
import { Role } from "@prisma/client"
import { useDebugger } from "@/lib/debugger"
import { CategoryReverseMap, type Event, type Notification, type NotificationType, type User } from "@/types"
import type { CompleteEventDto, CreateEventDto, UpdateEventDto } from "@/types/dto"
import {
  completeEventApi,
  createEventApi,
  fetchEventsApi,
  moderateParticipantApi,
  registerForEventApi,
  updateEventApi,
} from "@/features/events/client/events-api"
import {
  clearNotificationsApi,
  deleteNotificationBroadcastApi,
  fetchNotificationsApi,
  markAllNotificationsAsReadApi,
  markNotificationAsReadApi,
  type SendEventNotificationResult,
  sendEventNotificationApi,
} from "@/features/notifications/client/notifications-api"
import { updateProfileApi, type UpdateProfileResponse } from "@/features/profile/client/profile-api"

interface AppContextType {
  events: Event[]
  notifications: Notification[]
  upcomingEvents: Event[]
  pastEvents: Event[]
  newsEvents: Event[]
  filteredEvents: Event[]
  categories: string[]
  selectedCategory: string
  searchQuery: string
  isLoading: boolean
  error: string | null
  setSelectedCategory: (category: string) => void
  setSearchQuery: (query: string) => void
  createEvent: (eventData: CreateEventDto) => Promise<Event>
  updateEvent: (id: string, updates: UpdateEventDto) => Promise<void>
  completeEvent: (id: string, reportData: CompleteEventDto) => Promise<void>
  registerForEvent: (eventId: string) => Promise<void>
  updateParticipantStatus: (eventId: string, userId: string, action: "confirm" | "reject") => Promise<void>
  refreshNotifications: () => Promise<void>
  markNotificationAsRead: (id: string) => void
  markAllNotificationsAsRead: () => void
  clearAllNotifications: () => void
  sendEventNotification: (
    eventId: string,
    content: string,
    recipients: string,
    type?: NotificationType,
    filters?: {
      groups?: string[]
      departments?: string[]
    }
  ) => Promise<SendEventNotificationResult>
  cancelNotificationBroadcast: (broadcastId: string) => Promise<{ deleted: number }>
  updateProfile: (data: Record<string, unknown>) => Promise<UpdateProfileResponse>
  refreshEvents: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const NOTIFICATIONS_LIVE_INTERVAL_MS = 15000

let notificationsGlobalCooldownUntil = 0
let notificationsGlobalInFlight = false

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const debug = useDebugger("AppContext")
  const debugRef = useRef(debug)

  const [events, setEvents] = useState<Event[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [selectedCategory, setSelectedCategory] = useState("Все мероприятия")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false)

  const lastLoadTimeRef = useRef(0)
  const isFetchingRef = useRef(false)
  const loadAttemptsRef = useRef(0)
  const eventsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventsAbortControllerRef = useRef<AbortController | null>(null)

  const notificationsLoadedRef = useRef<string | null>(null)
  const lastNotificationsFetchRef = useRef(0)
  const notificationsFetchingRef = useRef(false)

  useEffect(() => {
    debugRef.current = debug
  }, [debug])

  const categories = useMemo(
    () => [
      "Все мероприятия",
      "Концерт",
      "Внутривузовская активность",
      "Общественное мероприятие",
      "Соревнование",
      "Лекция",
      "Мастер-класс",
      "Волонтёрская активность",
      "Новость",
    ],
    []
  )

  const filteredEvents = useMemo(() => {
    let filtered = [...events]

    if (selectedCategory !== "Все мероприятия") {
      const categoryEnum = CategoryReverseMap[selectedCategory] || null
      if (categoryEnum) {
        filtered = filtered.filter((event) => event.category === categoryEnum)
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((event) => {
        return (
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.location.toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [events, selectedCategory, searchQuery])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return filteredEvents
      .filter((event) => {
        const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
        return eventDate >= now && !event.isPast
      })
      .sort((left, right) => {
        const leftTime = (left.date instanceof Date ? left.date : new Date(left.date)).getTime()
        const rightTime = (right.date instanceof Date ? right.date : new Date(right.date)).getTime()
        if (leftTime !== rightTime) return leftTime - rightTime
        return String(left.time || "").localeCompare(String(right.time || ""), "ru-RU")
      })
  }, [filteredEvents])

  const pastEvents = useMemo(() => {
    const now = new Date()
    return filteredEvents
      .filter((event) => {
        const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
        return eventDate < now || event.isPast
      })
      .sort((left, right) => {
        const leftTime = (left.date instanceof Date ? left.date : new Date(left.date)).getTime()
        const rightTime = (right.date instanceof Date ? right.date : new Date(right.date)).getTime()
        if (leftTime !== rightTime) return rightTime - leftTime
        return String(right.time || "").localeCompare(String(left.time || ""), "ru-RU")
      })
  }, [filteredEvents])

  const newsEvents = useMemo(() => pastEvents.filter((event) => event.isNews), [pastEvents])

  const loadEvents = useCallback(
    async (forceRefresh = false) => {
      if (loadAttemptsRef.current > 5) return
      if (isFetchingRef.current) return
      if (hasLoadedEvents && !forceRefresh) return
      if (status === "loading") return

      const now = Date.now()
      if (!forceRefresh && now - lastLoadTimeRef.current < 5000) return

      isFetchingRef.current = true
      loadAttemptsRef.current += 1
      setIsLoading(true)
      setError(null)

      eventsAbortControllerRef.current?.abort()
      const controller = new AbortController()
      eventsAbortControllerRef.current = controller
      let shouldRetry = false

      try {
        const data = await fetchEventsApi(status === "authenticated", { signal: controller.signal })
        setEvents(data)
        setHasLoadedEvents(true)
        lastLoadTimeRef.current = now
        loadAttemptsRef.current = 0

        if (eventsRetryTimerRef.current) {
          clearTimeout(eventsRetryTimerRef.current)
          eventsRetryTimerRef.current = null
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return
        }

        shouldRetry = true
        debug.error("events", "Failed to load events", loadError)
        setEvents([])
        setHasLoadedEvents(false)
        if (loadAttemptsRef.current === 1) {
          setError("Ошибка загрузки мероприятий")
        }
      } finally {
        if (eventsAbortControllerRef.current === controller) {
          eventsAbortControllerRef.current = null
        }

        isFetchingRef.current = false
        setIsLoading(false)

        if (shouldRetry && loadAttemptsRef.current > 0 && loadAttemptsRef.current <= 3) {
          if (eventsRetryTimerRef.current) {
            clearTimeout(eventsRetryTimerRef.current)
          }
          const retryDelay = Math.min(12000, loadAttemptsRef.current * 4000)
          eventsRetryTimerRef.current = setTimeout(() => {
            void loadEvents(true)
          }, retryDelay)
        }
      }
    },
    [debug, hasLoadedEvents, status]
  )

  useEffect(() => {
    if (status === "authenticated" && session && !hasLoadedEvents) {
      void loadEvents()
    }
  }, [hasLoadedEvents, loadEvents, session, status])

  useEffect(() => {
    if (status === "unauthenticated") {
      eventsAbortControllerRef.current?.abort()
      eventsAbortControllerRef.current = null
      if (eventsRetryTimerRef.current) {
        clearTimeout(eventsRetryTimerRef.current)
        eventsRetryTimerRef.current = null
      }
      isFetchingRef.current = false
      setEvents([])
      setHasLoadedEvents(false)
      loadAttemptsRef.current = 0
      setIsLoading(false)
    }
  }, [status])

  useEffect(
    () => () => {
      eventsAbortControllerRef.current?.abort()
      eventsAbortControllerRef.current = null
      if (eventsRetryTimerRef.current) {
        clearTimeout(eventsRetryTimerRef.current)
        eventsRetryTimerRef.current = null
      }
    },
    []
  )

  const fetchNotifications = useCallback(
    async (force = false) => {
      if (status !== "authenticated" || !session?.user?.id) return

      const now = Date.now()
      if (!force) {
        if (now < notificationsGlobalCooldownUntil) return
        if (now - lastNotificationsFetchRef.current < NOTIFICATIONS_LIVE_INTERVAL_MS) return
      }

      if (notificationsGlobalInFlight || notificationsFetchingRef.current) return

      notificationsGlobalInFlight = true
      notificationsGlobalCooldownUntil = now + NOTIFICATIONS_LIVE_INTERVAL_MS
      notificationsFetchingRef.current = true

      try {
        const data = await fetchNotificationsApi()
        setNotifications(data)
        notificationsLoadedRef.current = session.user.id
        lastNotificationsFetchRef.current = Date.now()
      } catch (loadError) {
        debugRef.current.error("notifications", "Failed to load notifications", loadError)
      } finally {
        notificationsGlobalInFlight = false
        notificationsFetchingRef.current = false
      }
    },
    [session?.user?.id, status]
  )

  const refreshNotifications = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.id) return

    const now = Date.now()
    if (now < notificationsGlobalCooldownUntil) return
    if (notificationsGlobalInFlight || notificationsFetchingRef.current) return
    if (now - lastNotificationsFetchRef.current < 5000) return

    const shouldFetch =
      notificationsLoadedRef.current !== session.user.id ||
      now - lastNotificationsFetchRef.current > 30000

    if (shouldFetch) {
      await fetchNotifications(true)
    }
  }, [fetchNotifications, session?.user?.id, status])

  useEffect(() => {
    if (status === "unauthenticated") {
      setNotifications([])
      notificationsLoadedRef.current = null
      lastNotificationsFetchRef.current = 0
    }
  }, [status])

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return

    const refreshLive = async (force = false) => {
      if (document.visibilityState === "hidden") return
      await fetchNotifications(force)
    }

    const intervalId = window.setInterval(() => {
      void refreshLive()
    }, NOTIFICATIONS_LIVE_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshLive(true)
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    void refreshLive(true)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [fetchNotifications, session?.user?.id, status])

  const setSelectedCategoryWithDebug = useCallback(
    (category: string) => {
      debug.info("ui", `Category changed: ${category}`)
      setSelectedCategory(category)
    },
    [debug]
  )

  const setSearchQueryWithDebug = useCallback(
    (query: string) => {
      debug.debug("ui", `Search query changed: ${query}`)
      setSearchQuery(query)
    },
    [debug]
  )

  const createEvent = useCallback(
    async (eventData: CreateEventDto) => {
      if (!session?.user?.id) {
        throw new Error("Пользователь не авторизован")
      }

      const event = await createEventApi(eventData)
      setEvents((prev) => [...prev, event])
      return event
    },
    [session?.user?.id]
  )

  const updateEvent = useCallback(
    async (id: string, updates: UpdateEventDto) => {
      if (!session?.user?.id) {
        throw new Error("Пользователь не авторизован")
      }

      const updatedEvent = await updateEventApi(id, updates)
      setEvents((prev) => prev.map((event) => (event.id === id ? updatedEvent : event)))
    },
    [session?.user?.id]
  )

  const completeEvent = useCallback(
    async (id: string, reportData: CompleteEventDto) => {
      if (!session?.user?.id) {
        throw new Error("Пользователь не авторизован")
      }

      const updatedEvent = await completeEventApi(id, reportData)
      setEvents((prev) => prev.map((event) => (event.id === id ? updatedEvent : event)))
    },
    [session?.user?.id]
  )

  const registerForEvent = useCallback(
    async (eventId: string) => {
      if (!session?.user?.id) {
        throw new Error("Пользователь не авторизован")
      }

      const result = await registerForEventApi(eventId)
      const status = String(result.status || "CONFIRMED")

      setEvents((prev) =>
        prev.map((event) => {
          if (event.id !== eventId) return event

          const user: User = {
            id: session.user.id,
            name: session.user.name || null,
            email: session.user.email || "",
            emailVerified: null,
            image: null,
            role: session.user.role as Role,
            department: session.user.department || null,
            group: session.user.group || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          if (status === "PENDING") {
            const nextPending = [...(event.pendingParticipants || []), user]
            return {
              ...event,
              pendingParticipants: nextPending,
              pendingParticipantsCount: nextPending.length,
              viewerParticipationStatus: "PENDING",
            }
          }

          const nextConfirmed = [...(event.participants || []), user]
          return {
            ...event,
            currentParticipants: event.currentParticipants + 1,
            participants: nextConfirmed,
            confirmedParticipantsCount: nextConfirmed.length,
            viewerParticipationStatus: "CONFIRMED",
          }
        })
      )
    },
    [session]
  )

  const updateParticipantStatus = useCallback(
    async (eventId: string, userId: string, action: "confirm" | "reject") => {
      if (!session?.user?.id) {
        throw new Error("Пользователь не авторизован")
      }

      const result = await moderateParticipantApi(eventId, userId, action)

      setEvents((prev) =>
        prev.map((event) => {
          if (event.id !== eventId) return event

          const pending = event.pendingParticipants || []
          const confirmed = event.participants || []
          const pendingUser = pending.find((participant) => participant.id === userId)
          const confirmedUser = confirmed.find((participant) => participant.id === userId)

          if (action === "confirm") {
            const userToAdd = pendingUser || confirmedUser
            const nextParticipants = userToAdd
              ? [...confirmed.filter((participant) => participant.id !== userId), userToAdd]
              : confirmed
            const nextPending = pending.filter((participant) => participant.id !== userId)
            return {
              ...event,
              currentParticipants:
                typeof result.currentParticipants === "number"
                  ? result.currentParticipants
                  : event.currentParticipants,
              participants: nextParticipants,
              pendingParticipants: nextPending,
              confirmedParticipantsCount: nextParticipants.length,
              pendingParticipantsCount: nextPending.length,
            }
          }

          const nextParticipants = confirmed.filter((participant) => participant.id !== userId)
          const nextPending = pending.filter((participant) => participant.id !== userId)
          return {
            ...event,
            currentParticipants:
              typeof result.currentParticipants === "number"
                ? result.currentParticipants
                : event.currentParticipants,
            participants: nextParticipants,
            pendingParticipants: nextPending,
            confirmedParticipantsCount: nextParticipants.length,
            pendingParticipantsCount: nextPending.length,
          }
        })
      )
    },
    [session?.user?.id]
  )

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )

    markNotificationAsReadApi(id).catch((readError) => {
      debug.error("notifications", "Failed to mark notification as read", readError)
    })
  }, [debug])

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))

    markAllNotificationsAsReadApi().catch((readError) => {
      debug.error("notifications", "Failed to mark all notifications as read", readError)
    })
  }, [debug])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
    notificationsLoadedRef.current = session?.user?.id ?? null
    lastNotificationsFetchRef.current = Date.now()

    clearNotificationsApi().catch((clearError) => {
      debug.error("notifications", "Failed to clear notifications", clearError)
    })
  }, [debug, session?.user?.id])

  const sendEventNotification = useCallback(
    async (
      eventId: string,
      content: string,
      recipients: string,
      type: NotificationType = "EVENT",
      filters?: {
        groups?: string[]
        departments?: string[]
      }
    ) => {
      const result = await sendEventNotificationApi({
        eventId,
        content,
        recipients,
        type,
        groups: filters?.groups || [],
        departments: filters?.departments || [],
      })
      await fetchNotifications(true)
      return result
    },
    [fetchNotifications]
  )

  const cancelNotificationBroadcast = useCallback(async (broadcastId: string) => {
    const result = await deleteNotificationBroadcastApi(broadcastId)
    await fetchNotifications(true)
    return { deleted: result.deleted }
  }, [fetchNotifications])

  const updateProfile = useCallback(
    async (data: Record<string, unknown>) => {
      if (!session?.user?.id) {
        throw new Error("Пользователь не авторизован")
      }

      return updateProfileApi(data)
    },
    [session?.user?.id]
  )

  const refreshEvents = useCallback(async () => {
    await loadEvents(true)
  }, [loadEvents])

  const value = useMemo<AppContextType>(
    () => ({
      events,
      notifications,
      upcomingEvents,
      pastEvents,
      newsEvents,
      filteredEvents,
      categories,
      selectedCategory,
      searchQuery,
      isLoading,
      error,
      setSelectedCategory: setSelectedCategoryWithDebug,
      setSearchQuery: setSearchQueryWithDebug,
      createEvent,
      updateEvent,
      completeEvent,
      registerForEvent,
      updateParticipantStatus,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      clearAllNotifications,
      sendEventNotification,
      cancelNotificationBroadcast,
      updateProfile,
      refreshEvents,
    }),
    [
      events,
      notifications,
      upcomingEvents,
      pastEvents,
      newsEvents,
      filteredEvents,
      categories,
      selectedCategory,
      searchQuery,
      isLoading,
      error,
      setSelectedCategoryWithDebug,
      setSearchQueryWithDebug,
      createEvent,
      updateEvent,
      completeEvent,
      registerForEvent,
      updateParticipantStatus,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      clearAllNotifications,
      sendEventNotification,
      cancelNotificationBroadcast,
      updateProfile,
      refreshEvents,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}
