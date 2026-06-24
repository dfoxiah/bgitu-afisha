import { randomBytes } from "crypto"

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? ""
const telegramBotUsername = (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@+/, "").trim()
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ""
let resolvedTelegramBotUsername: string | null | undefined = telegramBotUsername || undefined
let resolvingTelegramBotUsername: Promise<string | null> | null = null

export const TELEGRAM_LINK_PREFIX = "telegram-link:"
export const TELEGRAM_LOGIN_PREFIX = "telegram-login:"
export const TELEGRAM_LOGIN_COMPLETE_PREFIX = "telegram-login-complete:"
export const TELEGRAM_LOGIN_TTL_MS = 15 * 60 * 1000
export const TELEGRAM_LOGIN_COMPLETE_TTL_MS = 5 * 60 * 1000

export type TelegramWebhookMessage = {
  message_id?: number
  text?: string
  chat?: {
    id?: number | string
    type?: string
  }
  from?: {
    id?: number | string
    username?: string
    first_name?: string
    last_name?: string
  }
}

export type TelegramWebhookUpdate = {
  update_id?: number
  message?: TelegramWebhookMessage
}

export const isTelegramMessagingConfigured = () => Boolean(telegramBotToken)

export const isTelegramLinkingConfigured = () =>
  Boolean(telegramBotToken && telegramBotUsername)

export const getTelegramBotUsername = () => telegramBotUsername || null

const fetchTelegramBotUsername = async () => {
  if (!telegramBotToken) return null

  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getMe`, {
      method: "GET",
      cache: "no-store",
    })

    if (!response.ok) return null

    const payload = (await response.json()) as {
      ok?: boolean
      result?: {
        username?: string
      }
    }

    if (!payload.ok) return null
    return normalizeTelegramUsername(payload.result?.username)
  } catch {
    return null
  }
}

export const resolveTelegramBotUsername = async () => {
  if (telegramBotUsername) return telegramBotUsername
  if (!telegramBotToken) return null
  if (resolvedTelegramBotUsername !== undefined) return resolvedTelegramBotUsername
  if (resolvingTelegramBotUsername) return resolvingTelegramBotUsername

  resolvingTelegramBotUsername = fetchTelegramBotUsername()
    .then((username) => {
      resolvedTelegramBotUsername = username
      return username
    })
    .finally(() => {
      resolvingTelegramBotUsername = null
    })

  return resolvingTelegramBotUsername
}

export const resolveTelegramLinkingConfigured = async () =>
  Boolean(telegramBotToken && (await resolveTelegramBotUsername()))

export const getTelegramWebhookSecret = () => telegramWebhookSecret || null

export const createTelegramLinkToken = () => `tg_${randomBytes(18).toString("base64url")}`

export const createTelegramRequestId = () => `tgr_${randomBytes(18).toString("base64url")}`

export const createTelegramDeepLink = (token: string) => {
  if (!telegramBotUsername) return null
  return `https://t.me/${telegramBotUsername}?start=${encodeURIComponent(token)}`
}

export const createTelegramAppLink = (token: string) => {
  if (!telegramBotUsername) return null
  return `tg://resolve?domain=${encodeURIComponent(telegramBotUsername)}&start=${encodeURIComponent(token)}`
}

export const resolveTelegramDeepLink = async (token: string) => {
  const username = await resolveTelegramBotUsername()
  if (!username) return null
  return `https://t.me/${username}?start=${encodeURIComponent(token)}`
}

export const resolveTelegramAppLink = async (token: string) => {
  const username = await resolveTelegramBotUsername()
  if (!username) return null
  return `tg://resolve?domain=${encodeURIComponent(username)}&start=${encodeURIComponent(token)}`
}

export const extractTelegramStartToken = (text: string | undefined | null) => {
  if (!text) return null
  const match = text.trim().match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{6,128})$/)
  return match?.[1] ?? null
}

export const normalizeTelegramUsername = (value: unknown) => {
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/^@+/, "")
  return normalized.length > 0 ? normalized : null
}

export const normalizeTelegramChatId = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return /^-?\d{5,32}$/.test(normalized) ? normalized : null
}

export const normalizeTelegramUserId = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(Math.trunc(value))
  }

  if (typeof value !== "string") return null
  const normalized = value.trim()
  return /^\d{5,32}$/.test(normalized) ? normalized : null
}

export const getTelegramLinkIdentifier = (userId: string) => `${TELEGRAM_LINK_PREFIX}${userId}`

export const getTelegramUserIdFromLinkIdentifier = (identifier: string) =>
  identifier.startsWith(TELEGRAM_LINK_PREFIX)
    ? identifier.slice(TELEGRAM_LINK_PREFIX.length)
    : null

export const getTelegramLoginIdentifier = (requestId: string) =>
  `${TELEGRAM_LOGIN_PREFIX}${requestId}`

export const getTelegramLoginRequestId = (identifier: string) =>
  identifier.startsWith(TELEGRAM_LOGIN_PREFIX)
    ? identifier.slice(TELEGRAM_LOGIN_PREFIX.length)
    : null

export const getTelegramLoginCompleteIdentifier = (requestId: string, userId: string) =>
  `${TELEGRAM_LOGIN_COMPLETE_PREFIX}${requestId}:${userId}`

export const getTelegramLoginCompletePrefix = (requestId: string) =>
  `${TELEGRAM_LOGIN_COMPLETE_PREFIX}${requestId}:`

export const getTelegramUserIdFromLoginCompleteIdentifier = (identifier: string) => {
  if (!identifier.startsWith(TELEGRAM_LOGIN_COMPLETE_PREFIX)) return null
  const value = identifier.slice(TELEGRAM_LOGIN_COMPLETE_PREFIX.length)
  const separatorIndex = value.indexOf(":")
  if (separatorIndex < 0) return null
  return value.slice(separatorIndex + 1) || null
}

export const maskTelegramChatId = (chatId: string | null | undefined) => {
  if (!chatId) return null
  if (chatId.length <= 6) return chatId
  return `${chatId.slice(0, 2)}•••${chatId.slice(-2)}`
}

export const sendTelegramMessage = async (chatId: string, text: string) => {
  if (!telegramBotToken) {
    throw new Error("Telegram bot token is not configured")
  }

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    throw new Error(`Telegram API request failed: ${response.status}`)
  }

  const payload = (await response.json()) as {
    ok?: boolean
    description?: string
  }

  if (!payload.ok) {
    throw new Error(payload.description || "Telegram API request failed")
  }
}
