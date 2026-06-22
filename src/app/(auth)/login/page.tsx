/**
 * File responsibility:
 * Bot-first sign-in page.
 *
 * Main logic:
 * - Start Telegram bot login flow.
 * - Poll server for completed Telegram login token.
 * - Redirect authenticated users to dashboard or profile completion.
 *
 * Integrations:
 * - src/app/api/auth/telegram/config/route.ts
 * - src/app/api/auth/telegram/login/route.ts
 * - src/lib/auth.ts
 */
"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { isProfileComplete } from "@/lib/profile-completion"

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

type IconProps = {
  className?: string
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

const CheckIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path d="m5 10.5 3.1 3.1L15 6.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  <article className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-cyan-100">
      {icon}
    </div>
    <p className="mt-3 text-sm font-semibold text-white">{title}</p>
    <p className="mt-1 text-sm leading-6 text-white/70">{text}</p>
  </article>
)

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"))
  const { data: session, status } = useSession()

  const [telegramConfig, setTelegramConfig] = useState<TelegramLoginConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState("")
  const [telegramBotRequestId, setTelegramBotRequestId] = useState<string | null>(null)
  const [telegramBotLink, setTelegramBotLink] = useState<string | null>(null)
  const [telegramBotPendingUntil, setTelegramBotPendingUntil] = useState<string | null>(null)
  const [telegramBotStatus, setTelegramBotStatus] = useState<"idle" | "pending" | "ready" | "expired">("idle")

  const displayedError = useMemo(() => localError.trim(), [localError])

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return
    router.replace(isProfileComplete(session.user) ? callbackUrl : "/profile/complete")
  }, [callbackUrl, router, session, status])

  useEffect(() => {
    let active = true

    const loadTelegramConfig = async () => {
      const response = await fetch("/api/auth/telegram/config", {
        method: "GET",
        cache: "no-store",
      }).catch(() => null)

      if (!active) return

      if (!response?.ok) {
        setTelegramConfig({ configured: false, botUsername: null })
        return
      }

      const payload = (await response.json()) as TelegramLoginConfig
      if (!active) return
      setTelegramConfig(payload)
    }

    void loadTelegramConfig()
    return () => {
      active = false
    }
  }, [])

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
        setLocalError(await toTelegramApiError(response, "Не удалось проверить статус входа через Telegram-бота."))
        setLoading(false)
        return
      }

      const payload = (await response.json()) as TelegramBotLoginStatusResponse
      if (!active) return

      if (payload.status === "expired") {
        setTelegramBotStatus("expired")
        setTelegramBotPendingUntil(null)
        setLoading(false)
        setLocalError("Ссылка для входа истекла. Нажмите кнопку ещё раз.")
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
          setLocalError("Не удалось завершить вход через Telegram-бота.")
          setLoading(false)
          return
        }

        router.replace(result.url ?? callbackUrl)
        router.refresh()
      } catch {
        if (!active) return
        setLocalError("Не удалось завершить вход через Telegram-бота.")
        setLoading(false)
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

    if (!telegramConfig?.configured || !telegramConfig.botUsername) {
      setLocalError("Telegram-бот для входа пока не настроен на сервере.")
      return
    }

    setLoading(true)
    setTelegramBotStatus("pending")

    try {
      const response = await fetch("/api/auth/telegram/login", {
        method: "POST",
      })

      if (!response.ok) {
        setTelegramBotStatus("idle")
        setLoading(false)
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
      setLoading(false)
      setLocalError("Не удалось открыть Telegram-бота для входа.")
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
    <div className="page-shell relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl" />
        <div className="absolute right-[-8%] top-[14%] h-80 w-80 rounded-full bg-blue-500/16 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[35%] h-64 w-64 rounded-full bg-sky-300/16 blur-3xl" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.06fr_0.94fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1220] px-5 py-6 text-white shadow-[0_30px_90px_rgba(8,15,32,0.42)] sm:px-7 sm:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_30%)]" />

          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <TelegramIcon className="h-3.5 w-3.5" />
                Bot-only login
              </div>

              <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-[3.2rem] lg:leading-[1.05]">
                Вход в БГИТУ Афишу теперь идёт только через Telegram-бота.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74 sm:text-base">
                Без OAuth, без пароля и без лишних кнопок. Открываете бота, нажимаете <span className="font-semibold text-white">Start</span> и
                возвращаетесь на сайт — профиль, уведомления и доступы подтянутся автоматически.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {[
                  "Один способ входа",
                  "Привязка Telegram сразу",
                  "Уведомления включаются в профиле",
                ].map((item) => (
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
              <FeatureCard
                icon={<TelegramIcon className="h-4 w-4" />}
                title="Быстрый сценарий"
                text="Кнопка открывает бота сразу на нужной deep-link ссылке. Код вручную вводить не нужно."
              />
              <FeatureCard
                icon={<CheckIcon className="h-4 w-4" />}
                title="Профиль после входа"
                text="Если аккаунт новый, после первого входа откроется заполнение профиля без потери Telegram-привязки."
              />
              <FeatureCard
                icon={<ArrowIcon className="h-4 w-4" />}
                title="Уведомления дальше"
                text="После авторизации в профиле можно включить уведомления в Telegram, VK, внутри сайта и по email."
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,158,217,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(29,78,216,0.06),transparent_36%)]" />

          <div className="relative">
            <div className="mb-7 flex items-center gap-3">
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

            <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-[2rem]">
              Войти через Telegram-бота
            </h2>
            <p className="mt-3 text-sm leading-6 text-primary/66">
              Нажмите кнопку ниже. Откроется бот{telegramConfig?.botUsername ? ` @${telegramConfig.botUsername}` : ""}, где нужно нажать
              <span className="font-semibold text-primary"> Start</span>. После подтверждения сайт войдёт автоматически.
            </p>

            <div className="mt-6 rounded-[1.6rem] border border-[#229ED9]/20 bg-gradient-to-br from-[#229ED9]/14 via-white to-[#229ED9]/8 p-5 text-primary shadow-[0_18px_40px_rgba(34,158,217,0.14)]">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-[0_14px_26px_rgba(34,158,217,0.3)]">
                  <TelegramIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-primary">Telegram-бот</h3>
                    {telegramConfig?.botUsername && (
                      <span className="rounded-full bg-[#229ED9]/10 px-2.5 py-1 text-[11px] font-semibold text-[#229ED9]">
                        @{telegramConfig.botUsername}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-primary/68">
                    Только один путь входа: бот открывается по персональной ссылке и возвращает вас в аккаунт после команды <span className="font-semibold text-primary">/start</span>.
                  </p>
                </div>
                {loading ? (
                  <SpinnerIcon className="mt-1 h-5 w-5 text-[#229ED9]" />
                ) : (
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${telegramConfig?.configured ? 'bg-emerald-500/12 text-emerald-700' : 'bg-amber-500/12 text-amber-700'}`}>
                    {telegramConfig?.configured ? 'готов' : 'не настроен'}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleTelegramBotLogin}
                disabled={loading || !telegramConfig?.configured}
                className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#229ED9] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(34,158,217,0.3)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <SpinnerIcon className="h-4 w-4 text-white" /> : <TelegramIcon className="h-4 w-4" />}
                {loading ? "Ждём подтверждение в боте…" : "Открыть бота и войти"}
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

              <div className="mt-4 rounded-2xl border border-primary/10 bg-white/55 px-3.5 py-3 text-xs leading-5 text-primary/68">
                Если вы уже открыли бота, но сайт ещё ждёт вход — просто вернитесь сюда и подождите пару секунд. Проверка статуса идёт автоматически.
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                "1. Нажмите кнопку входа",
                "2. Откройте Telegram-бота",
                "3. Нажмите Start и вернитесь на сайт",
              ].map((step) => (
                <div key={step} className="rounded-2xl border border-primary/10 bg-white/72 px-4 py-3 text-sm text-primary/72">
                  {step}
                </div>
              ))}
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
