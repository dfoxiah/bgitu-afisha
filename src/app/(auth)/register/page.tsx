/**
 * File responsibility:
 * Registration page for new local user accounts.
 *
 * Main logic:
 * - Collect registration form payload.
 * - Call register API and route to login/dashboard.
 *
 * Integrations:
 * - src/app/api/auth/register/route.ts
 * - next/navigation redirects
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const { status } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [sessionStuck, setSessionStuck] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    department: '',
    group: '',
    acceptPrivacy: false,
    acceptTerms: false
  })
  const highlights = [
    {
      title: 'Единый календарь',
      description: 'Все университетские мероприятия, дедлайны и новости в одном месте.'
    },
    {
      title: 'Умные уведомления',
      description: 'Автоматические напоминания о событиях и изменениях расписания.'
    },
    {
      title: 'Прозрачная история',
      description: 'Ваши регистрации и участие сохраняются в профиле.'
    }
  ]

  useEffect(() => {
    if (status === 'loading') {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => setSessionStuck(true), 8000)
      }
      return
    }
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
  }, [status])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = 'Имя обязательно'
    }
    if (!formData.email.trim()) {
      errors.email = 'Email обязателен'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Неверный формат email'
    }
    if (!formData.password) {
      errors.password = 'Пароль обязателен'
    } else if (formData.password.length < 6) {
      errors.password = 'Пароль должен быть не менее 6 символов'
    }
    if (formData.passwordConfirm !== formData.password) {
      errors.passwordConfirm = 'Пароли не совпадают'
    }
    if (!formData.group.trim()) {
      errors.group = '\u0413\u0440\u0443\u043f\u043f\u0430 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u0430'
    }
    if (!formData.acceptPrivacy || !formData.acceptTerms) {
      errors.consent = 'Необходимо принять соглашения'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          department: formData.department,
          group: formData.group,
          acceptPrivacy: formData.acceptPrivacy,
          acceptTerms: formData.acceptTerms
        })
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Ошибка регистрации')
        return
      }

      setSuccess('Аккаунт создан. Теперь можно войти.')
      setTimeout(() => router.push('/login'), 1200)
    } catch {
      setError('Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'authenticated' && !sessionStuck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray px-4 py-10">
        <div className="liquid-card max-w-md w-full p-8 text-center">
          <p className="text-gray-700">Вы уже авторизованы</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 btn btn-primary"
          >
            Перейти на главную
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-light-gray px-4 py-10">
      <div className="container mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="liquid-card p-8 md:p-10 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                БГ
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">
                  БГИТУ <span className="text-accent">Афиша</span>
                </h1>
                <p className="text-sm text-gray-600">Регистрация студента</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label">Имя *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`form-control ${formErrors.name ? 'border-red-500' : ''}`}
                  placeholder="Фамилия Имя"
                  disabled={loading}
                />
                {formErrors.name && <p className="form-error">{formErrors.name}</p>}
              </div>

              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={`form-control ${formErrors.email ? 'border-red-500' : ''}`}
                  placeholder="student@bgitu.ru"
                  disabled={loading}
                />
                {formErrors.email && <p className="form-error">{formErrors.email}</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">{'\u041f\u0430\u0440\u043e\u043b\u044c *'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className={`form-control ${formErrors.password ? 'border-red-500' : ''}`}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {formErrors.password && <p className="form-error">{formErrors.password}</p>}
                </div>
                <div>
                  <label className="form-label">{'\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c *'}</label>
                  <input
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={(e) => handleChange('passwordConfirm', e.target.value)}
                    className={`form-control ${formErrors.passwordConfirm ? 'border-red-500' : ''}`}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {formErrors.passwordConfirm && (
                    <p className="form-error">{formErrors.passwordConfirm}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">{'\u041a\u0430\u0444\u0435\u0434\u0440\u0430 / \u0424\u0430\u043a\u0443\u043b\u044c\u0442\u0435\u0442'}</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => handleChange('department', e.target.value)}
                    className="form-control"
                    placeholder={'\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u041a\u0430\u0444\u0435\u0434\u0440\u0430 \u0418\u0422'}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="form-label">{'\u0413\u0440\u0443\u043f\u043f\u0430 *'}</label>
                  <input
                    type="text"
                    value={formData.group}
                    onChange={(e) => handleChange('group', e.target.value)}
                    className={`form-control ${formErrors.group ? 'border-red-500' : ''}`}
                    placeholder={'\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u0418\u0421-21'}
                    required
                    disabled={loading}
                  />
                  {formErrors.group && <p className="form-error">{formErrors.group}</p>}
                  <p className="text-xs text-gray-500 mt-1">{'\u0413\u0440\u0443\u043f\u043f\u0443 \u043c\u043e\u0436\u043d\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043e\u0434\u0438\u043d \u0440\u0430\u0437.'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={formData.acceptTerms}
                    onChange={(e) => handleChange('acceptTerms', e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Я принимаю{' '}
                    <Link href="/legal/terms" className="text-accent hover:text-primary font-medium">
                      пользовательское соглашение
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={formData.acceptPrivacy}
                    onChange={(e) => handleChange('acceptPrivacy', e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Я согласен с{' '}
                    <Link href="/legal/privacy" className="text-accent hover:text-primary font-medium">
                      политикой конфиденциальности
                    </Link>
                  </span>
                </label>
                {formErrors.consent && <p className="form-error">{formErrors.consent}</p>}
              </div>

              {(error || success) && (
                <div role="status" aria-live="polite">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      <div className="flex items-center">
                        <i className="fas fa-exclamation-circle mr-2"></i>
                        <span>{error}</span>
                      </div>
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                      <div className="flex items-center">
                        <i className="fas fa-check-circle mr-2"></i>
                        <span>{success}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Создание...
                  </span>
                ) : 'Создать аккаунт'}
              </button>

              <div className="text-center text-sm text-gray-600">
                Уже есть аккаунт?{' '}
                <Link href="/login" className="text-accent hover:text-primary font-medium">
                  Войти
                </Link>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="liquid-card p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Почему стоит зарегистрироваться</h2>
              <div className="space-y-3">
                {highlights.map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/80 border border-white/70 flex items-center justify-center text-primary shadow-sm">
                      <i className="fas fa-star"></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="liquid-card p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Данные и безопасность</h3>
              <p className="text-sm text-gray-600 mt-2">
                Мы обрабатываем персональные данные только для работы сервиса. Все действия фиксируются в аудит‑логе.
              </p>
              <div className="mt-3 text-sm text-gray-600">
                Ознакомьтесь с{' '}
                <Link href="/legal/terms" className="text-accent hover:text-primary font-medium">
                  соглашением
                </Link>{' '}
                и{' '}
                <Link href="/legal/privacy" className="text-accent hover:text-primary font-medium">
                  политикой
                </Link>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
