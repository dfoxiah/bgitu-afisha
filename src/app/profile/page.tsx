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
import { useSession, signOut, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAppContext } from '@/contexts/AppContext'
import Button from '@/components/ui/Button'
import { useDebugger } from '@/lib/debugger'
import { showToast } from '@/lib/toast'
import { CategoryDisplayMap } from '@/types'
import { EventCategory } from '@prisma/client'

interface ProfileFormData {
  name: string
  email: string
  department: string
  group: string
  bio: string
  notifications: {
    newEvents: boolean
    changes: boolean
    news: boolean
    categories: EventCategory[]
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const { updateProfile } = useAppContext()
  const debug = useDebugger('ProfilePage')
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
    bio: '',
    notifications: {
      newEvents: true,
      changes: true,
      news: false,
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

  useEffect(() => {
    if (session?.user) {
      debug.info('profile', 'Session data loaded', {
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
        hasName: !!session.user.name,
        hasDepartment: !!session.user.department,
        hasGroup: !!session.user.group
      })

      const savedCategories = Array.isArray(session.user.notificationCategories)
        ? session.user.notificationCategories
        : []
      const resolvedCategories = savedCategories.length > 0 ? savedCategories : allCategories

      const newFormData: ProfileFormData = {
        name: session.user.name || '',
        email: session.user.email || '',
        department: session.user.department || '',
        group: session.user.group || '',
        bio: session.user.bio || '',
        notifications: {
          newEvents: session.user.notifyNewEvents ?? true,
          changes: session.user.notifyChanges ?? true,
          news: session.user.notifyNews ?? false,
          categories: resolvedCategories
        }
      }

      setGroupChangeCount(session.user.groupChangeCount ?? 0)
      setFormData(newFormData)
      setOriginalData(newFormData)
    }
  }, [session, debug, allCategories])

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
          debug.warn('auth', 'Profile access revoked, signing out', {
            status: response.status
          })
          await signOut({ redirect: true, callbackUrl: '/login' })
        }
      } catch (error) {
        debug.error('auth', 'Failed to verify profile session', error)
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
  }, [status, debug])

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

  const getChangedFields = useCallback(() => {
    if (!originalData) return []
    
    const changed: string[] = []
    Object.keys(formData).forEach(key => {
      if (key === 'notifications') {
        Object.keys(formData.notifications).forEach(subKey => {
          if (subKey === 'categories') {
            const current = [...formData.notifications.categories].sort().join('|')
            const original = [...originalData.notifications.categories].sort().join('|')
            if (current !== original) {
              changed.push('notifications.categories')
            }
            return
          }

          if (
            formData.notifications[subKey as keyof typeof formData.notifications] !== 
            originalData.notifications[subKey as keyof typeof originalData.notifications]
          ) {
            changed.push(`notifications.${subKey}`)
          }
        })
      } else if (formData[key as keyof ProfileFormData] !== originalData[key as keyof ProfileFormData]) {
        changed.push(key)
      }
    })
    return changed
  }, [formData, originalData])

  useEffect(() => {
    if (originalData) {
      const dirty = JSON.stringify(formData) !== JSON.stringify(originalData)
      setIsDirty(dirty)
      debug.debug('ui', `Form dirty state: ${dirty}`, {
        changedFields: dirty ? getChangedFields() : []
      })
    }
  }, [formData, originalData, debug, getChangedFields])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      errors.name = 'Имя обязательно'
      debug.warn('validation', 'Name validation failed')
    } else if (formData.name.length < 2) {
      errors.name = 'Имя должно быть не менее 2 символов'
      debug.warn('validation', 'Name length validation failed', {
        length: formData.name.length
      })
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email обязателен'
      debug.warn('validation', 'Email validation failed')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Неверный формат email'
      debug.warn('validation', 'Email format validation failed', {
        email: formData.email
      })
    }
    
    setValidationErrors(errors)
    debug.debug('validation', 'Form validation completed', {
      hasErrors: Object.keys(errors).length > 0,
      errors: Object.keys(errors)
    })
    
    return Object.keys(errors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = e.target instanceof HTMLInputElement ? e.target.checked : false

    if (name === 'group' && session?.user?.role === 'STUDENT' && groupChangeCount >= 1) {
      showToast('Группу можно изменить только один раз. Обратитесь к администрации.', 'error')
      return
    }
    
    debug.debug('ui', `Input changed: ${name}`, {
      name,
      value: name.includes('password') ? '***' : value,
      type,
      checked: type === 'checkbox' ? checked : undefined
    })
    
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
    
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
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
    debug.trackClick('Save profile button', e as React.MouseEvent)
    
    if (!validateForm()) {
      debug.error('validation', 'Form validation failed, aborting submit')
      return
    }
    
    setIsSaving(true)
    setMessage(null)
    
    const changedFields = getChangedFields()
    debug.info('profile', 'Starting profile update', {
      changedFields,
      formData: {
        name: formData.name,
        email: formData.email,
        department: formData.department,
        group: formData.group,
        notifications: formData.notifications
      }
    })

    try {
      const endTimer = debug.time('updateProfile API call')
      debug.trackApi('/api/auth/profile', 'PUT', {
        name: formData.name,
        email: formData.email,
        department: formData.department,
        group: formData.group
      })
      
      const response = await updateProfile({
        name: formData.name,
        email: formData.email,
        department: formData.department,
        group: formData.group,
        bio: formData.bio,
        notifications: {
          newEvents: formData.notifications.newEvents,
          changes: formData.notifications.changes,
          news: formData.notifications.news,
          categories: formData.notifications.categories
        }
      })
      
      const duration = endTimer()
      
      debug.info('profile', 'Profile updated successfully', {
        response,
        duration: `${duration}ms`,
        changedFields
      })
      
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
          email: formData.email,
          department: formData.department,
          group: formData.group,
          bio: formData.bio,
          groupChangeCount: response?.user?.groupChangeCount ?? groupChangeCount,
          notifyNewEvents: formData.notifications.newEvents,
          notifyChanges: formData.notifications.changes,
          notifyNews: formData.notifications.news,
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
      
      window.dispatchEvent(new CustomEvent('profile:updated', {
        detail: { userId: session?.user?.id }
      }))
      
      setTimeout(() => {
        debug.debug('ui', 'Success message timeout cleared')
        setMessage(null)
      }, 5000)
    } catch (error) {
      debug.error('profile', 'Profile update failed', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        timestamp: new Date().toISOString()
      })
      
      setMessage({
        type: 'error',
        text: `Ошибка при сохранении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      })
    } finally {
      setIsSaving(false)
      debug.debug('profile', 'Profile update process completed', {
        isSaving: false,
        hasError: message?.type === 'error',
        isDirty
      })
    }
  }

  const handleReset = () => {
    debug.trackClick('Reset form button', {} as React.MouseEvent)
    
    if (originalData) {
      setFormData(originalData)
      setValidationErrors({})
      setMessage(null)
      setIsDirty(false)
      debug.info('ui', 'Form reset to original values')
    }
  }

  const handleLogout = async () => {
    debug.trackClick('Logout button', {} as React.MouseEvent)
    
    const confirmed = window.confirm('Вы уверены, что хотите выйти?')
    
    if (confirmed) {
      debug.info('auth', 'User confirmed logout, starting sign out')
      
      try {
        await signOut({ 
          redirect: true,
          callbackUrl: '/login' 
        })
        
        debug.info('auth', 'Sign out successful')
        
        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { userId: session?.user?.id }
        }))
      } catch (error) {
        debug.error('auth', 'Sign out failed', error)
        showToast('Ошибка при выходе из системы', 'error')
      }
    } else {
      debug.debug('auth', 'User cancelled logout')
    }
  }

  const handleExportData = () => {
    debug.trackClick('Export data button', {} as React.MouseEvent)
    
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
    
    debug.info('profile', 'Profile data exported', {
      exportData,
      timestamp: new Date().toISOString()
    })
  }

  if (!session) {
    debug.warn('auth', 'No session, showing loading state')
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-light-gray">
        <div className="text-center space-y-4">
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
    <div className="profile-page px-4 md:px-[5%] py-8 bg-light-gray min-h-screen">
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
              debugContext="ProfilePage"
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              На главную
            </Button>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
              <span className="bg-accent/10 text-accent px-3 py-1 rounded-full">
                {session.user.role === 'TEACHER' ? 'Преподаватель' : 
                 session.user.role === 'ADMIN' ? 'Администратор' : 'Студент'}
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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <div className="liquid-section p-4 sm:p-6">
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
            
            <div className="liquid-section p-4 sm:p-6">
              <h4 className="font-semibold text-primary mb-4 flex items-center gap-2">
                <i className="fas fa-chart-bar"></i>
                Статистика
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Роль</span>
                  <span className="font-medium">{session.user.role}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Активность</span>
                  <span className="font-medium">Сегодня</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <div className="liquid-section p-4 sm:p-6 lg:p-8">
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
                        debugContext="ProfilePage"
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
                        debugContext="ProfilePage"
                      >
                        Отменить
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="secondary"
                        onClick={handleExportData}
                        icon="download"
                        className="w-full sm:w-auto"
                        debugContext="ProfilePage"
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
                        debugContext="ProfilePage"
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
            
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 bg-gray-900 text-gray-100 rounded-lg shadow-md p-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <i className="fas fa-bug"></i>
                  Отладочная информация
                </h4>
                <div className="space-y-3 text-sm font-mono">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <span className="text-gray-400">User ID:</span>
                      <div className="truncate">{session.user.id}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Role:</span>
                      <div>{session.user.role}</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Changed Fields:</span>
                    <div className="text-green-400">
                      {getChangedFields().join(', ') || 'Нет изменений'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Form Dirty:</span>
                    <span className={isDirty ? 'text-yellow-400' : 'text-gray-400'}>
                      {isDirty ? 'Да' : 'Нет'}
                    </span>
                  </div>
                  <button
                    onClick={() => debug.clearLogs()}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    Очистить логи дебаггера
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}






