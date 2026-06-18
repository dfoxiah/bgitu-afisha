/**
 * File responsibility:
 * Mandatory profile completion screen after OAuth sign-in.
 *
 * Main logic:
 * - Collect required educational profile fields and legal consents.
 * - Persist completion via API and refresh NextAuth session claims.
 *
 * Integrations:
 * - src/app/api/auth/profile/complete/route.ts
 * - OAuth first sign-in flow
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
  getProfileCompletionIssues,
} from "@/lib/profile-completion"

type FormState = {
  name: string
  email: string
  department: string
  group: string
  admissionYear: string
  vkUserId: string
  notifyInApp: boolean
  notifyEmail: boolean
  notifyVk: boolean
  acceptPrivacy: boolean
  acceptTerms: boolean
}

const sanitizeCallbackUrl = (value: string | null) => {
  if (!value) return "/dashboard"
  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard"
    if (decoded.startsWith("/login") || decoded.startsWith("/register") || decoded.startsWith("/api/")) {
      return "/dashboard"
    }
    return decoded === "/profile/complete" ? "/dashboard" : decoded
  } catch {
    return "/dashboard"
  }
}

export default function CompleteProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"))
  const { data: session, status, update } = useSession()
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    department: "",
    group: "",
    admissionYear: "",
    vkUserId: "",
    notifyInApp: true,
    notifyEmail: false,
    notifyVk: false,
    acceptPrivacy: false,
    acceptTerms: false,
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent("/profile/complete")}`)
    }
  }, [router, status])

  useEffect(() => {
    if (!session?.user) return
    setFormData((previous) => ({
      ...previous,
      name: previous.name || session.user.name || "",
      email:
        previous.email ||
        (session.user.email && !session.user.email.endsWith("@oauth.local")
          ? session.user.email
          : ""),
      department: previous.department || session.user.department || "",
      group: previous.group || session.user.group || "",
      admissionYear:
        previous.admissionYear ||
        (session.user.admissionYear ? String(session.user.admissionYear) : ""),
      vkUserId: previous.vkUserId || session.user.vkUserId || "",
      notifyInApp: session.user.notifyInApp ?? previous.notifyInApp,
      notifyEmail: session.user.notifyEmail ?? previous.notifyEmail,
      notifyVk: session.user.notifyVk ?? previous.notifyVk,
      acceptPrivacy:
        previous.acceptPrivacy ||
        (session.user.privacyConsentVersion === PRIVACY_POLICY_VERSION &&
          Boolean(session.user.privacyConsentAt)),
      acceptTerms:
        previous.acceptTerms ||
        (session.user.termsConsentVersion === TERMS_VERSION && Boolean(session.user.termsConsentAt)),
    }))
  }, [session])

  const issues = useMemo(
    () =>
      getProfileCompletionIssues({
        name: formData.name,
        email: formData.email,
        department: formData.department,
        group: formData.group,
        admissionYear: formData.admissionYear ? Number(formData.admissionYear) : null,
        role: session?.user?.role,
        privacyConsentAt: formData.acceptPrivacy ? new Date() : null,
        privacyConsentVersion: formData.acceptPrivacy ? PRIVACY_POLICY_VERSION : null,
        termsConsentAt: formData.acceptTerms ? new Date() : null,
        termsConsentVersion: formData.acceptTerms ? TERMS_VERSION : null,
        profileCompletedAt: new Date(),
      }),
    [formData, session?.user?.role]
  )

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
    if (error) setError("")
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (issues.length > 0) {
      setError(issues[0])
      return
    }

    setSaving(true)
    setError("")

    try {
      const response = await fetch("/api/auth/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          admissionYear: formData.admissionYear ? Number(formData.admissionYear) : null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        const nextError =
          payload?.details?.issues?.[0] ||
          payload?.errorPayload?.message ||
          payload?.error ||
          "Не удалось сохранить профиль"
        setError(nextError)
        return
      }

      await update({
        user: {
          ...session?.user,
          ...payload.user,
        },
      })
      router.replace(callbackUrl)
    } catch {
      setError("Не удалось сохранить профиль")
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading" || !session?.user) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="status-spinner" />
          <p className="text-primary/70">Проверяем авторизацию...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell min-h-screen px-4 py-8 md:px-[5%]">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="page-hero p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">
            Первый вход
          </p>
          <h1 className="page-title mt-3 text-3xl font-semibold">
            Заполните профиль, чтобы продолжить
          </h1>
          <p className="page-subtitle mt-3 text-sm leading-7">
            OAuth подтверждает личность через VK, MAX или Яндекс, а учебные данные нужны для
            заявок, статистики факультетов, групп и корректных уведомлений.
          </p>

          <div className="mt-6 space-y-3 text-sm text-primary/70">
            <div className="liquid-card p-4">
              <p className="font-semibold text-primary">Закрытые разделы временно ограничены</p>
              <p className="mt-1">
                После сохранения профиля откроются dashboard, мероприятия, уведомления и личная
                статистика.
              </p>
            </div>
            <div className="liquid-card p-4">
              <p className="font-semibold text-primary">Версии документов</p>
              <p className="mt-1">
                Политика: {PRIVACY_POLICY_VERSION}. Соглашение: {TERMS_VERSION}.
              </p>
            </div>
          </div>
        </aside>

        <section className="liquid-section p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">ФИО *</label>
                <input
                  className="form-control"
                  value={formData.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder="Фамилия Имя Отчество"
                  required
                />
              </div>

              <div>
                <label className="form-label">Email *</label>
                <input
                  className="form-control"
                  type="email"
                  value={formData.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="user@example.ru"
                  required
                />
              </div>

              <div>
                <label className="form-label">Факультет / кафедра *</label>
                <input
                  className="form-control"
                  value={formData.department}
                  onChange={(event) => handleChange("department", event.target.value)}
                  placeholder="Например: ФИТ"
                  required
                />
              </div>

              <div>
                <label className="form-label">Группа *</label>
                <input
                  className="form-control"
                  value={formData.group}
                  onChange={(event) => handleChange("group", event.target.value)}
                  placeholder="Например: ИС-23"
                  required
                />
              </div>

              <div>
                <label className="form-label">Год поступления *</label>
                <input
                  className="form-control"
                  type="number"
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  value={formData.admissionYear}
                  onChange={(event) => handleChange("admissionYear", event.target.value)}
                  placeholder="2024"
                  required
                />
              </div>

              <div>
                <label className="form-label">VK ID или ссылка на профиль</label>
                <input
                  className="form-control"
                  value={formData.vkUserId}
                  onChange={(event) => handleChange("vkUserId", event.target.value)}
                  placeholder="Например: id123, @username или https://vk.com/username"
                />
              </div>
            </div>

            <div className="rounded-xl border border-primary/12 bg-white/78 p-4">
              <p className="text-sm font-semibold text-primary">Каналы уведомлений</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ["notifyInApp", "Внутри системы"],
                  ["notifyEmail", "Email / Яндекс"],
                  ["notifyVk", "VK / сообщения сообщества"],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-primary/72">
                    <input
                      type="checkbox"
                      checked={Boolean(formData[field as keyof FormState])}
                      onChange={(event) => handleChange(field as keyof FormState, event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-primary/12 bg-white/78 p-4 text-sm text-primary/76">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(event) => handleChange("acceptTerms", event.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  Я принимаю{" "}
                  <Link href="/legal/terms" className="font-semibold text-primary hover:underline">
                    пользовательское соглашение
                  </Link>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.acceptPrivacy}
                  onChange={(event) => handleChange("acceptPrivacy", event.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  Я согласен с{" "}
                  <Link href="/legal/privacy" className="font-semibold text-primary hover:underline">
                    политикой конфиденциальности
                  </Link>
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full py-3" disabled={saving}>
              {saving ? "Сохраняем..." : "Сохранить профиль и продолжить"}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
