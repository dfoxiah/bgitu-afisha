import { randomBytes } from "crypto"

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? ""
const telegramBotUsername = (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@+/, "").trim()
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ""

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

export const getTelegramWebhookSecret = () => telegramWebhookSecret || null

export const createTelegramLinkToken = () => `tg_${randomBytes(18).toString("base64url")}`

export const createTelegramDeepLink = (token: string) => {
  if (!telegramBotUsername) return null
  return `https://t.me/${telegramBotUsername}?start=${encodeURIComponent(token)}`
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
