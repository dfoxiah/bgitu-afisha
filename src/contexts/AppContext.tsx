// src/contexts/AppContext.tsx
'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Event, User, Notification, NotificationType } from '@/types'
import { EventCategory, Role } from '@prisma/client'
import { useDebugger } from '@/lib/debugger'

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
  createEvent: (eventData: any) => Promise<Event>
  updateEvent: (id: string, updates: Partial<Event>) => Promise<void>
  completeEvent: (id: string, reportData: any) => Promise<void>
  registerForEvent: (eventId: string) => Promise<void>
  updateParticipantStatus: (eventId: string, userId: string, action: 'confirm' | 'reject') => Promise<void>
  refreshNotifications: () => Promise<void>
  markNotificationAsRead: (id: string) => void
  markAllNotificationsAsRead: () => void
  clearAllNotifications: () => void
  sendEventNotification: (eventId: string, content: string, recipients: string, type?: NotificationType) => Promise<void>
  updateProfile: (data: any) => Promise<any>
  refreshEvents: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

let notificationsGlobalCooldownUntil = 0
let notificationsGlobalInFlight = false

export function AppProvider({ 
  children 
}: { 
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const debug = useDebugger('AppContext')
  const debugRef = useRef(debug)
  
  const [events, setEvents] = useState<Event[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [selectedCategory, setSelectedCategory] = useState('Все мероприятия')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false)
  const lastLoadTimeRef = useRef<number>(0)
  const isFetchingRef = useRef(false)
  const loadAttemptsRef = useRef(0)
  const notificationsLoadedRef = useRef<string | null>(null)
  const lastNotificationsFetchRef = useRef<number>(0)
  const notificationsFetchingRef = useRef(false)

  useEffect(() => {
    debug.info('context', 'Context initialized', {
      hasSession: !!session,
      sessionStatus: status,
      sessionUser: session?.user?.email,
      timestamp: new Date().toISOString()
    })

    return () => {
      debug.debug('context', 'Context cleanup')
    }
  }, [session, status, debug])

  useEffect(() => {
    debugRef.current = debug
  }, [debug])

  // Категории для фильтрации (русские названия)
  const categories = useMemo(() => [
    'Все мероприятия',
    'Концерт',
    'Внутривузовская активность',
    'Общественное мероприятие',
    'Соревнование',
    'Лекция',
    'Мастер-класс',
    'Волонтёрская активность',
    'Новость'
  ], [])

  // Преобразуем русское название категории в enum
  const getCategoryEnum = (categoryName: string): EventCategory | null => {
    const mapping: Record<string, EventCategory> = {
      'Концерт': EventCategory.CONCERT,
      'Внутривузовская активность': EventCategory.INTERNAL_ACTIVITY,
      'Общественное мероприятие': EventCategory.PUBLIC_EVENT,
      'Соревнование': EventCategory.COMPETITION,
      'Лекция': EventCategory.LECTURE,
      'Мастер-класс': EventCategory.MASTERCLASS,
      'Волонтёрская активность': EventCategory.VOLUNTEER,
      'Новость': EventCategory.NEWS
    }
    return mapping[categoryName] || null
  }

  const filteredEvents = useMemo(() => {
    debug.debug('events', 'Filtering events', {
      selectedCategory,
      searchQuery,
      totalEvents: events.length
    })

    let filtered = [...events]
    
    if (selectedCategory !== 'Все мероприятия') {
      const categoryEnum = getCategoryEnum(selectedCategory)
      if (categoryEnum) {
        filtered = filtered.filter(event => event.category === categoryEnum)
        debug.debug('events', `Filtered by category: ${selectedCategory}`, {
          before: events.length,
          after: filtered.length
        })
      }
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query)
      )
      debug.debug('events', `Filtered by search: ${searchQuery}`, {
        before: events.length,
        after: filtered.length
      })
    }
    
    return filtered
  }, [events, selectedCategory, searchQuery, debug])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    const upcoming = filteredEvents.filter(event => {
      try {
        const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
        return eventDate >= now && !event.isPast
      } catch {
        return false
      }
    })
    debug.debug('events', 'Upcoming events calculated', {
      total: upcoming.length,
      filtered: filteredEvents.length
    })
    return upcoming
  }, [filteredEvents, debug])

  const pastEvents = useMemo(() => {
    const now = new Date()
    const past = filteredEvents.filter(event => {
      try {
        const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
        return eventDate < now || event.isPast
      } catch {
        return false
      }
    })
    debug.debug('events', 'Past events calculated', {
      total: past.length,
      filtered: filteredEvents.length
    })
    return past
  }, [filteredEvents, debug])

  const newsEvents = useMemo(() => {
    const news = pastEvents.filter(event => event.isNews)
    debug.debug('events', 'News events calculated', {
      total: news.length,
      pastEvents: pastEvents.length
    })
    return news
  }, [pastEvents, debug])

  const loadEvents = useCallback(async (forceRefresh = false) => {
    // Prevent too many load attempts
    if (loadAttemptsRef.current > 5) {
      debug.warn('events', 'Too many load attempts, aborting')
      return
    }

    if (isFetchingRef.current) {
      return
    }

    if (hasLoadedEvents && !forceRefresh) {
      return
    }

    if (status === 'loading') {
      debug.debug('events', 'Session still loading, skipping')
      return
    }
    
    // Rate limiting: don't load more than once every 5 seconds
    const now = Date.now()
    if (!forceRefresh && now - lastLoadTimeRef.current < 5000) {
      debug.debug('events', 'Rate limiting, skipping load')
      return
    }

    debug.info('events', 'Loading events started')
    loadAttemptsRef.current++
    isFetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const endTimer = debug.time('fetchEvents')
      
      const query = new URLSearchParams()
      if (status !== 'authenticated') {
        query.set('upcoming', 'true')
      }
      query.set('limit', '100')
      const eventsUrl = `/api/events?${query.toString()}`

      debug.trackApi('/api/events', 'GET', {
        upcoming: status !== 'authenticated',
        limit: 100
      })

      const response = await fetch(eventsUrl, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      const duration = endTimer()
      
      if (!response.ok) {
        debug.error('events', 'Failed to load events', {
          status: response.status,
          statusText: response.statusText
        })
        
        // For 401 errors, show empty events but don't set error
        if (response.status === 401) {
          debug.warn('auth', 'Unauthorized access to events API')
          setEvents([])
        } else {
          setEvents([])
          setError('Ошибка загрузки мероприятий')
        }
        
        setHasLoadedEvents(false)
        return
      }
      
      const data = await response.json()
      
      debug.info('events', 'Events loaded successfully', {
        count: data.length,
        duration: `${duration}ms`,
        attempts: loadAttemptsRef.current
      })
      
      // Convert date strings to Date objects
      const eventsWithDates = data.map((event: any) => ({
        ...event,
        date: new Date(event.date),
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt),
        participants: event.participants || [],
        pendingParticipants: event.pendingParticipants || [],
        report: event.report ? {
          ...event.report,
          reportDate: new Date(event.report.reportDate),
          createdAt: new Date(event.report.createdAt),
          updatedAt: new Date(event.report.updatedAt)
        } : null
      }))
      
      setEvents(eventsWithDates)
      setHasLoadedEvents(true)
      lastLoadTimeRef.current = now
      loadAttemptsRef.current = 0
    } catch (error) {
      debug.error('events', 'Unexpected error loading events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: loadAttemptsRef.current
      })
      
      // Only show error on first attempt
      if (loadAttemptsRef.current === 1) {
        setError('Ошибка соединения')
      }
      
      setEvents([])
      setHasLoadedEvents(false)
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
      
      // Auto-retry after 10 seconds on failure (max 3 times)
      if (loadAttemptsRef.current > 0 && loadAttemptsRef.current <= 3) {
        setTimeout(() => {
          debug.info('events', `Auto-retry attempt ${loadAttemptsRef.current}`)
          loadEvents(true)
        }, 10000)
      }
    }
  }, [status, debug, hasLoadedEvents])

  useEffect(() => {
    if (status === 'authenticated' && session && !hasLoadedEvents) {
      const timer = setTimeout(() => {
        loadEvents()
      }, 1000) // Delay initial load to prevent race conditions
      
      return () => clearTimeout(timer)
    }
  }, [status, session, hasLoadedEvents, loadEvents])

  useEffect(() => {
    if (status === 'unauthenticated') {
      setEvents([])
      setHasLoadedEvents(false)
      loadAttemptsRef.current = 0
    }
  }, [status])

  const fetchNotifications = useCallback(async (force = false) => {
    if (status !== 'authenticated' || !session?.user?.id) return
    const now = Date.now()
    if (!force) {
      if (now < notificationsGlobalCooldownUntil) return
      if (now - lastNotificationsFetchRef.current < 15000) return
    }
    if (notificationsGlobalInFlight) return
    if (notificationsFetchingRef.current) return
    notificationsGlobalInFlight = true
    notificationsGlobalCooldownUntil = now + 30000
    notificationsFetchingRef.current = true

    try {
      const response = await fetch('/api/notifications', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        debugRef.current.error('notifications', 'Failed to load notifications', {
          status: response.status
        })
        return
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        debugRef.current.error('notifications', 'Unexpected notifications response', {
          status: response.status,
          contentType
        })
        return
      }

      const data = await response.json()
      const normalized = data.map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt)
      }))
      setNotifications(normalized)
      notificationsLoadedRef.current = session.user.id
      lastNotificationsFetchRef.current = Date.now()
    } catch (error) {
      debugRef.current.error('notifications', 'Error loading notifications', error)
    } finally {
      notificationsGlobalInFlight = false
      notificationsFetchingRef.current = false
    }
  }, [session?.user?.id, status])

  const refreshNotifications = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) return
    const now = Date.now()
    if (now < notificationsGlobalCooldownUntil) return
    if (notificationsGlobalInFlight) return
    if (notificationsFetchingRef.current) return
    if (now - lastNotificationsFetchRef.current < 5000) return

    const shouldFetch = notificationsLoadedRef.current !== session?.user?.id
      || now - lastNotificationsFetchRef.current > 30000

    if (shouldFetch) {
      await fetchNotifications(true)
    }
  }, [session?.user?.id, status, fetchNotifications])

  useEffect(() => {
    if (status === 'unauthenticated') {
      setNotifications([])
      notificationsLoadedRef.current = null
      lastNotificationsFetchRef.current = 0
    }
  }, [status])


  const setSelectedCategoryWithDebug = useCallback((category: string) => {
    debug.info('ui', `Category changed to: ${category}`)
    setSelectedCategory(category)
  }, [debug])

  const setSearchQueryWithDebug = useCallback((query: string) => {
    debug.debug('ui', `Search query updated: ${query}`)
    setSearchQuery(query)
  }, [debug])

  const createEvent = useCallback(async (eventData: any): Promise<Event> => {
    debug.info('events', 'Creating new event', eventData)
    
    if (!session?.user?.id) {
      throw new Error('Пользователь не авторизован')
    }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      })
      
      if (!response.ok) {
        const error = await response.json()
        debug.error('events', 'Event creation failed', error)
        throw new Error(error.error || 'Ошибка создания мероприятия')
      }
      
      const newEvent = await response.json()
      debug.info('events', 'Event created successfully', newEvent)
      
      // Добавляем событие в локальное состояние
      const eventWithDate = {
        ...newEvent,
        date: new Date(newEvent.date),
        createdAt: new Date(newEvent.createdAt),
        updatedAt: new Date(newEvent.updatedAt),
        participants: newEvent.participants || [],
        pendingParticipants: newEvent.pendingParticipants || [],
        moderators: newEvent.moderators || []
      }
      
      setEvents(prev => [...prev, eventWithDate])
      
      return eventWithDate
    } catch (error) {
      debug.error('events', 'Unexpected error in createEvent', error)
      throw error
    }
  }, [session, debug])

  const updateEvent = useCallback(async (id: string, updates: Partial<Event>) => {
    debug.info('events', `Updating event: ${id}`, updates)
    
    if (!session?.user?.id) {
      throw new Error('Пользователь не авторизован')
    }

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) {
        const error = await response.json()
        debug.error('events', `Event update failed for ${id}`, error)
        throw new Error(error.error || 'Ошибка обновления мероприятия')
      }
      
      const updatedEvent = await response.json()
      debug.debug('events', `Event ${id} updated successfully`)

      const eventWithDate = {
        ...updatedEvent,
        date: new Date(updatedEvent.date),
        createdAt: new Date(updatedEvent.createdAt),
        updatedAt: new Date(updatedEvent.updatedAt),
        participants: updatedEvent.participants || [],
        pendingParticipants: updatedEvent.pendingParticipants || [],
        moderators: updatedEvent.moderators || [],
        report: updatedEvent.report ? {
          ...updatedEvent.report,
          reportDate: new Date(updatedEvent.report.reportDate),
          createdAt: new Date(updatedEvent.report.createdAt),
          updatedAt: new Date(updatedEvent.report.updatedAt)
        } : null
      }

      // Обновляем локальное состояние
      setEvents(prev => prev.map(event => 
        event.id === id ? eventWithDate : event
      ))
    } catch (error) {
      debug.error('events', `Unexpected error updating event ${id}`, error)
      throw error
    }
  }, [session, debug])

  const completeEvent = useCallback(async (id: string, reportData: any) => {
    debug.info('events', `Completing event: ${id}`, reportData)
    
    if (!session?.user?.id) {
      throw new Error('Пользователь не авторизован')
    }

    try {
      const response = await fetch(`/api/events/${id}/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      })
      
      if (!response.ok) {
        const error = await response.json()
        debug.error('events', `Event completion failed for ${id}`, error)
        throw new Error(error.error || 'Ошибка завершения мероприятия')
      }
      
      debug.info('events', `Event ${id} completed successfully`)
      
      // Обновляем локальное состояние
      setEvents(prev => prev.map(event => 
        event.id === id 
          ? { 
              ...event, 
              isPast: true, 
              report: reportData,
              updatedAt: new Date() 
            } 
          : event
      ))
    } catch (error) {
      debug.error('events', `Unexpected error completing event ${id}`, error)
      throw error
    }
  }, [session, debug])

  const registerForEvent = useCallback(async (eventId: string) => {
    debug.info('events', `Registering for event: ${eventId}`)
    
    if (!session?.user?.id) {
      throw new Error('Пользователь не авторизован')
    }

    try {
      const response = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: session.user.id })
      })
      
      if (!response.ok) {
        const error = await response.json()
        debug.error('events', `Registration failed for event ${eventId}`, error)
        throw new Error(error.error || 'Ошибка регистрации')
      }
      
      const result = await response.json()
      const status = String(result?.status || 'CONFIRMED')

      debug.info('events', 'Successfully registered for event ' + eventId, { status })

      // Обновляем локальное состояние
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          const user: User = {
            id: session.user.id,
            name: session.user.name || null,
            email: session.user.email || '',
            emailVerified: null,
            image: null,
            role: session.user.role as Role,
            department: session.user.department || null,
            group: session.user.group || null,
            createdAt: new Date(),
            updatedAt: new Date()
          }

          if (status === 'PENDING') {
            return {
              ...event,
              pendingParticipants: [...(event.pendingParticipants || []), user]
            }
          }

          return {
            ...event,
            currentParticipants: event.currentParticipants + 1,
            participants: [...(event.participants || []), user]
          }
        }
        return event
      }))
    } catch (error) {
      debug.error('events', `Unexpected error registering for event ${eventId}`, error)
      throw error
    }
  }, [session, debug])

  const updateParticipantStatus = useCallback(async (eventId: string, userId: string, action: 'confirm' | 'reject') => {
    if (!session?.user?.id) {
      throw new Error('Пользователь не авторизован')
    }

    const response = await fetch(`/api/events/${eventId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Ошибка обновления участника')
    }

    const result = await response.json()

    setEvents(prev => prev.map(event => {
      if (event.id !== eventId) return event

      const pending = event.pendingParticipants || []
      const confirmed = event.participants || []
      const pendingUser = pending.find(p => p.id === userId)
      const confirmedUser = confirmed.find(p => p.id === userId)

      if (action === 'confirm') {
        const userToAdd = pendingUser || confirmedUser
        return {
          ...event,
          currentParticipants: typeof result.currentParticipants === 'number'
            ? result.currentParticipants
            : event.currentParticipants,
          participants: userToAdd
            ? [...confirmed.filter(p => p.id !== userId), userToAdd]
            : confirmed,
          pendingParticipants: pending.filter(p => p.id !== userId)
        }
      }

      return {
        ...event,
        currentParticipants: typeof result.currentParticipants === 'number'
          ? result.currentParticipants
          : event.currentParticipants,
        participants: confirmed.filter(p => p.id !== userId),
        pendingParticipants: pending.filter(p => p.id !== userId)
      }
    }))
  }, [session])

  const markNotificationAsRead = useCallback((id: string) => {
    debug.debug('notifications', `Marking notification as read: ${id}`)
    
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )

    fetch(`/api/notifications/${id}`, {
      method: 'PATCH'
    }).catch(error => {
      debug.error('notifications', 'Failed to mark notification as read', error)
    })
  }, [debug])

  const markAllNotificationsAsRead = useCallback(() => {
    debug.info('notifications', 'Marking all notifications as read')

    setNotifications(prev => prev.map(notification => ({ ...notification, read: true })))

    fetch('/api/notifications', {
      method: 'PATCH'
    }).catch(error => {
      debug.error('notifications', 'Failed to mark all notifications as read', error)
    })
  }, [debug])

  const clearAllNotifications = useCallback(() => {
    debug.info('notifications', 'Clearing all notifications')
    
    setNotifications([])
    notificationsLoadedRef.current = session?.user?.id ?? null
    lastNotificationsFetchRef.current = Date.now()

    fetch('/api/notifications', {
      method: 'DELETE'
    }).catch(error => {
      debug.error('notifications', 'Failed to clear notifications', error)
    })
  }, [session, debug])

  const sendEventNotification = useCallback(async (eventId: string, content: string, recipients: string, type: NotificationType = 'EVENT') => {
    debug.info('notifications', 'Sending event notification', {
      eventId,
      content,
      recipients
    })

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, content, recipients, type })
    })

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка отправки уведомления')
      }
      throw new Error('Ошибка отправки уведомления')
    }

    await fetchNotifications(true)
  }, [debug, fetchNotifications])

  const updateProfile = useCallback(async (data: any) => {
    debug.info('profile', 'Updating profile', data)
    
    if (!session?.user?.id) {
      throw new Error('Пользователь не авторизован')
    }

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const error = await response.json()
        debug.error('profile', 'Profile update failed', error)
        throw new Error(error.error || 'Ошибка обновления профиля')
      }
      
      const result = await response.json()
      debug.info('profile', 'Profile updated successfully', result)
      
      return result
    } catch (error) {
      debug.error('profile', 'Unexpected error updating profile', error)
      throw error
    }
  }, [session, debug])

  const refreshEvents = useCallback(async () => {
    await loadEvents(true)
  }, [loadEvents])

  const value = useMemo(() => ({
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
    updateProfile,
    refreshEvents
  }), [
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
    updateProfile,
    refreshEvents
  ])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  
  return context
}

