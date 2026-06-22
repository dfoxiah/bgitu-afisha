import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { asPrismaUserCompat, prismaUserCompat, type UserWithTelegram } from "@/lib/prisma-user-compat"
import {
  createTelegramDeepLink,
  createTelegramLinkToken,
  getTelegramBotUsername,
  isTelegramLinkingConfigured,
  isTelegramMessagingConfigured,
  maskTelegramChatId,
} from "@/lib/telegram"
import { errorJson, successJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

const TELEGRAM_LINK_PREFIX = "telegram-link:"
const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000

const getTelegramLinkIdentifier = (userId: string) => `${TELEGRAM_LINK_PREFIX}${userId}`

type TelegramLinkStatusUser = Pick<
  UserWithTelegram,
  "telegramChatId" | "telegramUsername" | "notifyTelegram"
>

type TelegramLinkRequestUser = Pick<UserWithTelegram, "id" | "name" | "telegramChatId">

type TelegramLinkExistingUser = Pick<
  UserWithTelegram,
  "id" | "telegramChatId" | "telegramUsername" | "notifyTelegram"
>

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return errorJson(401, "UNAUTHORIZED", "Не авторизован")
  }

  const [user, pendingLink] = await Promise.all([
    prismaUserCompat.findUnique<TelegramLinkStatusUser>({
      where: { id: session.user.id },
      select: {
        telegramChatId: true,
        telegramUsername: true,
        notifyTelegram: true,
      },
    }),
    prisma.verificationToken.findFirst({
      where: {
        identifier: getTelegramLinkIdentifier(session.user.id),
        expires: { gt: new Date() },
      },
      select: { expires: true },
    }),
  ])

  if (!user) {
    return errorJson(404, "NOT_FOUND", "Пользователь не найден")
  }

  return successJson({
    configured: isTelegramLinkingConfigured(),
    messagingConfigured: isTelegramMessagingConfigured(),
    botUsername: getTelegramBotUsername(),
    connected: Boolean(user.telegramChatId),
    notifyTelegram: user.notifyTelegram,
    telegramUsername: user.telegramUsername,
    telegramChatIdMasked: maskTelegramChatId(user.telegramChatId),
    pendingExpiresAt: pendingLink?.expires?.toISOString() ?? null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return errorJson(401, "UNAUTHORIZED", "Не авторизован")
  }

  if (!isTelegramLinkingConfigured()) {
    return errorJson(
      503,
      "SERVER_ERROR",
      "Telegram-бот не настроен. Заполните TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME."
    )
  }

  const user = await prismaUserCompat.findUnique<TelegramLinkRequestUser>({
    where: { id: session.user.id },
    select: { id: true, name: true, telegramChatId: true },
  })

  if (!user) {
    return errorJson(404, "NOT_FOUND", "Пользователь не найден")
  }

  const token = createTelegramLinkToken()
  const expires = new Date(Date.now() + TELEGRAM_LINK_TTL_MS)
  const identifier = getTelegramLinkIdentifier(user.id)
  const url = createTelegramDeepLink(token)

  if (!url) {
    return errorJson(503, "SERVER_ERROR", "Не удалось собрать ссылку для Telegram-бота")
  }

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: { identifier },
    }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires,
      },
    }),
  ])

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: user.id,
    action: "USER_TELEGRAM_LINK_REQUESTED",
    entityType: "User",
    entityId: user.id,
    metadata: {
      alreadyLinked: Boolean(user.telegramChatId),
      expiresAt: expires.toISOString(),
    },
    ip,
    userAgent,
  })

  return successJson({
    success: true,
    url,
    botUsername: getTelegramBotUsername(),
    expiresAt: expires.toISOString(),
  })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return errorJson(401, "UNAUTHORIZED", "Не авторизован")
  }

  const existingUser = await prismaUserCompat.findUnique<TelegramLinkExistingUser>({
    where: { id: session.user.id },
    select: { id: true, telegramChatId: true, telegramUsername: true, notifyTelegram: true },
  })

  if (!existingUser) {
    return errorJson(404, "NOT_FOUND", "Пользователь не найден")
  }

  await prisma.$transaction(async (tx) => {
    const txUser = asPrismaUserCompat(tx.user)

    await txUser.update<UserWithTelegram>({
      where: { id: existingUser.id },
      data: {
        telegramChatId: null,
        telegramUsername: null,
        notifyTelegram: false,
      },
    })

    await tx.verificationToken.deleteMany({
      where: { identifier: getTelegramLinkIdentifier(existingUser.id) },
    })
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: existingUser.id,
    action: "USER_TELEGRAM_UNLINKED",
    entityType: "User",
    entityId: existingUser.id,
    metadata: {
      hadChatId: Boolean(existingUser.telegramChatId),
      hadUsername: Boolean(existingUser.telegramUsername),
      notifyTelegram: existingUser.notifyTelegram,
    },
    ip,
    userAgent,
  })

  return successJson({
    success: true,
    connected: false,
    notifyTelegram: false,
  })
}
