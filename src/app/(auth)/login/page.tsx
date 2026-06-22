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

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
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
type LoadingProvider = OAuthProviderId | "telegram" | "telegram-bot" | "credentials" | null

type TelegramLoginConfig = {
  configured: boolean
  botUsername: string | null
}

type TelegramBotLoginCreateResponse = {
  success: boolean
  requestId: string
  url: string
  botUsername: string | null
  expiresAt: string
}

type TelegramBotLoginStatusResponse = {
  configured: boolean
  botUsername: string | null
  status: "pending" | "ready" | "expired"
  expiresAt: string | null
  loginToken?: string
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

type IconProps = {
  className?: string
}

const LogoMark = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 7.5C4 6.12 5.12 5 6.5 5h11C18.88 5 20 6.12 20 7.5v9c0 1.38-1.12 2.5-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
      className="fill-current opacity-20"
    />
    <path
      d="M8 9.25h8M8 12h8m-8 2.75h5.25"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="m6.75 9.5.7.7 1.35-1.6m-2.05 5.1.7.7 1.35-1.6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const TelegramIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M21.2 4.8 18 19.1c-.24 1.02-.87 1.27-1.77.8l-4.9-3.62-2.36 2.28c-.26.26-.48.48-.98.48l.35-5.02 9.14-8.26c.4-.35-.09-.54-.62-.18L5.57 12.77 1.08 11.37c-.98-.3-.99-.98.2-1.45L19.02 3.1c.82-.3 1.53.2 1.28 1.7Z"
      fill="currentColor"
    />
  </svg>
)

const VkIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12.82 17c-5.12 0-8.04-3.5-8.16-9.33h2.57c.08 4.28 1.97 6.1 3.47 6.48V7.67h2.42v3.7c1.48-.16 3.03-1.85 3.55-3.7h2.42c-.4 2.28-2.08 3.97-3.28 4.67 1.2.57 3.12 2.08 3.84 4.66h-2.66c-.57-1.78-1.98-3.16-3.87-3.35V17h-.3Z"
      fill="currentColor"
    />
  </svg>
)

const YandexIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M13.61 20h-3.1V13l-4.36-9h3.36l2.56 5.88L14.63 4H18l-4.39 9v7Zm.06-11.07c1.7 0 2.68-.9 2.68-2.42 0-1.55-.98-2.44-2.68-2.44h-3.16v4.86h3.16Z"
      fill="currentColor"
    />
  </svg>
)

const MaxIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.5 17.5V6.5h2.37l3.17 5.09L13.2 6.5h2.3v11h-2.26V10.1l-2.62 4.14h-1.2L6.77 10.1v7.4H4.5Zm13.14 0 2.07-3.15L17.7 11.3h2.54l.8 1.36.8-1.35H24l-2 3.06 2.05 3.13h-2.53l-.87-1.44-.9 1.44h-2.11Z"
      fill="currentColor"
    />
  </svg>
)

const CheckIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="m5 10.5 3.1 3.1L15 6.75"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SparkIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="m10 1.5 1.95 5.55L17.5 9l-5.55 1.95L10 16.5l-1.95-5.55L2.5 9l5.55-1.95L10 1.5Z"
      fill="currentColor"
    />
  </svg>
)

const LockIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M6.5 8V6.75a3.5 3.5 0 1 1 7 0V8m-7 0h7m-7 0A1.5 1.5 0 0 0 5 9.5V14a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 15 14V9.5A1.5 1.5 0 0 0 13.5 8"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ProfileIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M10 10.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 5a5 5 0 0 1 10 0"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)

const CalendarIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M6.5 2.75v2.5m7-2.5v2.5M4.75 6h10.5m-9.75 9.25h9A1.75 1.75 0 0 0 16.25 13.5V6.5A1.75 1.75 0 0 0 14.5 4.75h-9A1.75 1.75 0 0 0 3.75 6.5v7A1.75 1.75 0 0 0 5.5 15.25Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const MailIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.75 5.5h10.5c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1H4.75c-.55 0-1-.45-1-1v-7c0-.55.45-1 1-1Zm0 .75L10 10l5.25-3.75"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ChevronIcon = ({ className = "h-4 w-4", open = false }: IconProps & { open?: boolean }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    className={`${className} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    aria-hidden="true"
  >
    <path
      d="m5 7.5 5 5 5-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SpinnerIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`} aria-hidden="true">
    <circle cx="12" cy="12" r="9" className="stroke-current opacity-20" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" className="stroke-current" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

type AuthProviderButtonProps = {
  name: string
  description: string
  available: boolean
  loading: boolean
  disabled: boolean
  onClick: () => void
  icon: ReactNode
  tone: "vk" | "max" | "yandex"
}

const authProviderThemes: Record<AuthProviderButtonProps["tone"], string> = {
  vk: "border-[#0077ff]/20 bg-gradient-to-br from-[#0077ff] via-[#1683ff] to-[#5aa7ff] text-white shadow-[0_18px_38px_rgba(0,119,255,0.24)] hover:shadow-[0_22px_42px_rgba(0,119,255,0.3)]",
  max: "border-slate-800/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 text-white shadow-[0_18px_38px_rgba(15,23,42,0.26)] hover:shadow-[0_22px_42px_rgba(15,23,42,0.34)]",
  yandex: "border-red-500/20 bg-gradient-to-br from-white via-white to-red-50 text-primary shadow-[0_18px_38px_rgba(15,23,42,0.12)] hover:shadow-[0_22px_42px_rgba(15,23,42,0.18)]",
}

const AuthProviderButton = ({
  name,
  description,
  available,
  loading,
  disabled,
  onClick,
  icon,
  tone,
}: AuthProviderButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`group relative overflow-hidden rounded-[1.35rem] border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${authProviderThemes[tone]}`}
  >
    <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_40%)]" />
    <div className="relative flex items-center gap-4">
      <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone === "yandex" ? "bg-red-500 text-white" : "bg-white/14 text-white"} ${tone === "yandex" ? "" : "backdrop-blur-sm"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{name}</span>
          {!available && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone === "yandex" ? "bg-primary/8 text-primary/65" : "bg-white/14 text-white/80"}`}>
              недоступно
            </span>
          )}
        </div>
        <p className={`mt-1 text-sm ${tone === "yandex" ? "text-primary/68" : "text-white/78"}`}>
          {loading ? "Подключаем провайдера…" : available ? description : `${name} пока не настроен`}
        </p>
      </div>
      {loading ? (
        <SpinnerIcon className={`h-5 w-5 ${tone === "yandex" ? "text-primary" : "text-white"}`} />
      ) : (
        <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone === "yandex" ? "bg-primary/8 text-primary/72" : "bg-white/12 text-white/80"}`}>
          {available ? "OAuth" : "env"}
        </div>
      )}
    </div>
  </button>
)

