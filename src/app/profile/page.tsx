/**
 * File responsibility:
 * Profile page for viewing/updating personal data and notification preferences.
 *
 * Main logic:
 * - Load and normalize profile fields from session
 * - Validate editable fields before update
 * - Sync successful changes with NextAuth session and AppContext
 *
 * Integrations:
 * - src/app/api/auth/profile/route.ts
 * - src/contexts/AppContext.tsx updateProfile()
 */
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession, signOut, getSession, getProviders, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAppContext } from '@/contexts/AppContext'
import Button from '@/components/ui/Button'
import { showToast } from '@/lib/toast'
import {
  createTelegramLinkApi,
  getNotificationChannelsConfigApi,
  getProfileStatsApi,
  getTelegramLinkStatusApi,
  unlinkTelegramApi,
  type NotificationChannelsConfigResponse,
  type ProfileStatsResponse,
  type TelegramLinkStatusResponse,
} from '@/features/profile/client/profile-api'
import { CategoryDisplayMap } from '@/types'
import { EventCategory } from '@prisma/client'
import { toRoleLabel } from '@/lib/roles'

interface ProfileFormData {
  name: string
  email: string
  department: string
  group: string
  admissionYear: string
  vkUserId: string
  bio: string
  notifications: {
    newEvents: boolean
    changes: boolean
    news: boolean
    inApp: boolean
    email: boolean
    vk: boolean
    telegram: boolean
    categories: EventCategory[]
  }
}

