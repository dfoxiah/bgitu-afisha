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

import { useEffect, useRef, useState } from 'react'
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
    acceptTerms: false,
  })

  const highlights = [
    {
      title: 'Календарь кампуса',
      description: 'Все университетские события и важные дедлайны в одном месте.',
    },
    {
      title: 'Уведомления',
      description: 'Изменения времени и статуса мероприятий приходят автоматически.',
    },
    {
      title: 'Профиль участника',
      description: 'История регистраций и активность по мероприятиям сохраняются в аккаунте.',
    },
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

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      nextErrors.name = 'Укажите имя'
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Укажите email'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Некорректный формат email'
    }

    if (!formData.password) {
      nextErrors.password = 'Укажите пароль'
    } else if (formData.password.length < 6) {
      nextErrors.password = 'Минимум 6 символов'
    }

    if (formData.passwordConfirm !== formData.password) {
      nextErrors.passwordConfirm = 'Пароли не совпадают'
    }

    if (!formData.group.trim()) {
      nextErrors.group = 'Укажите группу'
    }

    if (!formData.acceptPrivacy || !formData.acceptTerms) {
      nextErrors.consent = 'Необходимо принять условия и политику'
    }

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
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
          acceptTerms: formData.acceptTerms,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка регистрации')
        return
      }

      setSuccess('Аккаунт создан. Перенаправляем на страницу входа...')
      setTimeout(() => router.push('/login'), 1200)
    } catch {
      setError('Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'authenticated' && !sessionStuck) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4 text-center">
          <p className="text-gray-700">Вы уже авторизованы</p>
          <button onClick={() => router.push('/dashboard')} className="btn btn-primary">
            Перейти в dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="liquid-section p-5 sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">БГ</div>
              <div>
                <p className="text-sm font-semibold text-primary">БГИТУ Афиша</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/58">Регистрация</p>
              </div>
            </div>

            <h1 className="page-title text-2xl font-semibold sm:text-3xl">Создать аккаунт студента</h1>
            <p className="mt-2 text-sm text-primary/66">После регистрации можно записываться на события, получать уведомления и работать с лентой кампуса.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="form-label">Имя *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => handleChange('name', event.target.value)}
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
                  onChange={(event) => handleChange('email', event.target.value)}
                  className={`form-control ${formErrors.email ? 'border-red-500' : ''}`}
                  placeholder="student@bgitu.ru"
                  disabled={loading}
                />
                {formErrors.email && <p className="form-error">{formErrors.email}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Пароль *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(event) => handleChange('password', event.target.value)}
                    className={`form-control ${formErrors.password ? 'border-red-500' : ''}`}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {formErrors.password && <p className="form-error">{formErrors.password}</p>}
                </div>
                <div>
                  <label className="form-label">Повторите пароль *</label>
                  <input
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={(event) => handleChange('passwordConfirm', event.target.value)}
                    className={`form-control ${formErrors.passwordConfirm ? 'border-red-500' : ''}`}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {formErrors.passwordConfirm && <p className="form-error">{formErrors.passwordConfirm}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Кафедра / факультет</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(event) => handleChange('department', event.target.value)}
                    className="form-control"
                    placeholder="Например: кафедра ИТ"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="form-label">Группа *</label>
                  <input
                    type="text"
                    value={formData.group}
                    onChange={(event) => handleChange('group', event.target.value)}
                    className={`form-control ${formErrors.group ? 'border-red-500' : ''}`}
                    placeholder="Например: ИС-21"
                    disabled={loading}
                  />
                  {formErrors.group && <p className="form-error">{formErrors.group}</p>}
                </div>
              </div>

              <div className="space-y-2 text-sm text-primary/72">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={formData.acceptTerms} onChange={(event) => handleChange('acceptTerms', event.target.checked)} className="mt-1" />
                  <span>
                    Я принимаю{' '}
                    <Link href="/legal/terms" className="font-medium text-primary hover:underline">
                      пользовательское соглашение
                    </Link>
                  </span>
                </label>

                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={formData.acceptPrivacy} onChange={(event) => handleChange('acceptPrivacy', event.target.checked)} className="mt-1" />
                  <span>
                    Я согласен с{' '}
                    <Link href="/legal/privacy" className="font-medium text-primary hover:underline">
                      политикой конфиденциальности
                    </Link>
                  </span>
                </label>

                {formErrors.consent && <p className="form-error">{formErrors.consent}</p>}
              </div>

              {(error || success) && (
                <div role="status" aria-live="polite">
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-circle-exclamation" />
                        <span>{error}</span>
                      </div>
                    </div>
                  )}
                  {success && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-circle-check" />
                        <span>{success}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <i className="fas fa-spinner fa-spin" />
                    Создание...
                  </span>
                ) : (
                  'Создать аккаунт'
                )}
              </button>

              <p className="text-center text-sm text-primary/65">
                Уже есть аккаунт?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Войти
                </Link>
              </p>
            </form>
          </section>

          <aside className="space-y-4">
            <section className="liquid-section p-5">
              <h2 className="text-lg font-semibold text-primary">Что вы получите после регистрации</h2>
              <div className="mt-4 space-y-3">
                {highlights.map((item) => (
                  <div key={item.title} className="liquid-card p-4">
                    <p className="text-sm font-semibold text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-primary/65">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="liquid-section p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/60">Данные и безопасность</h3>
              <p className="mt-3 text-sm leading-7 text-primary/68">
                Мы используем персональные данные только для работы сервиса. Детали описаны в документах и доступны по ссылкам ниже.
              </p>
              <div className="mt-3 text-sm text-primary/68">
                <Link href="/legal/terms" className="font-medium text-primary hover:underline">Соглашение</Link>
                {' · '}
                <Link href="/legal/privacy" className="font-medium text-primary hover:underline">Политика</Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
