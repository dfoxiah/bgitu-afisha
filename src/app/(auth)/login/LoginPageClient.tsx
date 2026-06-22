/**
 * File responsibility:
 * Public sign-in page with Telegram, Yandex and credentials login.
 *
 * Main logic:
 * - Start Telegram bot login flow and poll for completion.
 * - Start Yandex OAuth flow.
 * - Handle email/password sign-in for existing accounts.
 *
 * Integrations:
 * - src/app/api/auth/telegram/login/route.ts
 * - src/lib/auth.ts
 * - next-auth signIn()
 */
"use client"

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { isProfileComplete } from "@/lib/profile-completion"

export type LoginPageConfig = {
  telegram: {
    configured: boolean
    botUsername: string | null
  }
  yandex: {
    configured: boolean
  }
}

type LoadingProvider = "telegram-bot" | "yandex" | "credentials" | null

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

type IconProps = {
  className?: string
}

const errorMessages: Record<string, string> = {
  OAuthSignin: "Не удалось начать вход через Яндекс. Попробуйте ещё раз.",
  OAuthCallback: "Яндекс вернул некорректный ответ. Повторите вход.",
  OAuthAccountNotLinked:
    "Этот email уже связан с другим способом входа. Войдите в существующий аккаунт и привяжите новый способ из профиля.",
  OAuthCreateAccount: "Не удалось создать аккаунт через Яндекс.",
  CredentialsSignin: "Неверный email или пароль.",
  AccessDenied: "Вход отменён или доступ не разрешён.",
  Configuration: "Авторизация на сервере настроена не полностью.",
  Verification: "Ссылка авторизации устарела. Начните вход заново.",
  default: "Не удалось выполнить вход. Попробуйте ещё раз.",
}

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

