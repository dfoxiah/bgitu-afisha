'use client'

import { useState, useEffect, useRef } from 'react'
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
    if (
      decoded.startsWith('/login') ||
      decoded.startsWith('/register') ||
      decoded.startsWith('/api/')
    ) {
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
  
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  })
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
    const errors: Record<string, string> = {}
    
    if (!credentials.email) {
      errors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      errors.email = 'Неверный формат email'
    }
    
    if (!credentials.password) {
      errors.password = 'Пароль обязателен'
    } else if (credentials.password.length < 3) {
      errors.password = 'Пароль должен быть не менее 3 символов'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        redirect: false,
        callbackUrl: callbackUrl
      })

      if (result?.error) {
        console.error('Login error:', result.error)
        
        if (result.error.includes('CredentialsSignin')) {
          setError('Неверный email или пароль')
        } else {
          setError('Произошла ошибка при входе: ' + result.error)
        }
      } else if (result?.ok) {
        // Принудительно обновляем страницу для обновления сессии
        window.location.href = callbackUrl
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      setError('Произошла ошибка при входе')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: string) => {
    try {
      await signIn(provider, { 
        callbackUrl: callbackUrl,
        redirect: true 
      })
    } catch (error) {
      console.error(`Social login error for ${provider}:`, error)
      setError(`Ошибка входа через ${provider}`)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({...prev, [field]: value}))
    
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleDemoLogin = async (type: 'teacher' | 'student') => {
    if (!showDemo) return
    const demoCredentials = type === 'teacher' 
      ? { email: 'MainTeacher2026@bgitu.ru', password: 'T9mW2pK7sL8xQ4cN' }
      : { email: 'student@bgitu.ru', password: 'student' }
    
    setCredentials(demoCredentials)
    setError('')
    setFormErrors({})
    
    // Автоматический вход с демо-данными
    setLoading(true)
    
    try {
      const result = await signIn('credentials', {
        email: demoCredentials.email,
        password: demoCredentials.password,
        redirect: false,
        callbackUrl
      })

      if (result?.error) {
        setError('Демо-вход не удался. Проверьте данные seed.')
      } else if (result?.ok) {
        window.location.href = callbackUrl
      }
    } catch (error) {
      console.error('Demo login error:', error)
      setError('Ошибка демо-входа')
    } finally {
      setLoading(false)
    }
  }

  // Показываем загрузку при проверке сессии
  if (status === 'loading' && !sessionStuck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  // Если уже авторизован, показываем редирект
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-gray-600">Вы уже авторизованы</p>
          <p className="text-sm text-gray-500 mt-2">Перенаправление на главную...</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
          >
            Перейти сейчас
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fadeInUp">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white font-bold text-xl">
              БГ
            </div>
            <h1 className="text-2xl font-bold text-primary">
              БГИТУ <span className="text-accent">Афиша</span>
            </h1>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">Вход в систему</h2>
          <p className="text-gray-600 mt-2">Используйте учетные данные БГИТУ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              value={credentials.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                formErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="user@bgitu.ru"
              disabled={loading}
              autoComplete="email"
            />
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-600">
                {formErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Пароль *
            </label>
            <input
              id="password"
              type="password"
              required
              value={credentials.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors ${
                formErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
              autoComplete="current-password"
            />
            {formErrors.password && (
              <p className="mt-1 text-sm text-red-600">
                {formErrors.password}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <i className="fas fa-exclamation-circle mr-2"></i>
                <span>{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Вход...
              </span>
            ) : 'Войти'}
          </button>

          <div className="text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Или войдите через</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors hover:border-accent"
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              
              <button
                type="button"
                onClick={() => handleSocialLogin('yandex')}
                className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors hover:border-accent"
                disabled={loading}
              >
                <span className="text-lg font-bold text-red-600">Я</span>
                Яндекс
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 text-center text-sm text-gray-600">
            {showDemo && (
              <>
                <p className="mb-3 font-medium">Демо-доступ:</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('teacher')}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    disabled={loading}
                  >
                    Войти как преподаватель
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('student')}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    disabled={loading}
                  >
                    Войти как студент
                  </button>
                </div>
                <div className="mt-4 space-y-1 text-xs">
                  <p className="font-medium">Преподаватель: MainTeacher2026@bgitu.ru / T9mW2pK7sL8xQ4cN</p>
                  <p className="font-medium">Студент: student@bgitu.ru / student</p>
                </div>
              </>
            )}

            <div className={showDemo ? 'mt-4 pt-4 border-t border-gray-200' : ''}>
              <p className="text-gray-500">
                Нет аккаунта?{' '}
                <Link href="/register" className="text-accent hover:text-primary font-medium">
                  Зарегистрироваться
                </Link>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
