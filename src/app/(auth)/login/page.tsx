/**
 * File responsibility:
 * Login page for credentials/OAuth authentication flow.
 *
 * Main logic:
 * - Collect credentials and call auth endpoint.
 * - Handle login errors and redirect on success.
 *
 * Integrations:
 * - next-auth signIn()
 * - src/app/api/auth/[...nextauth]/route.ts
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const sanitizeCallbackUrl = (value: string | null) => {
  if (!value) return '/dashboard'

  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith('/')) return '/dashboard'
    if (decoded.startsWith('//')) return '/dashboard'
    if (decoded === '/') return '/dashboard'
    if (decoded.startsWith('/login') || decoded.startsWith('/register') || decoded.startsWith('/api/')) {
      return '/dashboard'
    }
    return decoded
  } catch {
    return '/dashboard'
  }
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = sanitizeCallbackUrl(searchParams.get('callbackUrl'))
  const showDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true'
  const { data: session, status } = useSession()

  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [sessionStuck, setSessionStuck] = useState(false)
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace(callbackUrl)
    }
  }, [status, session, router, callbackUrl])

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

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!credentials.email) {
      nextErrors.email = 'Укажите email'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      nextErrors.email = 'Некорректный формат email'
    }

    if (!credentials.password) {
      nextErrors.password = 'Укажите пароль'
    } else if (credentials.password.length < 3) {
      nextErrors.password = 'Минимум 3 символа'
    }

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        if (result.error.includes('CredentialsSignin')) {
          setError('Неверный email или пароль')
        } else {
          setError(`Ошибка входа: ${result.error}`)
        }
      } else if (result?.ok) {
        window.location.href = callbackUrl
      }
    } catch (submitError) {
      console.error('Unexpected login error:', submitError)
      setError('Произошла ошибка при входе')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: string) => {
    try {
      await signIn(provider, {
        callbackUrl,
        redirect: true,
      })
    } catch (loginError) {
      console.error(`Social login error for ${provider}:`, loginError)
      setError(`Ошибка входа через ${provider}`)
    }
  }

  const handleInputChange = (field: 'email' | 'password', value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))

    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleDemoLogin = async (type: 'teacher' | 'student') => {
    if (!showDemo) return

    const demoCredentials =
      type === 'teacher'
        ? { email: 'MainTeacher2026@bgitu.ru', password: 'T9mW2pK7sL8xQ4cN' }
        : { email: 'student@bgitu.ru', password: 'student' }

    setCredentials(demoCredentials)
    setError('')
    setFormErrors({})
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: demoCredentials.email,
        password: demoCredentials.password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError('Демо-вход не удался. Проверьте seed-данные.')
      } else if (result?.ok) {
        window.location.href = callbackUrl
      }
    } catch (demoError) {
      console.error('Demo login error:', demoError)
      setError('Ошибка демо-входа')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' && !sessionStuck) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="status-spinner" />
          <p className="text-gray-600">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  if (status === 'authenticated') {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="status-spinner" />
          <p className="text-gray-600">Вы уже авторизованы</p>
          <button onClick={() => router.push('/dashboard')} className="btn btn-secondary mt-2">
            Перейти в dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell min-h-screen px-4 py-10">
      <div className="mx-auto grid w-full max-w-7xl items-start gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="liquid-section hidden p-5 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">Welcome Desk</p>
          <h1 className="page-title mt-3 text-4xl font-semibold">Вход в рабочее пространство афиши</h1>
          <p className="page-subtitle mt-4 text-base">
            Здесь собраны события, новости, календарь и уведомления университета. После входа вы сразу попадаете в обновлённый dashboard.
          </p>

          <div className="mt-7 grid gap-3">
            <div className="liquid-card p-4">
              <p className="text-sm font-semibold text-primary">Единый контур кампуса</p>
              <p className="mt-1 text-sm text-primary/66">События, медиа и расписание в одном интерфейсе.</p>
            </div>
            <div className="liquid-card p-4">
              <p className="text-sm font-semibold text-primary">Быстрый поиск</p>
              <p className="mt-1 text-sm text-primary/66">По аудиториям, темам, участникам и названиям мероприятий.</p>
            </div>
            <div className="liquid-card p-4">
              <p className="text-sm font-semibold text-primary">Ролевой доступ</p>
              <p className="mt-1 text-sm text-primary/66">Разные сценарии для студентов, преподавателей и администраторов.</p>
            </div>
          </div>
        </section>

        <section className="liquid-section p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">БГ</div>
            <div>
              <p className="text-sm font-semibold text-primary">БГИТУ Афиша</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/58">Авторизация</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-primary">Войти в систему</h2>
          <p className="mt-2 text-sm text-primary/66">Используйте корпоративный аккаунт или локальные учетные данные.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                type="email"
                required
                value={credentials.email}
                onChange={(event) => handleInputChange('email', event.target.value)}
                className={`form-control ${formErrors.email ? 'border-red-500' : ''}`}
                placeholder="user@bgitu.ru"
                disabled={loading}
                autoComplete="email"
              />
              {formErrors.email && <p className="form-error">{formErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="form-label">Пароль</label>
              <input
                id="password"
                type="password"
                required
                value={credentials.password}
                onChange={(event) => handleInputChange('password', event.target.value)}
                className={`form-control ${formErrors.password ? 'border-red-500' : ''}`}
                disabled={loading}
                autoComplete="current-password"
              />
              {formErrors.password && <p className="form-error">{formErrors.password}</p>}
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                <div className="flex items-center gap-2">
                  <i className="fas fa-circle-exclamation" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin" />
                  Вход...
                </span>
              ) : (
                'Войти'
              )}
            </button>

            <div className="rounded-xl border border-primary/14 bg-white/78 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/55">Вход через провайдера</p>
              <button
                type="button"
                onClick={() => handleSocialLogin('yandex')}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/18 bg-white px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                disabled={loading}
              >
                <span className="text-base font-bold text-red-600">Я</span>
                Яндекс
              </button>
            </div>

            {showDemo && (
              <div className="rounded-xl border border-primary/14 bg-primary/5 p-4 text-sm text-primary/72">
                <p className="mb-3 font-semibold text-primary">Демо-доступ</p>
                <div className="grid gap-2">
                  <button type="button" onClick={() => handleDemoLogin('teacher')} className="btn btn-primary w-full py-2.5 text-sm" disabled={loading}>
                    Войти как преподаватель
                  </button>
                  <button type="button" onClick={() => handleDemoLogin('student')} className="btn btn-secondary w-full py-2.5 text-sm" disabled={loading}>
                    Войти как студент
                  </button>
                </div>
              </div>
            )}

            <p className="text-center text-sm text-primary/65">
              Нет аккаунта?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Зарегистрироваться
              </Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
