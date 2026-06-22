import { NextRequest } from "next/server"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { asPrismaUserCompat, prismaUserCompat, type UserWithTelegram } from "@/lib/prisma-user-compat"
import {
  extractTelegramStartToken,
  getTelegramWebhookSecret,
  isTelegramMessagingConfigured,
  normalizeTelegramChatId,
  normalizeTelegramUsername,
  sendTelegramMessage,
  type TelegramWebhookUpdate,
} from "@/lib/telegram"
import { errorJson, successJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

const TELEGRAM_LINK_PREFIX = "telegram-link:"

const getUserIdFromIdentifier = (identifier: string) =>
  identifier.startsWith(TELEGRAM_LINK_PREFIX)
    ? identifier.slice(TELEGRAM_LINK_PREFIX.length)
    : null

type TelegramWebhookUser = Pick<UserWithTelegram, "id" | "name" | "notifyTelegram" | "telegramChatId">

const safeSendTelegramMessage = async (chatId: string, text: string) => {
  try {
    await sendTelegramMessage(chatId, text)
  } catch (error) {
    console.error("Telegram webhook reply failed", error)
  }
}

export async function POST(req: NextRequest) {
  if (!isTelegramMessagingConfigured()) {
    return errorJson(503, "SERVER_ERROR", "Telegram-бот не настроен")
  }

  const expectedSecret = getTelegramWebhookSecret()
  if (expectedSecret) {
    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token")
    if (receivedSecret !== expectedSecret) {
      return errorJson(401, "UNAUTHORIZED", "Неверный Telegram webhook secret")
    }
  }

  let update: TelegramWebhookUpdate
  try {
    update = (await req.json()) as TelegramWebhookUpdate
  } catch {
    return errorJson(400, "BAD_REQUEST", "Неверный формат JSON")
  }

  const message = update.message
  const chatId = normalizeTelegramChatId(message?.chat?.id)
  const startToken = extractTelegramStartToken(message?.text)

  if (!message || !chatId) {
    return successJson({ ok: true })
  }

  if (!startToken) {
    if (String(message.text || "").trim().startsWith("/start")) {
      await safeSendTelegramMessage(
        chatId,
        "Для привязки Telegram откройте профиль на сайте, нажмите «Привязать Telegram» и вернитесь в бот по новой ссылке."
      )
    }
    return successJson({ ok: true })
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: startToken },
  })

  if (
    !verificationToken ||
    verificationToken.expires <= new Date() ||
    !verificationToken.identifier.startsWith(TELEGRAM_LINK_PREFIX)
  ) {
    await safeSendTelegramMessage(
      chatId,
      "Ссылка для привязки Telegram истекла или уже использована. Вернитесь на сайт и создайте новую."
    )
    return successJson({ ok: true })
  }

  const userId = getUserIdFromIdentifier(verificationToken.identifier)
  if (!userId) {
    await prisma.verificationToken.deleteMany({ where: { token: startToken } })
    await safeSendTelegramMessage(chatId, "Не удалось определить профиль для привязки. Попробуйте снова.")
    return successJson({ ok: true })
  }

  const [user, conflictingUser] = await Promise.all([
    prismaUserCompat.findUnique<TelegramWebhookUser>({
      where: { id: userId },
      select: { id: true, name: true, notifyTelegram: true, telegramChatId: true },
    }),
    prismaUserCompat.findFirst<{ id: string }>({
      where: {
        telegramChatId: chatId,
        id: { not: userId },
      },
      select: { id: true },
    }),
  ])

  if (!user) {
    await prisma.verificationToken.deleteMany({ where: { token: startToken } })
    await safeSendTelegramMessage(chatId, "Профиль на сайте не найден. Сформируйте новую ссылку в профиле.")
    return successJson({ ok: true })
  }

  if (conflictingUser) {
    await prisma.verificationToken.deleteMany({ where: { token: startToken } })
    await safeSendTelegramMessage(
      chatId,
      "Этот Telegram уже привязан к другому аккаунту сайта. Сначала отвяжите его в старом профиле."
    )
    return successJson({ ok: true })
  }

  const telegramUsername = normalizeTelegramUsername(message.from?.username)

  await prisma.$transaction(async (tx) => {
    const txUser = asPrismaUserCompat(tx.user)

    await txUser.update<UserWithTelegram>({
      where: { id: user.id },
      data: {
        telegramChatId: chatId,
        telegramUsername,
      },
    })

    await tx.verificationToken.deleteMany({
      where: {
        OR: [
          { token: startToken },
          { identifier: verificationToken.identifier },
        ],
      },
    })
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: user.id,
    action: "USER_TELEGRAM_LINKED",
    entityType: "User",
    entityId: user.id,
    metadata: {
      telegramChatId: chatId,
      telegramUsername,
      previouslyLinked: Boolean(user.telegramChatId),
    },
    ip,
    userAgent,
  })

  await safeSendTelegramMessage(
    chatId,
    `Telegram успешно привязан к профилю${user.name ? ` ${user.name}` : ""}. Теперь включите уведомления в настройках профиля на сайте.`
  )

  return successJson({ ok: true })
}
