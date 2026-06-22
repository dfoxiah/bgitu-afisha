import { Role } from "@prisma/client"
import { NextRequest } from "next/server"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { asPrismaUserCompat, prismaUserCompat, type UserWithTelegram } from "@/lib/prisma-user-compat"
import {
  createTelegramLinkToken,
  extractTelegramStartToken,
  getTelegramLoginCompleteIdentifier,
  getTelegramLoginCompletePrefix,
  getTelegramLoginRequestId,
  getTelegramUserIdFromLinkIdentifier,
  getTelegramWebhookSecret,
  isTelegramMessagingConfigured,
  normalizeTelegramChatId,
  normalizeTelegramUsername,
  normalizeTelegramUserId,
  sendTelegramMessage,
  TELEGRAM_LINK_PREFIX,
  TELEGRAM_LOGIN_COMPLETE_TTL_MS,
  TELEGRAM_LOGIN_PREFIX,
  type TelegramWebhookUpdate,
} from "@/lib/telegram"
import { errorJson, successJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

type TelegramWebhookUser = Pick<UserWithTelegram, "id" | "name" | "notifyTelegram" | "telegramChatId">

type TelegramBotIdentity = {
  telegramId: string
  chatId: string
  username: string | null
  firstName: string | null
  lastName: string | null
}

const toSyntheticProviderEmail = (providerAccountId: string) =>
  `telegram-${providerAccountId}@oauth.local`

const buildTelegramDisplayName = (identity: TelegramBotIdentity) =>
  [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim() ||
  identity.username ||
  "Telegram user"

const safeSendTelegramMessage = async (chatId: string, text: string) => {
  try {
    await sendTelegramMessage(chatId, text)
  } catch (error) {
    console.error("Telegram webhook reply failed", error)
  }
}

const resolveTelegramBotLoginUser = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  identity: TelegramBotIdentity
) => {
  const txUser = asPrismaUserCompat(tx.user)
  const linkedAccount = await tx.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "telegram",
        providerAccountId: identity.telegramId,
      },
    },
    select: { userId: true },
  })

  const syntheticEmail = toSyntheticProviderEmail(identity.telegramId)

  let user = linkedAccount
    ? await txUser.findUnique<UserWithTelegram>({ where: { id: linkedAccount.userId } })
    : null

  if (!user) {
    user =
      (await txUser.findUnique<UserWithTelegram>({ where: { telegramChatId: identity.chatId } })) ??
      (await txUser.findUnique<UserWithTelegram>({ where: { email: syntheticEmail } }))
  }

  if (!user) {
    user = await txUser.create<UserWithTelegram>({
      data: {
        email: syntheticEmail,
        name: buildTelegramDisplayName(identity),
        role: Role.STUDENT,
        telegramChatId: identity.chatId,
        telegramUsername: identity.username,
      },
    })
  } else {
    const updates: Record<string, unknown> = {}
    if (!user.name) updates.name = buildTelegramDisplayName(identity)
    if (!user.telegramChatId) updates.telegramChatId = identity.chatId
    if (identity.username && user.telegramUsername !== identity.username) {
      updates.telegramUsername = identity.username
    }

    if (Object.keys(updates).length > 0) {
      user = await txUser.update<UserWithTelegram>({
        where: { id: user.id },
        data: updates,
      })
    }
  }

  if (!linkedAccount) {
    await tx.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "telegram",
        providerAccountId: identity.telegramId,
      },
    })
  }

  return user
}

const handleTelegramLink = async (
  req: NextRequest,
  chatId: string,
  startToken: string,
  identifier: string,
  message: TelegramWebhookUpdate["message"]
) => {
  const userId = getTelegramUserIdFromLinkIdentifier(identifier)
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

  const telegramUsername = normalizeTelegramUsername(message?.from?.username)

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
        OR: [{ token: startToken }, { identifier }],
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

const handleTelegramBotLogin = async (
  req: NextRequest,
  chatId: string,
  startToken: string,
  identifier: string,
  message: TelegramWebhookUpdate["message"]
) => {
  const requestId = getTelegramLoginRequestId(identifier)
  const telegramId = normalizeTelegramUserId(message?.from?.id)

  if (!requestId || !telegramId) {
    await prisma.verificationToken.deleteMany({ where: { token: startToken } })
    await safeSendTelegramMessage(chatId, "Не удалось подтвердить вход. Вернитесь на сайт и начните заново.")
    return successJson({ ok: true })
  }

  const identity: TelegramBotIdentity = {
    telegramId,
    chatId,
    username: normalizeTelegramUsername(message?.from?.username),
    firstName: typeof message?.from?.first_name === "string" ? message.from.first_name.trim() || null : null,
    lastName: typeof message?.from?.last_name === "string" ? message.from.last_name.trim() || null : null,
  }

  let userId: string | null = null
  const loginToken = createTelegramLinkToken()
  const loginExpires = new Date(Date.now() + TELEGRAM_LOGIN_COMPLETE_TTL_MS)

  try {
    await prisma.$transaction(async (tx) => {
      const user = await resolveTelegramBotLoginUser(tx, identity)
      userId = user.id

      await tx.verificationToken.deleteMany({
        where: {
          OR: [
            { token: startToken },
            { identifier },
            { identifier: { startsWith: getTelegramLoginCompletePrefix(requestId) } },
          ],
        },
      })

      await tx.verificationToken.create({
        data: {
          identifier: getTelegramLoginCompleteIdentifier(requestId, user.id),
          token: loginToken,
          expires: loginExpires,
        },
      })
    })
  } catch (error) {
    console.error("Telegram bot login flow failed", error)
    await safeSendTelegramMessage(chatId, "Не удалось завершить вход. Вернитесь на сайт и попробуйте ещё раз.")
    return successJson({ ok: true })
  }

  if (userId) {
    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: userId,
      action: "AUTH_TELEGRAM_BOT_LOGIN_CONFIRMED",
      entityType: "User",
      entityId: userId,
      metadata: {
        telegramChatId: chatId,
        telegramUsername: identity.username,
        requestId,
      },
      ip,
      userAgent,
    })
  }

  await safeSendTelegramMessage(
    chatId,
    "Вход подтверждён. Вернитесь в браузер: сайт автоматически завершит авторизацию."
  )

  return successJson({ ok: true })
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
        "Для входа откройте страницу логина на сайте, а для уведомлений — профиль и кнопку «Привязать Telegram». После новой ссылки вернитесь в этого бота."
      )
    }
    return successJson({ ok: true })
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: startToken },
    select: {
      identifier: true,
      token: true,
      expires: true,
    },
  })

  if (
    !verificationToken ||
    verificationToken.expires <= new Date() ||
    (!verificationToken.identifier.startsWith(TELEGRAM_LINK_PREFIX) &&
      !verificationToken.identifier.startsWith(TELEGRAM_LOGIN_PREFIX))
  ) {
    await safeSendTelegramMessage(
      chatId,
      "Ссылка для Telegram истекла или уже использована. Вернитесь на сайт и создайте новую."
    )
    return successJson({ ok: true })
  }

  if (verificationToken.identifier.startsWith(TELEGRAM_LINK_PREFIX)) {
    return handleTelegramLink(req, chatId, startToken, verificationToken.identifier, message)
  }

  return handleTelegramBotLogin(req, chatId, startToken, verificationToken.identifier, message)
}