type TelegramLinkState = TelegramLinkStatusResponse
type NotificationChannelsState = NotificationChannelsConfigResponse

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const { updateProfile } = useAppContext()
  const allCategories = useMemo(() => Object.values(EventCategory) as EventCategory[], [])
  const categoryOptions = useMemo(
    () => allCategories.map(category => ({
      value: category,
      label: CategoryDisplayMap[category] || category
    })),
    [allCategories]
  )
  
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: '',
    department: '',
    group: '',
    admissionYear: '',
    vkUserId: '',
    bio: '',
    notifications: {
      newEvents: true,
      changes: true,
      news: false,
      inApp: true,
      email: false,
      vk: false,
      telegram: false,
      categories: []
    }
  })
  
  const [originalData, setOriginalData] = useState<ProfileFormData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [sessionStuck, setSessionStuck] = useState(false)
  const [saveEffect, setSaveEffect] = useState(false)
  const [groupChangeCount, setGroupChangeCount] = useState(0)
  const [profileStats, setProfileStats] = useState<ProfileStatsResponse | null>(null)
  const [profileStatsLoading, setProfileStatsLoading] = useState(false)
  const [profileStatsError, setProfileStatsError] = useState<string | null>(null)
  const [vkProviderAvailable, setVkProviderAvailable] = useState(false)
  const [telegramState, setTelegramState] = useState<TelegramLinkState | null>(null)
  const [notificationChannelsConfig, setNotificationChannelsConfig] =
    useState<NotificationChannelsState | null>(null)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false)
  const [telegramUnlinkLoading, setTelegramUnlinkLoading] = useState(false)
  const saveEffectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (saveEffectTimeoutRef.current) {
        clearTimeout(saveEffectTimeoutRef.current)
      }
    }
  }, [])

  const triggerSaveEffect = () => {
    setSaveEffect(true)
    if (saveEffectTimeoutRef.current) {
      clearTimeout(saveEffectTimeoutRef.current)
    }
    saveEffectTimeoutRef.current = setTimeout(() => setSaveEffect(false), 1400)
  }

  const groupChangeLocked = session?.user?.role === 'STUDENT' && groupChangeCount >= 1

  const loadProfileStats = useCallback(async () => {
    if (status !== 'authenticated') return

    setProfileStatsLoading(true)
    setProfileStatsError(null)

    try {
      const nextStats = await getProfileStatsApi()
      setProfileStats(nextStats)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки статистики профиля'
      setProfileStatsError(message)
    } finally {
      setProfileStatsLoading(false)
    }
  }, [status])

  const loadTelegramState = useCallback(async () => {
    if (status !== 'authenticated') return

    setTelegramLoading(true)
    try {
      const nextState = await getTelegramLinkStatusApi()
      setTelegramState(nextState)
      setFormData(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          telegram: nextState.connected ? nextState.notifyTelegram : prev.notifications.telegram
        }
      }))
      if (nextState.connected) {
        setValidationErrors(prev => {
          if (!prev.notifyTelegram) return prev
          const nextErrors = { ...prev }
          delete nextErrors.notifyTelegram
          return nextErrors
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки Telegram'
      showToast(message, 'error')
    } finally {
      setTelegramLoading(false)
    }
  }, [status])

  const loadNotificationChannelsConfig = useCallback(async () => {
    if (status !== 'authenticated') return

    try {
      const nextConfig = await getNotificationChannelsConfigApi()
      setNotificationChannelsConfig(nextConfig)
      setFormData(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          email: nextConfig.emailConfigured ? prev.notifications.email : false,
          vk: nextConfig.vkConfigured ? prev.notifications.vk : false,
          telegram: nextConfig.telegramMessagingConfigured ? prev.notifications.telegram : false,
        }
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки каналов уведомлений'
      showToast(message, 'error')
    }
  }, [status])

  useEffect(() => {
    if (session?.user) {
      const savedCategories = Array.isArray(session.user.notificationCategories)
        ? session.user.notificationCategories
        : []
      const resolvedCategories = savedCategories.length > 0 ? savedCategories : allCategories

      const newFormData: ProfileFormData = {
        name: session.user.name || '',
        email: session.user.email || '',
        department: session.user.department || '',
        group: session.user.group || '',
        admissionYear: session.user.admissionYear ? String(session.user.admissionYear) : '',
        vkUserId: session.user.vkUserId || '',
        bio: session.user.bio || '',
        notifications: {
          newEvents: session.user.notifyNewEvents ?? true,
          changes: session.user.notifyChanges ?? true,
          news: session.user.notifyNews ?? false,
          inApp: session.user.notifyInApp ?? true,
          email: session.user.notifyEmail ?? false,
          vk: session.user.notifyVk ?? false,
          telegram: session.user.notifyTelegram ?? false,
          categories: resolvedCategories
        }
      }

      setGroupChangeCount(session.user.groupChangeCount ?? 0)
      setFormData(newFormData)
      setOriginalData(newFormData)
    }
  }, [session, allCategories])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      void loadProfileStats()
      void loadTelegramState()
      void loadNotificationChannelsConfig()
      return
    }

    if (status === 'unauthenticated') {
      setProfileStats(null)
      setProfileStatsError(null)
      setProfileStatsLoading(false)
      setTelegramState(null)
      setNotificationChannelsConfig(null)
      setTelegramLoading(false)
    }
  }, [status, session?.user?.id, loadNotificationChannelsConfig, loadProfileStats, loadTelegramState])

  useEffect(() => {
    let active = true

    const loadProviders = async () => {
      const providers = await getProviders().catch(() => null)
      if (!active) return
      setVkProviderAvailable(Boolean(providers?.vk))
    }

    void loadProviders()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => {
          setSessionStuck(true)
        }, 8000)
      }
      return
    }

    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
  }, [status])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    let active = true
    const verifyAccount = async () => {
      try {
        const response = await fetch('/api/auth/profile', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })

        if (!active) return

        if (response.status === 401 || response.status === 404) {
          await signOut({ redirect: true, callbackUrl: '/login' })
        }
      } catch {
        // Session verification is best-effort; the next auth refresh will correct the state.
      }
    }

    verifyAccount()
    const handleFocus = () => {
      verifyAccount()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      active = false
      window.removeEventListener('focus', handleFocus)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return

    const handleFocus = () => {
      void loadTelegramState()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [status, loadTelegramState])

  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(async () => {
      const freshSession = await getSession()
      if (freshSession) {
        router.refresh()
        return
      }
      router.replace('/login?fallback=1')
    }, 6000)

    return () => clearTimeout(timer)
  }, [status, router])

  useEffect(() => {
    if (originalData) {
      const dirty = JSON.stringify(formData) !== JSON.stringify(originalData)
      setIsDirty(dirty)
    }
  }, [formData, originalData])

  const profileStatsRows = useMemo(() => {
    if (!profileStats) return []

    const baseRows = [
      {
        label: 'Роль',
        value: toRoleLabel(profileStats.role)
      },
      {
        label: 'Регистрация',
        value: new Date(profileStats.registeredAt).toLocaleDateString('ru-RU')
      },
      {
        label: 'Последняя активность',
        value: profileStats.lastActivityAt
          ? new Date(profileStats.lastActivityAt).toLocaleString('ru-RU')
          : 'Нет данных'
      }
    ]

    if (profileStats.role === 'STUDENT') {
      return [
        ...baseRows,
        { label: 'Посетил мероприятий', value: String(profileStats.visitedEventsCount) },
        { label: 'Активных участий', value: String(profileStats.activeParticipationsCount) },
        { label: 'Ожидают подтверждения', value: String(profileStats.participationsPending) },
        { label: 'Конверсия подтверждения', value: `${profileStats.confirmationRatePercent}%` }
      ]
    }

    if (
      profileStats.role === 'TEACHER' ||
      profileStats.role === 'EDITOR' ||
      profileStats.role === 'MODERATOR'
    ) {
      return [
        ...baseRows,
        { label: 'Создано мероприятий', value: String(profileStats.createdEventsCount) },
        { label: 'Модерирует мероприятий', value: String(profileStats.moderatedEventsCount) },
        { label: 'Посетил мероприятий', value: String(profileStats.visitedEventsCount) },
        { label: 'Активных участий', value: String(profileStats.activeParticipationsCount) },
        { label: 'Конверсия подтверждения', value: `${profileStats.confirmationRatePercent}%` }
      ]
    }

    return [
      ...baseRows,
      { label: 'Создано мероприятий', value: String(profileStats.createdEventsCount) },
      { label: 'Создано новостей', value: String(profileStats.createdNewsCount) },
      { label: 'Модерирует мероприятий', value: String(profileStats.moderatedEventsCount) },
      { label: 'Подтверждено участий', value: String(profileStats.participationsConfirmed) },
      { label: 'Активных участий', value: String(profileStats.activeParticipationsCount) }
    ]
  }, [profileStats])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      errors.name = 'Имя обязательно'
    } else if (formData.name.length < 2) {
      errors.name = 'Имя должно быть не менее 2 символов'
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Неверный формат email'
    }
    
    if (formData.notifications.vk && !formData.vkUserId.trim()) {
      errors.vkUserId = 'Чтобы включить VK-уведомления, укажите VK ID, @username или ссылку на профиль'
    }

    if (formData.notifications.email && !notificationChannelsConfig?.emailConfigured) {
      errors.notifyEmail = 'Email-рассылка пока не настроена на сервере'
    }

    if (formData.notifications.vk && !notificationChannelsConfig?.vkConfigured) {
      errors.notifyVk = 'Для VK-уведомлений на сервере нужен токен сообщества'
    }

    if (formData.notifications.telegram && !telegramState?.connected) {
      errors.notifyTelegram = 'Чтобы включить Telegram-уведомления, сначала привяжите Telegram-бота'
    }

    setValidationErrors(errors)
    
    return Object.keys(errors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    const checked = e.target instanceof HTMLInputElement ? e.target.checked : false

    if (name === 'group' && session?.user?.role === 'STUDENT' && groupChangeCount >= 1) {
      showToast('Группу можно изменить только один раз. Обратитесь к администрации.', 'error')
      return
    }
    
    if (name.startsWith('notifications.')) {
      const notificationKey = name.split('.')[1] as keyof typeof formData.notifications
      setFormData(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          [notificationKey]: checked
        }
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
    
    if (
      validationErrors[name] ||
      name === 'notifications.telegram' ||
      name === 'notifications.email' ||
      name === 'notifications.vk'
    ) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        if (name === 'notifications.telegram') {
          delete newErrors.notifyTelegram
        }
        if (name === 'notifications.email') {
          delete newErrors.notifyEmail
        }
        if (name === 'notifications.vk') {
          delete newErrors.notifyVk
        }
        return newErrors
      })
    }
  }

  const toggleCategory = (category: EventCategory) => {
    setFormData(prev => {
      const current = prev.notifications.categories.length > 0
        ? prev.notifications.categories
        : allCategories
      const next = current.includes(category)
        ? current.filter(item => item !== category)
        : [...current, category]
      const normalized = next.length === 0 ? [...allCategories] : next
      return {
        ...prev,
        notifications: {
          ...prev.notifications,
          categories: normalized
        }
      }
    })
  }

  const selectAllCategories = () => {
    setFormData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        categories: [...allCategories]
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await updateProfile({
        name: formData.name,
        email: formData.email,
        department: formData.department,
        group: formData.group,
        admissionYear: formData.admissionYear ? Number(formData.admissionYear) : null,
        vkUserId: formData.vkUserId,
        bio: formData.bio,
        notifications: {
          newEvents: formData.notifications.newEvents,
          changes: formData.notifications.changes,
          news: formData.notifications.news,
          inApp: formData.notifications.inApp,
          email: formData.notifications.email,
          vk: formData.notifications.vk,
          telegram: formData.notifications.telegram,
          categories: formData.notifications.categories
        }
      })
      
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
          email: formData.email,
          department: formData.department,
          group: formData.group,
          admissionYear: response?.user?.admissionYear ?? (formData.admissionYear ? Number(formData.admissionYear) : null),
          vkUserId: (response?.user?.vkUserId as string | null | undefined) ?? formData.vkUserId,
          bio: formData.bio,
          groupChangeCount: response?.user?.groupChangeCount ?? groupChangeCount,
          notifyNewEvents: formData.notifications.newEvents,
          notifyChanges: formData.notifications.changes,
          notifyNews: formData.notifications.news,
          notifyInApp: formData.notifications.inApp,
          notifyEmail: formData.notifications.email,
          notifyVk: formData.notifications.vk,
          notifyTelegram: response?.user?.notifyTelegram ?? formData.notifications.telegram,
          telegramChatId:
            (response?.user?.telegramChatId as string | null | undefined) ??
            session?.user?.telegramChatId ??
            null,
          telegramUsername:
            (response?.user?.telegramUsername as string | null | undefined) ??
            session?.user?.telegramUsername ??
            null,
          notificationCategories: formData.notifications.categories
        }
      })

      if (response?.user?.groupChangeCount !== undefined) {
        setGroupChangeCount(response.user.groupChangeCount)
      }
      
      setOriginalData(formData)
      setIsDirty(false)
      
      setMessage({
        type: 'success',
        text: 'Профиль успешно обновлен!'
      })
      triggerSaveEffect()
      void loadProfileStats()
      
      window.dispatchEvent(new CustomEvent('profile:updated', {
        detail: { userId: session?.user?.id }
      }))
      
      setTimeout(() => {
        setMessage(null)
      }, 5000)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Ошибка при сохранении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (originalData) {
      setFormData(originalData)
      setValidationErrors({})
      setMessage(null)
      setIsDirty(false)
    }
  }

  const handleLogout = async () => {
    const confirmed = window.confirm('Вы уверены, что хотите выйти?')
    
    if (confirmed) {
      try {
        await signOut({ 
          redirect: true,
          callbackUrl: '/login' 
        })

        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { userId: session?.user?.id }
        }))
      } catch {
        showToast('Ошибка при выходе из системы', 'error')
      }
    }
  }

  const handleExportData = () => {
    const exportData = {
      profile: formData,
      session: {
        userId: session?.user?.id,
        role: session?.user?.role,
        email: session?.user?.email
      },
      exportedAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profile-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleVkConnect = async () => {
    if (!vkProviderAvailable) {
      showToast('VK OAuth не настроен на сервере', 'error')
      return
    }

    try {
      await signIn('vk', {
        callbackUrl: '/profile'
      })
    } catch {
      showToast('Не удалось начать привязку VK', 'error')
    }
  }

  const handleTelegramConnect = async () => {
    setTelegramLinkLoading(true)
    const telegramWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null
    try {
      const payload = await createTelegramLinkApi()
      setTelegramState(prev => prev ? { ...prev, pendingExpiresAt: payload.expiresAt } : prev)
      if (telegramWindow) {
        telegramWindow.opener = null
        telegramWindow.location.href = payload.url
      } else if (typeof window !== 'undefined') {
        window.location.assign(payload.url)
      }
      showToast('Открыл бота Telegram. Нажмите Start и вернитесь на сайт.', 'success')
      void loadTelegramState()
    } catch (error) {
      telegramWindow?.close()
      showToast(error instanceof Error ? error.message : 'Не удалось открыть Telegram-бота', 'error')
    } finally {
      setTelegramLinkLoading(false)
    }
  }

  const handleTelegramDisconnect = async () => {
    setTelegramUnlinkLoading(true)
    try {
      await unlinkTelegramApi()
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          notifyTelegram: false,
          telegramChatId: null,
          telegramUsername: null,
        }
      })
      setFormData(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          telegram: false,
        }
      }))
      setOriginalData(prev => prev ? ({
        ...prev,
        notifications: {
          ...prev.notifications,
          telegram: false,
        }
      }) : prev)
      setTelegramState(prev => prev ? ({
        ...prev,
        connected: false,
        notifyTelegram: false,
        telegramUsername: null,
        telegramChatIdMasked: null,
        pendingExpiresAt: null,
      }) : prev)
      showToast('Telegram отвязан', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось отвязать Telegram', 'error')
    } finally {
      setTelegramUnlinkLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-accent mx-auto"></div>
          <p className="text-gray-600 text-lg">Загрузка профиля...</p>
          <p className="text-sm text-gray-500">Пожалуйста, подождите</p>
          {sessionStuck && (
            <p className="text-xs text-gray-400">
              Сессия грузится слишком долго, попробуйте обновить страницу.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page page-shell px-4 py-8 md:px-[5%] min-h-screen">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <h2 className="section-title text-2xl sm:text-3xl font-bold text-primary flex items-center gap-3">
            <i className="fas fa-user-circle text-accent"></i>
            Настройки профиля
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.href = '/dashboard'
              }}
              icon="arrow-left"
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              На главную
            </Button>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
              <span className="bg-accent/10 text-accent px-3 py-1 rounded-full">
                {toRoleLabel(session.user.role)}
              </span>
              {isDirty && (
                <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full animate-pulse">
                  Есть несохраненные изменения
                </span>
              )}
            </div>
          </div>
        </div>
        
        {message && (
          <div 
            className={`mb-6 p-4 rounded-lg animate-fadeIn border ${
              message.type === 'success' 
                ? 'bg-sky-100 text-sky-700 border-sky-200' 
                : 'bg-rose-100 text-rose-700 border-rose-200'
            }`}
            role="alert"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
                <span>{message.text}</span>
              </div>
              <button 
                onClick={() => setMessage(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Закрыть уведомление"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4 sm:space-y-4">
            <div className="liquid-section p-4 sm:p-5">
              <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white/70 overflow-hidden bg-gradient-to-br from-primary to-secondary mb-4 flex items-center justify-center shadow-xl profile-avatar-ring">
                  {session.user.image ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={session.user.image}
                        alt={session.user.name || 'Аватар'}
                        fill
                        sizes="128px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <i className="fas fa-user text-5xl sm:text-6xl text-white"></i>
                  )}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-primary mb-1.5 sm:mb-2">{session.user.name}</h3>
                <p className="text-sm sm:text-base text-gray-600 break-all">{session.user.email}</p>
              </div>
              
              <div className="space-y-4">
                <div className="profile-info-card">
                  <p className="text-sm text-gray-500 mb-1">ID пользователя</p>
                  <p className="font-mono text-xs text-gray-700 truncate">{session.user.id}</p>
                </div>
                
                <div className="profile-info-card">
                  <p className="text-sm text-gray-500 mb-1">Статус сессии</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-700">Активна</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="liquid-section p-4 sm:p-5">
              <h4 className="font-semibold text-primary mb-4 flex items-center gap-2">
                <i className="fas fa-chart-bar"></i>
                Статистика
              </h4>
              {profileStatsLoading && (
                <p className="text-sm text-gray-500">Загрузка статистики...</p>
              )}

              {!profileStatsLoading && profileStatsError && (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">{profileStatsError}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void loadProfileStats()}
                    className="w-full sm:w-auto"
                  >
                    Повторить
                  </Button>
                </div>
              )}

              {!profileStatsLoading && !profileStatsError && profileStatsRows.length > 0 && (
                <div className="space-y-3">
                  {profileStatsRows.map((row) => (
                    <div key={row.label} className="flex justify-between items-center gap-3">
                      <span className="text-gray-600 text-sm">{row.label}</span>
                      <span className="font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <div className="liquid-section p-4 sm:p-5 lg:p-6">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="form-group">
                    <label htmlFor="name" className="form-label">
                      Имя *
                    </label>
                    <input
                      id="name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`form-control ${validationErrors.name ? 'border-red-500' : ''}`}
                      required
                      aria-invalid={!!validationErrors.name}
                      aria-describedby={validationErrors.name ? "name-error" : undefined}
                    />
                    {validationErrors.name && (
                      <p id="name-error" className="mt-1 text-sm text-red-600">
                        {validationErrors.name}
                      </p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="email" className="form-label">
                      Email *
                    </label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`form-control ${validationErrors.email ? 'border-red-500' : ''}`}
                      required
                      aria-invalid={!!validationErrors.email}
                      aria-describedby={validationErrors.email ? "email-error" : undefined}
                    />
                    {validationErrors.email && (
                      <p id="email-error" className="mt-1 text-sm text-red-600">
                        {validationErrors.email}
                      </p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="department" className="form-label">
                      Кафедра / Факультет
                    </label>
                    <input
                      id="department"
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Например: Кафедра информационных технологий"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="group" className="form-label">
                      Группа / Курс
                    </label>
                    <input
                      id="group"
                      type="text"
                      name="group"
                      value={formData.group}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Например: ИС-21 или 3 курс"
                      disabled={groupChangeLocked}
                    />
                    {groupChangeLocked && (
                      <p className="mt-1 text-xs text-amber-600">
                        Группу можно изменить только один раз. Для повторного изменения обратитесь к администрации.
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="admissionYear" className="form-label">
                      Год поступления
                    </label>
                    <input
                      id="admissionYear"
                      type="number"
                      name="admissionYear"
                      min={1990}
                      max={new Date().getFullYear() + 1}
                      value={formData.admissionYear}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Например: 2023"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Используется в характеристике профиля студента и при сверке учебной группы.
                    </p>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="vkUserId" className="form-label">
                    VK ID / ссылка
                  </label>
                  <input
                    id="vkUserId"
                    type="text"
                    name="vkUserId"
                    value={formData.vkUserId}
                    onChange={handleChange}
                    className={`form-control ${validationErrors.vkUserId ? 'border-red-500' : ''}`}
                    placeholder="Например: id123, @username или https://vk.com/username"
                    aria-invalid={!!validationErrors.vkUserId}
                    aria-describedby={validationErrors.vkUserId ? 'vkUserId-error' : 'vkUserId-help'}
                  />
                  {vkProviderAvailable && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleVkConnect}
                        icon="link"
                        className="w-full sm:w-auto"
                      >
                        Привязать VK через OAuth
                      </Button>
                    </div>
                  )}
                  <p id="vkUserId-help" className="mt-1 text-xs text-gray-500">
                    Нужен для уведомлений в ЛС VK. Можно указать вручную или привязать аккаунт через OAuth.
                  </p>
                  {validationErrors.vkUserId && (
                    <p id="vkUserId-error" className="mt-1 text-sm text-red-600">
                      {validationErrors.vkUserId}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="form-label mb-0">Telegram</label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleTelegramConnect}
                        loading={telegramLinkLoading}
                        disabled={!telegramState?.configured || telegramLinkLoading}
                        icon="paper-plane"
                        className="w-full sm:w-auto"
                      >
                        {telegramState?.connected ? 'Перепривязать Telegram' : 'Привязать Telegram'}
                      </Button>
                      {telegramState?.connected && (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={handleTelegramDisconnect}
                          loading={telegramUnlinkLoading}
                          disabled={telegramUnlinkLoading}
                          icon="unlink"
                          className="w-full sm:w-auto"
                        >
                          Отвязать
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/70 bg-white/70 p-3 text-sm text-gray-600">
                    {telegramState && !telegramState.configured && !telegramLoading && (
                      <p>Telegram-бот пока не настроен на сервере. Нужны `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME`.</p>
                    )}
                    {telegramLoading && (
                      <p>Загружаем статус Telegram...</p>
                    )}
                    {telegramState?.configured && (
                      <div className="space-y-2">
                        <p>
                          Бот: {telegramState.botUsername ? `@${telegramState.botUsername}` : 'не указан'}.
                          {telegramState.connected
                            ? ` Привязан${telegramState.telegramUsername ? ` как @${telegramState.telegramUsername}` : ''}${telegramState.telegramChatIdMasked ? ` (${telegramState.telegramChatIdMasked})` : ''}.`
                            : ' Пока не привязан.'}
                        </p>
                        {telegramState.pendingExpiresAt && !telegramState.connected && (
                          <p className="text-xs text-gray-500">
                            Ссылка на привязку активна до {new Date(telegramState.pendingExpiresAt).toLocaleString('ru-RU')}.
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Нажмите кнопку, откройте бота, отправьте `/start` и вернитесь на эту страницу.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group mb-8">
                  <label htmlFor="bio" className="form-label">
                    О себе
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="form-control min-h-[120px]"
                    placeholder="Короткое описание, интересы, достижения..."
                  />
                </div>
                
                <div className="mb-10">
                  <h3 className="form-label mb-6 flex items-center gap-2">
                    <i className="fas fa-bell"></i>
                    Уведомления
                  </h3>
                  <div className="space-y-3 sm:space-y-4 bg-white/70 border border-white/70 rounded-lg p-3 sm:p-4">
                    <label className="flex items-start sm:items-center gap-3 sm:gap-4 cursor-pointer p-3 hover:bg-white/50 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        name="notifications.newEvents"
                        checked={formData.notifications.newEvents}
                        onChange={handleChange}
                        className="w-5 h-5 text-accent rounded focus:ring-2 focus:ring-accent mt-1 sm:mt-0"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-primary">Новые мероприятия</div>
                        <div className="text-sm text-gray-500">Уведомлять о новых мероприятиях в системе</div>
                      </div>
                      <div className={`w-3 h-3 rounded-full mt-1 sm:mt-0 ${formData.notifications.newEvents ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    </label>
                    
                    <label className="flex items-start sm:items-center gap-3 sm:gap-4 cursor-pointer p-3 hover:bg-white/50 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        name="notifications.changes"
                        checked={formData.notifications.changes}
                        onChange={handleChange}
                        className="w-5 h-5 text-accent rounded focus:ring-2 focus:ring-accent mt-1 sm:mt-0"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-primary">Изменения в моих мероприятиях</div>
                        <div className="text-sm text-gray-500">Уведомлять об изменениях в мероприятиях, где вы участник</div>
                      </div>
                      <div className={`w-3 h-3 rounded-full mt-1 sm:mt-0 ${formData.notifications.changes ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    </label>
                    
                    <label className="flex items-start sm:items-center gap-3 sm:gap-4 cursor-pointer p-3 hover:bg-white/50 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        name="notifications.news"
                        checked={formData.notifications.news}
                        onChange={handleChange}
                        className="w-5 h-5 text-accent rounded focus:ring-2 focus:ring-accent mt-1 sm:mt-0"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-primary">Новости университета</div>
                        <div className="text-sm text-gray-500">Получать новости и объявления от университета</div>
                      </div>
                      <div className={`w-3 h-3 rounded-full mt-1 sm:mt-0 ${formData.notifications.news ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    </label>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="font-medium text-primary">Каналы доставки</div>
                      <p className="mt-1 text-xs text-gray-500">
                        Управляет тем, куда отправлять ваши уведомления. Флажки выше определяют, о чем именно уведомлять.
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                          Внутри сайта: всегда доступно
                        </div>
                        <div className={`rounded-lg border px-3 py-2 text-xs ${notificationChannelsConfig?.emailConfigured ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                          Email: {notificationChannelsConfig?.emailConfigured ? 'настроен' : 'не настроен'}
                        </div>
                        <div className={`rounded-lg border px-3 py-2 text-xs ${notificationChannelsConfig?.vkConfigured ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                          VK: {notificationChannelsConfig?.vkConfigured ? 'настроен' : 'нужен токен сообщества'}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                        {[
                          {
                            name: 'notifications.inApp',
                            title: 'Внутри системы',
                            description: 'Лента уведомлений на сайте',
                            enabled: formData.notifications.inApp,
                          },
                          {
                            name: 'notifications.email',
                            title: 'Email',
                            description: notificationChannelsConfig?.emailConfigured
                              ? 'Письмо на основной email аккаунта'
                              : 'Сначала настройте SMTP или email webhook на сервере',
                            enabled: formData.notifications.email,
                            disabled: !notificationChannelsConfig?.emailConfigured,
                          },
                          {
                            name: 'notifications.vk',
                            title: 'VK',
                            description: notificationChannelsConfig?.vkConfigured
                              ? 'Сообщение сообщества во ВКонтакте'
                              : 'На сервере пока нет токена VK-сообщества',
                            enabled: formData.notifications.vk,
                            disabled: !notificationChannelsConfig?.vkConfigured,
                          },
                          {
                            name: 'notifications.telegram',
                            title: 'Telegram',
                            description: telegramState?.connected
                              ? 'Сообщение от бота в Telegram'
                              : 'Сначала привяжите Telegram-бота',
                            enabled: formData.notifications.telegram,
                            disabled: !telegramState?.configured || !telegramState?.connected,
                          },
                        ].map(({ name, title, description, enabled, disabled }) => (
                          <label
                            key={name}
                            className={`flex items-start gap-3 rounded-lg border border-white/70 bg-white/70 p-3 transition-colors ${
                              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              name={name}
                              checked={enabled}
                              onChange={handleChange}
                              disabled={disabled}
                              className="mt-1 h-4 w-4 rounded text-accent focus:ring-2 focus:ring-accent"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-primary">{title}</span>
                              <span className="block text-xs text-gray-500">{description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      {(validationErrors.notifyEmail || validationErrors.notifyVk || validationErrors.notifyTelegram) && (
                        <div className="mt-3 space-y-1 text-sm text-red-600">
                          {validationErrors.notifyEmail && <p>{validationErrors.notifyEmail}</p>}
                          {validationErrors.notifyVk && <p>{validationErrors.notifyVk}</p>}
                          {validationErrors.notifyTelegram && <p>{validationErrors.notifyTelegram}</p>}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-primary">Категории мероприятий</div>
                        {formData.notifications.categories.length < allCategories.length && (
                          <button
                            type="button"
                            onClick={selectAllCategories}
                            className="text-xs text-accent hover:text-primary transition-colors"
                          >
                            Выбрать все
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Выберите категории, по которым хотите получать уведомления о новых мероприятиях и новостях.
                      </p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {categoryOptions.map(option => (
                          <label
                            key={option.value}
                            className="flex items-center gap-3 p-2 rounded-lg border border-white/70 bg-white/70 hover:bg-white transition-colors cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={formData.notifications.categories.includes(option.value)}
                              onChange={() => toggleCategory(option.value)}
                              className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
                            />
                            <span className="text-gray-700">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-8 border-t border-gray-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full sm:w-auto">
                      <Button 
                        type="submit" 
                        variant="primary"
                        loading={isSaving}
                        disabled={!isDirty || isSaving}
                        icon="save"
                        className={`w-full sm:w-auto ${saveEffect ? 'btn-celebrate' : ''}`}
                      >
                        {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="secondary"
                        onClick={handleReset}
                        disabled={!isDirty || isSaving}
                        icon="undo"
                        className="w-full sm:w-auto"
                      >
                        Отменить
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="secondary"
                        onClick={handleExportData}
                        icon="download"
                        className="w-full sm:w-auto"
                      >
                        Экспорт данных
                      </Button>
                    </div>
                    
                    <div className="flex w-full sm:w-auto">
                      <Button 
                        type="button" 
                        variant="danger"
                        onClick={handleLogout}
                        icon="sign-out-alt"
                        className="w-full sm:w-auto"
                      >
                        Выйти
                      </Button>
                    </div>
                  </div>
                  
                  {isDirty && (
                    <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sky-700">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span className="text-sm">У вас есть несохраненные изменения</span>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}






