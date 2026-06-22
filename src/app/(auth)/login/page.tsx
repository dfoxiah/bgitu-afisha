/**
 * File responsibility:
 * Public login page with primary OAuth and secondary credentials sign-in.
 *
 * Main logic:
 * - Offer VK, MAX and Yandex as the main sign-in path.
 * - Keep email/password login available for existing and admin-created accounts.
 * - Explain required profile completion and show auth errors.
 *
 * Integrations:
 * - next-auth signIn()
 * - OAuth and credentials providers configured in src/lib/auth.ts
 */
"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { getProviders, signIn, useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { isProfileComplete } from "@/lib/profile-completion"

const sanitizeCallbackUrl = (value: string | null) => {
  if (!value) return "/dashboard"

  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard"
    if (
      decoded === "/" ||
      decoded.startsWith("/login") ||
      decoded.startsWith("/register") ||
      decoded.startsWith("/api/")
    ) {
      return "/dashboard"
    }
    return decoded
  } catch {
    return "/dashboard"
  }
}

const errorMessages: Record<string, string> = {
  OAuthSignin: "Не удалось начать вход через OAuth-провайдера. Проверьте настройки авторизации.",
  OAuthCallback: "Провайдер вернул некорректный callback. Попробуйте войти ещё раз.",
  OAuthAccountNotLinked:
    "Этот email уже связан с другим способом входа. Войдите в существующий аккаунт и привяжите VK из профиля.",
  OAuthCreateAccount: "Не удалось создать аккаунт через OAuth. Проверьте настройки провайдера.",
  CredentialsSignin: "Неверный email или пароль.",
  AccessDenied: "Вход отменён или доступ не разрешён.",
  Configuration: "Авторизация не настроена на сервере. Нужны параметры провайдеров.",
  Verification: "Ссылка авторизации устарела. Начните вход заново.",
  default: "Не удалось выполнить вход. Попробуйте снова.",
}

type OAuthProviderId = "vk" | "max" | "yandex"
type LoadingProvider = OAuthProviderId | "telegram" | "credentials" | null

type TelegramLoginConfig = {
  configured: boolean
  botUsername: string | null
}