const LogoMark = ({ className = "h-6 w-6" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 7.5C4 6.12 5.12 5 6.5 5h11C18.88 5 20 6.12 20 7.5v9c0 1.38-1.12 2.5-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
      className="fill-current opacity-15"
    />
    <path d="M8 9.25h8M8 12h8m-8 2.75h5.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

const YandexIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M13.61 20h-3.1V13l-4.36-9h3.36l2.56 5.88L14.63 4H18l-4.39 9v7Zm.06-11.07c1.7 0 2.68-.9 2.68-2.42 0-1.55-.98-2.44-2.68-2.44h-3.16v4.86h3.16Z"
      fill="currentColor"
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

const ArrowIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path d="M4 10h11m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SpinnerIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`} aria-hidden="true">
    <circle cx="12" cy="12" r="9" className="stroke-current opacity-20" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" className="stroke-current" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

const toTelegramApiError = async (response: Response, fallback: string) => {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return fallback

  const payload = await response.json().catch(() => null)
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error
  if (typeof payload?.errorPayload?.message === "string" && payload.errorPayload.message.trim()) {
    return payload.errorPayload.message
  }
  return fallback
}

const FeatureCard = ({
  title,
  text,
  icon,
}: {
  title: string
  text: string
  icon: ReactNode
}) => (
  <article className="rounded-[1.45rem] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-cyan-100">
      {icon}
    </div>
    <p className="mt-3 text-sm font-semibold text-white">{title}</p>
    <p className="mt-1 text-sm leading-6 text-white/70">{text}</p>
  </article>
)

export default function LoginPageClient({
  initialConfig,
}: {
  initialConfig: LoginPageConfig
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"))
  const authError = searchParams.get("error")
  const { data: session, status } = useSession()

  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null)
  const [localError, setLocalError] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [telegramBotRequestId, setTelegramBotRequestId] = useState<string | null>(null)
  const [telegramBotLink, setTelegramBotLink] = useState<string | null>(null)
  const [telegramBotPendingUntil, setTelegramBotPendingUntil] = useState<string | null>(null)
  const [telegramBotStatus, setTelegramBotStatus] = useState<"idle" | "pending" | "ready" | "expired">("idle")

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
    if (!telegramBotRequestId || telegramBotStatus !== "pending") return

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
        setLocalError(await toTelegramApiError(response, "Не удалось проверить статус входа через Telegram."))
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

      try {
        const result = await signIn("telegram-bot", {
          loginToken: payload.loginToken,
          callbackUrl,
          redirect: false,
        })

        if (!active) return

        if (!result?.ok) {
          setLocalError("Не удалось завершить вход через Telegram.")
          setLoadingProvider(null)
          return
        }

        router.replace(result.url ?? callbackUrl)
        router.refresh()
      } catch {
        if (!active) return
        setLocalError("Не удалось завершить вход через Telegram.")
        setLoadingProvider(null)
      }
    }

    void pollTelegramBotLogin()
    intervalId = window.setInterval(() => {
      void pollTelegramBotLogin()
    }, 2500)

    return () => {
      active = false
      if (intervalId !== null) window.clearInterval(intervalId)
    }
  }, [callbackUrl, router, telegramBotRequestId, telegramBotStatus])

  const handleTelegramBotLogin = async () => {
    setLocalError("")

    if (!initialConfig.telegram.configured || !initialConfig.telegram.botUsername) {
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

  const handleYandexLogin = async () => {
    setLocalError("")

    if (!initialConfig.yandex.configured) {
      setLocalError("Яндекс OAuth пока не настроен на сервере.")
      return
    }

    setLoadingProvider("yandex")

    try {
      await signIn("yandex", {
        callbackUrl,
        redirect: true,
      })
    } catch {
      setLocalError("Не удалось начать вход через Яндекс.")
      setLoadingProvider(null)
    }
  }

  const handleCredentialsLogin = async (event: FormEvent<HTMLFormElement>) => {
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
        setLocalError(errorMessages[result?.error || "CredentialsSignin"] || errorMessages.CredentialsSignin)
        setLoadingProvider(null)
        return
      }

      router.replace(result.url ?? callbackUrl)
      router.refresh()
    } catch {
      setLocalError("Не удалось выполнить вход по email и паролю.")
      setLoadingProvider(null)
    }
  }

  const heroFeatures = [
    {
      title: "Один профиль",
      text: "После входа студент, преподаватель и администратор попадают в один кабинет с сохранением ролей и настроек.",
      icon: <CheckIcon className="h-4 w-4" />,
    },
    {
      title: "Три рабочих сценария",
      text: "Telegram для быстрого входа, Яндекс для OAuth и пароль для уже созданных аккаунтов.",
      icon: <ArrowIcon className="h-4 w-4" />,
    },
    {
      title: "Уведомления и доступы",
      text: "После авторизации можно сразу продолжить настройку Telegram, email и остальных каналов в профиле.",
      icon: <SparkIcon className="h-4 w-4" />,
    },
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
        <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl" />
        <div className="absolute right-[-8%] top-[14%] h-80 w-80 rounded-full bg-blue-500/16 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[35%] h-64 w-64 rounded-full bg-sky-300/16 blur-3xl" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1220] px-5 py-6 text-white shadow-[0_30px_90px_rgba(8,15,32,0.42)] sm:px-7 sm:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_30%)]" />

          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <SparkIcon className="h-3.5 w-3.5" />
                БГИТУ Афиша
              </div>

              <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-[3.2rem] lg:leading-[1.05]">
                Вход для кампусной афиши — через Telegram, Яндекс или email.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74 sm:text-base">
                Мы оставили три понятных сценария: быстрый вход через Telegram-бота, OAuth через Яндекс и парольный доступ для существующих аккаунтов.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {["Telegram bot", "Яндекс OAuth", "Email / пароль"].map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-xs font-medium text-white/80"
                  >
                    <CheckIcon className="h-3.5 w-3.5 text-cyan-200" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {heroFeatures.map((item) => (
                <FeatureCard key={item.title} title={item.title} text={item.text} icon={item.icon} />
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:p-7">
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
                3 способа входа
              </div>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-[2rem]">
              Выберите удобный вход
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary/66">
              Telegram остаётся самым быстрым способом. Яндекс и парольный вход возвращены как полноценные альтернативы.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-[1.7rem] border border-[#229ED9]/20 bg-gradient-to-br from-[#229ED9]/14 via-white to-[#229ED9]/8 p-5 text-primary shadow-[0_18px_40px_rgba(34,158,217,0.14)]">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-[0_14px_26px_rgba(34,158,217,0.3)]">
                    <TelegramIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-primary">Telegram</h3>
                      {initialConfig.telegram.botUsername && (
                        <span className="rounded-full bg-[#229ED9]/10 px-2.5 py-1 text-[11px] font-semibold text-[#229ED9]">
                          @{initialConfig.telegram.botUsername}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-primary/68">
                      Открывает бота по персональной ссылке и автоматически завершает вход после команды <span className="font-semibold text-primary">/start</span>.
                    </p>
                  </div>
                  {loadingProvider === "telegram-bot" ? (
                    <SpinnerIcon className="mt-1 h-5 w-5 text-[#229ED9]" />
                  ) : (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${initialConfig.telegram.configured ? "bg-emerald-500/12 text-emerald-700" : "bg-amber-500/12 text-amber-700"}`}>
                      {initialConfig.telegram.configured ? "готов" : "не настроен"}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTelegramBotLogin}
                  disabled={Boolean(loadingProvider) || !initialConfig.telegram.configured}
                  className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#229ED9] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(34,158,217,0.3)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingProvider === "telegram-bot" ? (
                    <SpinnerIcon className="h-4 w-4 text-white" />
                  ) : (
                    <TelegramIcon className="h-4 w-4" />
                  )}
                  {loadingProvider === "telegram-bot" ? "Ждём подтверждение в боте…" : "Открыть Telegram и войти"}
                </button>

                {telegramBotLink && telegramBotStatus === "pending" && (
                  <div className="mt-3 rounded-2xl border border-[#229ED9]/16 bg-white/70 px-3.5 py-3 text-center text-xs leading-5 text-primary/70">
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
                        {" "}· ссылка активна до{" "}
                        {new Date(telegramBotPendingUntil).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 rounded-2xl border border-primary/10 bg-white/55 px-3.5 py-3 text-xs leading-5 text-primary/66">
                  Если Telegram уже открыт, просто вернитесь на сайт через пару секунд — статус входа проверяется автоматически.
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={handleYandexLogin}
                  disabled={Boolean(loadingProvider) || !initialConfig.yandex.configured}
                  className="group rounded-[1.6rem] border border-red-500/18 bg-gradient-to-br from-white via-white to-red-50 p-5 text-left shadow-[0_18px_38px_rgba(15,23,42,0.1)] transition hover:shadow-[0_22px_42px_rgba(15,23,42,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white shadow-[0_14px_26px_rgba(239,68,68,0.22)]">
                      {loadingProvider === "yandex" ? (
                        <SpinnerIcon className="h-4 w-4 text-white" />
                      ) : (
                        <YandexIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-primary">Яндекс</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${initialConfig.yandex.configured ? "bg-primary/8 text-primary/72" : "bg-amber-500/12 text-amber-700"}`}>
                          {initialConfig.yandex.configured ? "OAuth" : "env"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-primary/66">
                        Вход через Яндекс-аккаунт для быстрого доступа к профилю, событиям и уведомлениям.
                      </p>
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        {loadingProvider === "yandex" ? "Перенаправляем…" : "Войти через Яндекс"}
                        <ArrowIcon className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </button>

                <form
                  onSubmit={handleCredentialsLogin}
                  className="rounded-[1.6rem] border border-primary/10 bg-white/80 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                      <MailIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-primary">Email и пароль</h3>
                      <p className="mt-1 text-sm leading-6 text-primary/66">
                        Для существующих аккаунтов, администраторов и пользователей, которым уже выдавали пароль.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
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
                  </div>

                  <button
                    type="submit"
                    disabled={Boolean(loadingProvider)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(29,78,216,0.22)] transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {loadingProvider === "credentials" && <SpinnerIcon className="h-4 w-4 text-white" />}
                    {loadingProvider === "credentials" ? "Проверяем…" : "Войти по паролю"}
                  </button>
                </form>
              </div>
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