const toTelegramApiError = async (response: Response, fallback: string) => {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return fallback

  const payload = await response.json().catch(() => null)
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error
  }
  if (typeof payload?.errorPayload?.message === "string" && payload.errorPayload.message.trim()) {
    return payload.errorPayload.message
  }
  return fallback
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
  const [telegramBotRequestId, setTelegramBotRequestId] = useState<string | null>(null)
  const [telegramBotLink, setTelegramBotLink] = useState<string | null>(null)
  const [telegramBotPendingUntil, setTelegramBotPendingUntil] = useState<string | null>(null)
  const [telegramBotStatus, setTelegramBotStatus] = useState<"idle" | "pending" | "ready" | "expired">("idle")
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

  useEffect(() => {
    if (!telegramBotRequestId || telegramBotStatus !== "pending") {
      return
    }

    let active = true
    let intervalId: number | null = null

    const pollTelegramBotLogin = async () => {
      const response = await fetch(
        `/api/auth/telegram/login?requestId=${encodeURIComponent(telegramBotRequestId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      ).catch(() => null)

      if (!active || !response) return

      if (!response.ok) {
        setLocalError(await toTelegramApiError(response, "Не удалось проверить статус Telegram-входа."))
        setLoadingProvider(null)
        return
      }

      const payload = (await response.json()) as TelegramBotLoginStatusResponse
      if (!active) return

      if (payload.status === "expired") {
        setTelegramBotStatus("expired")
        setTelegramBotPendingUntil(null)
        setLoadingProvider(null)
        setLocalError("Ссылка для входа через Telegram истекла. Нажмите кнопку ещё раз.")
        return
      }

      setTelegramBotPendingUntil(payload.expiresAt)

      if (payload.status !== "ready" || !payload.loginToken) {
        return
      }

      setTelegramBotStatus("ready")
      setLoadingProvider("telegram-bot")

      try {
        const result = await signIn("telegram-bot", {
          loginToken: payload.loginToken,
          callbackUrl,
          redirect: false,
        })

        if (!active) return

        if (!result?.ok) {
          setLocalError("Не удалось завершить вход через Telegram-бота.")
          setLoadingProvider(null)
          return
        }

        router.replace(result.url ?? callbackUrl)
        router.refresh()
      } catch {
        if (!active) return
        setLocalError("Не удалось завершить вход через Telegram-бота.")
        setLoadingProvider(null)
      }
    }

    void pollTelegramBotLogin()
    intervalId = window.setInterval(() => {
      void pollTelegramBotLogin()
    }, 2500)

    return () => {
      active = false
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [callbackUrl, router, telegramBotRequestId, telegramBotStatus])

  const handleTelegramBotFallback = async () => {
    setLocalError("")

    if (!telegramConfig?.configured || !telegramConfig.botUsername) {
      setLocalError("Telegram-бот для входа пока не настроен на сервере.")
      return
    }

    setLoadingProvider("telegram-bot")
    setTelegramBotStatus("pending")

    try {
      const response = await fetch("/api/auth/telegram/login", {
        method: "POST",
      })

      if (!response.ok) {
        setTelegramBotStatus("idle")
        setLoadingProvider(null)
        setLocalError(await toTelegramApiError(response, "Не удалось создать ссылку для Telegram-бота."))
        return
      }

      const payload = (await response.json()) as TelegramBotLoginCreateResponse
      setTelegramBotRequestId(payload.requestId)
      setTelegramBotLink(payload.url)
      setTelegramBotPendingUntil(payload.expiresAt)
      window.open(payload.url, "_blank", "noopener,noreferrer")
    } catch {
      setTelegramBotStatus("idle")
      setLoadingProvider(null)
      setLocalError("Не удалось открыть Telegram-бота для входа.")
    }
  }

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

  const heroHighlights = [
    {
      title: "Публичная афиша",
      text: "Гости видят открытые мероприятия, а участники получают персональные сценарии входа и уведомлений.",
      icon: <CalendarIcon className="h-4 w-4" />,
    },
    {
      title: "Единый профиль",
      text: "Факультет, группа и роль подтягиваются в один кабинет — без повторного заполнения на каждом экране.",
      icon: <ProfileIcon className="h-4 w-4" />,
    },
    {
      title: "Защищённый доступ",
      text: "Telegram, OAuth и парольный вход работают как параллельные способы входа без потери данных профиля.",
      icon: <LockIcon className="h-4 w-4" />,
    },
  ]

  const trustPills = [
    "Telegram fallback",
    "VK / Яндекс OAuth",
    "Профиль и уведомления",
  ]

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
    <div className="page-shell relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[18%] h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[35%] h-64 w-64 rounded-full bg-[#229ED9]/18 blur-3xl" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1220] px-5 py-6 text-white shadow-[0_30px_90px_rgba(8,15,32,0.42)] sm:px-7 sm:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.16),transparent_28%)]" />
          <div className="absolute inset-y-0 right-[-14%] hidden w-[48%] rounded-full bg-white/5 blur-2xl lg:block" />

          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/74 backdrop-blur-sm">
                  <SparkIcon className="h-3.5 w-3.5" />
                  БГИТУ Афиша
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/22 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                  <CheckIcon className="h-3.5 w-3.5" />
                  Telegram fallback уже включён
                </span>
              </div>

              <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-[3.25rem] lg:leading-[1.05]">
                Современный вход в афишу кампуса — с OAuth, Telegram и единым профилем пользователя.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74 sm:text-base">
                Новые пользователи входят через Telegram, VK или Яндекс, а существующие аккаунты могут
                использовать парольный доступ. После первого входа профиль, уведомления и права работают
                из одного кабинета.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {trustPills.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur-sm"
                  >
                    <CheckIcon className="h-3.5 w-3.5 text-cyan-200" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {heroHighlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.4rem] border border-white/10 bg-white/7 p-4 backdrop-blur-sm"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-cyan-100">
                    {item.icon}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/68">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,158,217,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(29,78,216,0.06),transparent_36%)]" />

          <div className="relative">
            <div className="mb-7 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_18px_36px_rgba(29,78,216,0.25)]">
                  <LogoMark className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">БГИТУ Афиша</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/50">
                    Авторизация
                  </p>
                </div>
              </div>
              <div className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary/70">
                4 способа входа
              </div>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-[2rem]">
              Выберите удобный способ входа
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary/66">
              Публичная регистрация отключена. OAuth остаётся основным сценарием, а Telegram дополнительно
              поддерживает резервный вход через бота, если встроенное подтверждение не срабатывает.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[1.6rem] border border-[#229ED9]/20 bg-gradient-to-br from-[#229ED9]/14 via-white to-[#229ED9]/8 p-5 text-primary shadow-[0_18px_40px_rgba(34,158,217,0.14)]">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-[0_14px_26px_rgba(34,158,217,0.3)]">
                    <TelegramIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-primary">Telegram</h3>
                      {telegramConfig?.botUsername && (
                        <span className="rounded-full bg-[#229ED9]/10 px-2.5 py-1 text-[11px] font-semibold text-[#229ED9]">
                          @{telegramConfig.botUsername}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-primary/68">
                      Быстрый вход через Telegram Widget и резервный сценарий через бота, если подтверждение в приложении не приходит.
                    </p>
                  </div>
                  {loadingProvider === "telegram" || loadingProvider === "telegram-bot" ? (
                    <SpinnerIcon className="mt-1 h-5 w-5 text-[#229ED9]" />
                  ) : (
                    <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      online
                    </span>
                  )}
                </div>

                {availableProviders.telegram && telegramConfig?.configured && telegramConfig.botUsername ? (
                  <div ref={telegramWidgetRef} className="mt-4 flex min-h-[42px] items-center justify-center rounded-2xl bg-white/70 px-3 py-3" />
                ) : (
                  <div className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white opacity-60">
                    <TelegramIcon className="h-4 w-4" />
                    Telegram не настроен
                  </div>
                )}

                {telegramConfig?.configured && telegramConfig.botUsername && (
                  <>
                    <button
                      type="button"
                      onClick={handleTelegramBotFallback}
                      disabled={Boolean(loadingProvider) && loadingProvider !== "telegram-bot" || telegramBotStatus === "ready"}
                      className="mt-3 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-[#229ED9]/25 bg-white/85 px-4 py-3 text-sm font-semibold text-[#229ED9] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <TelegramIcon className="h-4 w-4" />
                      {loadingProvider === "telegram-bot" || telegramBotStatus === "pending"
                        ? "Ожидаем подтверждение в боте…"
                        : "Если код не приходит — войти через бота"}
                    </button>

                    {telegramBotLink && telegramBotStatus === "pending" && (
                      <div className="mt-2 rounded-2xl border border-[#229ED9]/16 bg-white/65 px-3.5 py-3 text-center text-xs leading-5 text-primary/70">
                        <a
                          href={telegramBotLink}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#229ED9] underline underline-offset-2"
                        >
                          Открыть бота ещё раз
                        </a>
                        {telegramBotPendingUntil && (
                          <span>
                            {" "}
                            · ссылка активна до{" "}
                            {new Date(telegramBotPendingUntil).toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="mt-3 rounded-2xl border border-primary/10 bg-white/55 px-3.5 py-3 text-xs leading-5 text-primary/66">
                  Подтверждение Telegram Login приходит в приложение Telegram для этого номера, а не в чат с ботом.
                  Если системное подтверждение не появляется, используйте кнопку входа через бота или войдите через Яндекс,
                  а затем привяжите Telegram в профиле.
                </div>
              </div>

              <AuthProviderButton
                name="VK"
                description="Подходит для быстрого входа студентов и организаторов без отдельного пароля."
                available={Boolean(availableProviders.vk)}
                loading={loadingProvider === "vk"}
                disabled={Boolean(loadingProvider) || !availableProviders.vk}
                onClick={() => handleOAuth("vk")}
                icon={<VkIcon className="h-5 w-5" />}
                tone="vk"
              />

              <AuthProviderButton
                name="MAX"
                description="Подключение корпоративного провайдера для внутренних и администраторских сценариев."
                available={Boolean(availableProviders.max)}
                loading={loadingProvider === "max"}
                disabled={Boolean(loadingProvider) || !availableProviders.max}
                onClick={() => handleOAuth("max")}
                icon={<MaxIcon className="h-5 w-5" />}
                tone="max"
              />

              <AuthProviderButton
                name="Яндекс"
                description="Универсальный вход для личного кабинета, профиля и последующей привязки уведомлений."
                available={Boolean(availableProviders.yandex)}
                loading={loadingProvider === "yandex"}
                disabled={Boolean(loadingProvider) || !availableProviders.yandex}
                onClick={() => handleOAuth("yandex")}
                icon={<YandexIcon className="h-5 w-5" />}
                tone="yandex"
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-primary/10 bg-white/72 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                onClick={() => setShowPasswordLogin((value) => !value)}
                aria-expanded={showPasswordLogin}
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/7 text-primary">
                    <MailIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">Войти по email и паролю</p>
                    <p className="text-xs text-primary/58">Для существующих и вручную созданных аккаунтов</p>
                  </div>
                </div>
                <ChevronIcon open={showPasswordLogin} className="h-4 w-4 text-primary/62" />
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
                    <div className="mt-1 flex items-center gap-3 rounded-2xl border border-primary/14 bg-white px-3 py-2.5 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                      <MailIcon className="h-4 w-4 text-primary/45" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        className="w-full bg-transparent text-sm text-primary outline-none"
                        placeholder="name@example.com"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/54">
                      Пароль
                    </span>
                    <div className="mt-1 flex items-center gap-3 rounded-2xl border border-primary/14 bg-white px-3 py-2.5 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                      <LockIcon className="h-4 w-4 text-primary/45" />
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        className="w-full bg-transparent text-sm text-primary outline-none"
                        placeholder="Введите пароль"
                      />
                    </div>
                  </label>
                  <button
                    type="submit"
                    disabled={Boolean(loadingProvider)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(29,78,216,0.22)] transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {loadingProvider === "credentials" && <SpinnerIcon className="h-4 w-4 text-white" />}
                    {loadingProvider === "credentials" ? "Проверяем…" : "Войти по паролю"}
                  </button>
                </form>
              )}
            </div>

            {displayedError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
          </div>
        </section>
      </div>
    </div>
  )
}