type TelegramAuthUser = {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date?: number | string
  hash?: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthUser) => void
  }
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"))
  const authError = searchParams.get("error")
  const { data: session, status } = useSession()
  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null)
  const [localError, setLocalError] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPasswordLogin, setShowPasswordLogin] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean>>({})
  const [telegramConfig, setTelegramConfig] = useState<TelegramLoginConfig | null>(null)
  const telegramWidgetRef = useRef<HTMLDivElement | null>(null)

  const displayedError = useMemo(() => {
    if (localError) return localError
    if (!authError) return ""
    return errorMessages[authError] || errorMessages.default
  }, [authError, localError])

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return
    router.replace(isProfileComplete(session.user) ? callbackUrl : "/profile/complete")
  }, [callbackUrl, router, session, status])

  useEffect(() => {
    let active = true

    const loadProviders = async () => {
      const providers = await getProviders().catch(() => null)
      if (!active) return

      let nextTelegramConfig: TelegramLoginConfig | null = null
      if (providers?.telegram) {
        const response = await fetch("/api/auth/telegram/config", {
          method: "GET",
          cache: "no-store",
        }).catch(() => null)

        if (response?.ok) {
          nextTelegramConfig = (await response.json()) as TelegramLoginConfig
        }
      }

      if (!active) return

      setAvailableProviders({
        vk: Boolean(providers?.vk),
        max: Boolean(providers?.max),
        yandex: Boolean(providers?.yandex),
        telegram: Boolean(providers?.telegram),
        credentials: Boolean(providers?.credentials),
      })
      setTelegramConfig(nextTelegramConfig)
    }

    void loadProviders()
    return () => {
      active = false
    }
  }, [])

  const handleOAuth = async (provider: OAuthProviderId) => {
    setLocalError("")

    if (!availableProviders[provider]) {
      if (provider === "vk") {
        setLocalError("VK OAuth не настроен на сервере. Заполните VK_CLIENT_ID и VK_CLIENT_SECRET в env.")
      } else if (provider === "max") {
        setLocalError("MAX OAuth не настроен на сервере. Заполните MAX_CLIENT_ID, MAX_CLIENT_SECRET и OAuth URL в env.")
      } else {
        setLocalError("Яндекс OAuth не настроен на сервере. Заполните YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET в env.")
      }
      return
    }

    setLoadingProvider(provider)

    try {
      await signIn(provider, {
        callbackUrl,
        redirect: true,
      })
    } catch {
      if (provider === "vk") {
        setLocalError("Не удалось начать вход через VK")
      } else if (provider === "max") {
        setLocalError("Не удалось начать вход через MAX")
      } else {
        setLocalError("Не удалось начать вход через Яндекс")
      }
      setLoadingProvider(null)
    }
  }

  useEffect(() => {
    window.onTelegramAuth = async (telegramUser: TelegramAuthUser) => {
      setLocalError("")
      setLoadingProvider("telegram")

      try {
        const result = await signIn("telegram", {
          id: String(telegramUser.id ?? ""),
          first_name: telegramUser.first_name ?? "",
          last_name: telegramUser.last_name ?? "",
          username: telegramUser.username ?? "",
          photo_url: telegramUser.photo_url ?? "",
          auth_date: String(telegramUser.auth_date ?? ""),
          hash: telegramUser.hash ?? "",
          callbackUrl,
          redirect: false,
        })

        if (!result?.ok) {
          setLocalError(
            errorMessages[result?.error || "CredentialsSignin"] || "Не удалось войти через Telegram."
          )
          setLoadingProvider(null)
          return
        }

        router.replace(result.url ?? callbackUrl)
        router.refresh()
      } catch {
        setLocalError("Не удалось выполнить вход через Telegram.")
        setLoadingProvider(null)
      }
    }

    return () => {
      delete window.onTelegramAuth
    }
  }, [callbackUrl, router])

  useEffect(() => {
    const container = telegramWidgetRef.current
    if (!container) return

    container.innerHTML = ""

    if (!availableProviders.telegram || !telegramConfig?.configured || !telegramConfig.botUsername) {
      return
    }

    const script = document.createElement("script")
    script.async = true
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.setAttribute("data-telegram-login", telegramConfig.botUsername)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-radius", "16")
    script.setAttribute("data-request-access", "write")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")

    container.appendChild(script)

    return () => {
      container.innerHTML = ""
    }
  }, [availableProviders.telegram, telegramConfig])

  const handleCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError("")

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setLocalError("Введите email и пароль.")
      return
    }

    setLoadingProvider("credentials")
    try {
      const result = await signIn("credentials", {
        email: trimmedEmail,
        password,
        callbackUrl,
        redirect: false,
      })

      if (!result?.ok) {
        setLocalError(
          errorMessages[result?.error || "CredentialsSignin"] || errorMessages.CredentialsSignin
        )
        setLoadingProvider(null)
        return
      }

      router.replace(callbackUrl)
      router.refresh()
    } catch {
      setLocalError("Не удалось выполнить вход по email и паролю.")
      setLoadingProvider(null)
    }
  }

  if (status === "loading") {
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
    <div className="page-shell min-h-screen px-4 py-10">
      <div className="mx-auto grid w-full max-w-6xl items-stretch gap-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="page-hero flex flex-col justify-between p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">
              БГИТУ Афиша
            </p>
            <h1 className="page-title mt-3 text-3xl font-semibold sm:text-4xl">
              Вход через VK, MAX, Яндекс или выданный аккаунт
            </h1>
            <p className="page-subtitle mt-4 text-base leading-7">
              Новые пользователи заходят через OAuth и после первого входа заполняют
              учебный профиль. Email и пароль остаются для существующих и
              администратором созданных аккаунтов.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              [
                "Публичная афиша",
                "Гости видят только открытые мероприятия без данных участников.",
              ],
              [
                "Профиль обязателен",
                "Факультет, группа и курс нужны для заявок, ролей и статистики.",
              ],
              [
                "Согласия сохраняются",
                "Версия документа, дата и источник принятия фиксируются в базе.",
              ],
            ].map(([title, text]) => (
              <article key={title} className="liquid-card p-4">
                <p className="text-sm font-semibold text-primary">{title}</p>
                <p className="mt-1 text-sm text-primary/66">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="liquid-section flex flex-col justify-center p-5 sm:p-6">
          <div className="mb-7 flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
              БГ
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">БГИТУ Афиша</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/58">
                Авторизация
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-primary">Выберите способ входа</h2>
          <p className="mt-2 text-sm leading-6 text-primary/66">
            Публичная регистрация отключена. OAuth остаётся основным способом входа, а
            парольный вход доступен ниже для аккаунтов, которые уже есть в системе.
          </p>

          <div className="mt-6 grid gap-3">
            <div className="rounded-xl border border-[#229ED9]/20 bg-[#229ED9]/[0.08] p-4 text-primary shadow-[0_12px_24px_rgba(34,158,217,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Telegram</div>
                  <div className="mt-1 text-xs text-primary/66">
                    {telegramConfig?.botUsername
                      ? `Вход через бота @${telegramConfig.botUsername}`
                      : "Вход через Telegram пока не настроен"}
                  </div>
                </div>
                {loadingProvider === "telegram" && (
                  <i className="fas fa-spinner fa-spin text-sm text-[#229ED9]" aria-hidden="true" />
                )}
              </div>

              {availableProviders.telegram && telegramConfig?.configured && telegramConfig.botUsername ? (
                <div ref={telegramWidgetRef} className="mt-3 flex min-h-[42px] items-center justify-center" />
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-3 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white opacity-60"
                >
                  Telegram не настроен
                </button>
              )}
              <p className="mt-3 text-xs leading-5 text-primary/66">
                РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РІС…РѕРґР° РїСЂРёС…РѕРґРёС‚ РІ РїСЂРёР»РѕР¶РµРЅРёРµ Telegram РґР»СЏ СЌС‚РѕРіРѕ РЅРѕРјРµСЂР°, Р° РЅРµ РІ С‡Р°С‚ СЃ Р±РѕС‚РѕРј.
                Р•СЃР»Рё Р·Р°РїСЂРѕСЃ РЅРµ РїРѕСЏРІР»СЏРµС‚СЃСЏ, РІРѕР№РґРёС‚Рµ С‡РµСЂРµР· РЇРЅРґРµРєСЃ Рё Р·Р°С‚РµРј РІ РїСЂРѕС„РёР»Рµ
                РЅР°Р¶РјРёС‚Рµ В«РџСЂРёРІСЏР·Р°С‚СЊ TelegramВ» РґР»СЏ СѓРІРµРґРѕРјР»РµРЅРёР№.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOAuth("vk")}
              disabled={Boolean(loadingProvider) || !availableProviders.vk}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#0077ff] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(0,119,255,0.22)] transition hover:bg-[#0066da] disabled:opacity-60"
            >
              <span className="text-base font-bold">VK</span>
              {loadingProvider === "vk"
                ? "Переходим..."
                : availableProviders.vk
                  ? "Войти через VK"
                  : "VK не настроен"}
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("max")}
              disabled={Boolean(loadingProvider) || !availableProviders.max}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#101828] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(16,24,40,0.2)] transition hover:bg-[#1d2939] disabled:opacity-60"
            >
              <span className="text-base font-bold">MAX</span>
              {loadingProvider === "max"
                ? "Переходим..."
                : availableProviders.max
                  ? "Войти через MAX"
                  : "MAX не настроен"}
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("yandex")}
              disabled={Boolean(loadingProvider) || !availableProviders.yandex}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-primary/16 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-[0_10px_20px_rgba(18,39,76,0.1)] transition hover:border-primary/34 hover:bg-primary/5 disabled:opacity-60"
            >
              <span className="text-base font-bold text-red-600">Я</span>
              {loadingProvider === "yandex"
                ? "Переходим..."
                : availableProviders.yandex
                  ? "Войти через Яндекс"
                  : "Яндекс не настроен"}
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-primary/10 bg-white/72">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-primary/72 hover:text-primary"
              onClick={() => setShowPasswordLogin((value) => !value)}
              aria-expanded={showPasswordLogin}
            >
              <span>Войти по email и паролю</span>
              <i
                className={`fas fa-chevron-${showPasswordLogin ? "up" : "down"} text-xs`}
                aria-hidden="true"
              />
            </button>

            {showPasswordLogin && (
              <form
                className="space-y-3 border-t border-primary/10 px-4 py-4"
                onSubmit={handleCredentials}
              >
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/54">
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="mt-1 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    placeholder="name@example.com"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/54">
                    Пароль
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-xl border border-primary/14 bg-white px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    placeholder="Введите пароль"
                  />
                </label>
                <button
                  type="submit"
                  disabled={Boolean(loadingProvider)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/14 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60"
                >
                  {loadingProvider === "credentials" && (
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                  )}
                  {loadingProvider === "credentials"
                    ? "Проверяем..."
                    : "Войти по паролю"}
                </button>
              </form>
            )}
          </div>

          {displayedError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {displayedError}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-primary/66">
            <Link href="/afisha" className="font-medium text-primary hover:underline">
              Смотреть публичную афишу
            </Link>
            <Link href="/legal/privacy" className="font-medium text-primary hover:underline">
              Политика конфиденциальности
            </Link>
            <Link href="/legal/terms" className="font-medium text-primary hover:underline">
              Пользовательское соглашение
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
