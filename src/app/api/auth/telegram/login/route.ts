import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  createTelegramDeepLink,
  createTelegramLinkToken,
  createTelegramRequestId,
  getTelegramBotUsername,
  getTelegramLoginCompletePrefix,
  getTelegramLoginIdentifier,
  isTelegramLinkingConfigured,
  TELEGRAM_LOGIN_TTL_MS,
} from "@/lib/telegram"
import { errorJson, successJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId")?.trim() || ""

  if (!requestId) {
    return errorJson(400, "BAD_REQUEST", "Не указан requestId Telegram-входа")
  }

  const now = new Date()
  const [pendingRequest, completedRequest] = await Promise.all([
    prisma.verificationToken.findFirst({
      where: {
        identifier: getTelegramLoginIdentifier(requestId),
        expires: { gt: now },
      },
      select: { expires: true },
    }),
    prisma.verificationToken.findFirst({
      where: {
        identifier: { startsWith: getTelegramLoginCompletePrefix(requestId) },
        expires: { gt: now },
      },
      select: { token: true, expires: true },
    }),
  ])

  if (completedRequest) {
    return successJson({
      configured: isTelegramLinkingConfigured(),
      botUsername: getTelegramBotUsername(),
      status: "ready" as const,
      loginToken: completedRequest.token,
      expiresAt: completedRequest.expires.toISOString(),
    })
  }

  if (pendingRequest) {
    return successJson({
      configured: isTelegramLinkingConfigured(),
      botUsername: getTelegramBotUsername(),
      status: "pending" as const,
      expiresAt: pendingRequest.expires.toISOString(),
    })
  }

  return successJson({
    configured: isTelegramLinkingConfigured(),
    botUsername: getTelegramBotUsername(),
    status: "expired" as const,
    expiresAt: null,
  })
}

export async function POST() {
  if (!isTelegramLinkingConfigured()) {
    return errorJson(
      503,
      "SERVER_ERROR",
      "Telegram-бот не настроен. Заполните TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME."
    )
  }

  const requestId = createTelegramRequestId()
  const token = createTelegramLinkToken()
  const expires = new Date(Date.now() + TELEGRAM_LOGIN_TTL_MS)
  const url = createTelegramDeepLink(token)

  if (!url) {
    return errorJson(503, "SERVER_ERROR", "Не удалось собрать ссылку для Telegram-бота")
  }

  await prisma.verificationToken.create({
    data: {
      identifier: getTelegramLoginIdentifier(requestId),
      token,
      expires,
    },
  })

  return successJson({
    success: true,
    requestId,
    url,
    botUsername: getTelegramBotUsername(),
    expiresAt: expires.toISOString(),
  })
}
