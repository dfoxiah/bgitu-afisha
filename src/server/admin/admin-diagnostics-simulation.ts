/**
 * File responsibility:
 * Admin dry-run simulations for real user-facing scenarios.
 *
 * Main logic:
 * - Inspect public feed visibility and registration readiness.
 * - Check Telegram login readiness.
 * - Verify notification delivery coverage by enabled channels.
 *
 * Integrations:
 * - src/app/api/admin/diagnostics/simulate/route.ts
 * - src/app/admin/page.tsx
 */

import { ParticipantStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { prismaUserCompat } from "@/lib/prisma-user-compat"
import {
  createTelegramDeepLink,
  getTelegramBotUsername,
  getTelegramWebhookSecret,
  isTelegramLinkingConfigured,
  isTelegramMessagingConfigured,
} from "@/lib/telegram"
import { ADMIN_SIMULATION_SCENARIOS } from "@/features/admin/simulation-catalog"
import type {
  AdminSimulationResponse,
  AdminSimulationResult,
  AdminSimulationScenarioId,
} from "@/features/admin/types"
import { isEmailDeliveryConfigured } from "@/server/notifications/email-delivery"

type ScenarioPayload = Pick<AdminSimulationResult, "status" | "summary" | "details">

type UserNotificationSnapshot = {
  email: string
  vkUserId: string | null
  telegramChatId: string | null
  notifyInApp: boolean
  notifyEmail: boolean
  notifyVk: boolean
  notifyTelegram: boolean
}

const formatDateTime = (value: Date) =>
  value.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const scenarioMeta = new Map(ADMIN_SIMULATION_SCENARIOS.map((scenario) => [scenario.id, scenario]))

const hasNonEmptyValue = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0

const runPublicFeedScenario = async (): Promise<ScenarioPayload> => {
  const [publicTotal, upcomingTotal, upcomingEvents] = await Promise.all([
    prisma.event.count({
      where: { isPublic: true, removedFromCalendar: false, isNews: false },
    }),
    prisma.event.count({
      where: { isPublic: true, removedFromCalendar: false, isPast: false, isNews: false },
    }),
    prisma.event.findMany({
      where: { isPublic: true, removedFromCalendar: false, isPast: false, isNews: false },
      orderBy: [{ date: "asc" }],
      take: 3,
      select: {
        title: true,
        date: true,
        location: true,
        category: true,
      },
    }),
  ])

  if (publicTotal === 0) {
    return {
      status: "warning",
      summary: "В публичной афише пока нет опубликованных мероприятий.",
      details: [
        "Проверьте, что мероприятия отмечены как публичные и не сняты с календаря.",
      ],
    }
  }

  if (upcomingTotal === 0) {
    return {
      status: "warning",
      summary: "Публичная афиша доступна, но ближайших мероприятий сейчас нет.",
      details: [
        `Опубликованных мероприятий: ${publicTotal}.`,
        "Добавьте или актуализируйте даты будущих событий, чтобы витрина не выглядела пустой.",
      ],
    }
  }

  return {
    status: "ok",
    summary: `Публичная витрина заполнена: ближайших мероприятий ${upcomingTotal}.`,
    details: [
      `Всего публичных мероприятий: ${publicTotal}.`,
      ...upcomingEvents.map(
        (event) =>
          `${formatDateTime(event.date)} · ${event.title} · ${event.location} · ${event.category}`
      ),
    ],
  }
}

const runRegistrationFlowScenario = async (): Promise<ScenarioPayload> => {
  const event = await prisma.event.findFirst({
    where: { isPublic: true, removedFromCalendar: false, isPast: false, isNews: false },
    orderBy: [{ date: "asc" }],
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      maxParticipants: true,
      currentParticipants: true,
      requiresApproval: true,
    },
  })

  if (!event) {
    return {
      status: "warning",
      summary: "Сценарий регистрации проверить не на чем: нет ближайших публичных событий.",
      details: [
        "Создайте хотя бы одно будущее публичное мероприятие, чтобы проверить путь записи пользователя.",
      ],
    }
  }

  const [confirmedParticipants, pendingParticipants] = await Promise.all([
    prisma.eventParticipant.count({
      where: { eventId: event.id, status: ParticipantStatus.CONFIRMED },
    }),
    prisma.eventParticipant.count({
      where: { eventId: event.id, status: ParticipantStatus.PENDING },
    }),
  ])

  const occupiedSlots = Math.max(event.currentParticipants, confirmedParticipants)
  const freeSlots = Math.max(event.maxParticipants - occupiedSlots, 0)

  if (freeSlots === 0) {
    return {
      status: "warning",
      summary: `Ближайшее публичное событие «${event.title}» уже заполнено.`,
      details: [
        `${formatDateTime(event.date)} · ${event.location}.`,
        `Лимит мест: ${event.maxParticipants}, занято: ${occupiedSlots}, ожидают подтверждения: ${pendingParticipants}.`,
        event.requiresApproval
          ? "Модерация включена, но свободных мест для новых заявок уже нет."
          : "Регистрация проходит без модерации, но свободных мест уже нет.",
      ],
    }
  }

  return {
    status: "ok",
    summary: `Запись доступна: у «${event.title}» осталось ${freeSlots} мест.`,
    details: [
      `${formatDateTime(event.date)} · ${event.location}.`,
      `Лимит мест: ${event.maxParticipants}, занято: ${occupiedSlots}, ожидают подтверждения: ${pendingParticipants}.`,
      event.requiresApproval
        ? "Модерация включена: новая заявка попадет в ожидание подтверждения."
        : "Модерация выключена: подтверждение будет моментальным.",
    ],
  }
}

const runTelegramAuthScenario = async (): Promise<ScenarioPayload> => {
  const botUsername = getTelegramBotUsername()
  const deepLink = createTelegramDeepLink("admin_diag_check")
  const webhookSecret = getTelegramWebhookSecret()
  const [linkedUsers, linkingConfigured, messagingConfigured] = await Promise.all([
    prismaUserCompat
      .findMany<Pick<UserNotificationSnapshot, "telegramChatId">>({
        select: { telegramChatId: true },
      })
      .then((users) => users.filter((user) => hasNonEmptyValue(user.telegramChatId)).length),
    Promise.resolve(isTelegramLinkingConfigured()),
    Promise.resolve(isTelegramMessagingConfigured()),
  ])

  if (!linkingConfigured) {
    return {
      status: "error",
      summary: "Telegram-вход не готов: не хватает токена бота или username.",
      details: [
        `Бот: ${botUsername ? `@${botUsername}` : "не указан"}.`,
        `Deep-link: ${deepLink ? "создается" : "недоступен"}.`,
        `Webhook secret: ${webhookSecret ? "задан" : "не задан"}.`,
      ],
    }
  }

  if (linkedUsers === 0) {
    return {
      status: "warning",
      summary: "Telegram-вход настроен, но пока нет пользователей с привязанным chat id.",
      details: [
        `Бот: @${botUsername}.`,
        `Deep-link: ${deepLink || "недоступен"}.`,
        `Отправка сообщений: ${messagingConfigured ? "включена" : "выключена"}.`,
        `Webhook secret: ${webhookSecret ? "задан" : "не задан"}.`,
      ],
    }
  }

  return {
    status: "ok",
    summary: `Telegram-вход готов, привязано пользователей: ${linkedUsers}.`,
    details: [
      `Бот: @${botUsername}.`,
      `Deep-link: ${deepLink || "недоступен"}.`,
      `Отправка сообщений: ${messagingConfigured ? "включена" : "выключена"}.`,
      `Webhook secret: ${webhookSecret ? "задан" : "не задан"}.`,
    ],
  }
}

const runNotificationDeliveryScenario = async (): Promise<ScenarioPayload> => {
  const emailConfigured = isEmailDeliveryConfigured()
  const vkConfigured = Boolean(process.env.VK_GROUP_TOKEN)
  const telegramConfigured = isTelegramMessagingConfigured()

  const users = await prismaUserCompat.findMany<UserNotificationSnapshot>({
    select: {
      email: true,
      vkUserId: true,
      telegramChatId: true,
      notifyInApp: true,
      notifyEmail: true,
      notifyVk: true,
      notifyTelegram: true,
    },
  })

  const inAppEnabled = users.filter((user) => user.notifyInApp).length
  const emailEnabled = users.filter((user) => user.notifyEmail).length
  const emailDeliverable = emailConfigured
    ? users.filter((user) => user.notifyEmail && hasNonEmptyValue(user.email)).length
    : 0
  const vkEnabled = users.filter((user) => user.notifyVk).length
  const vkDeliverable = vkConfigured
    ? users.filter((user) => user.notifyVk && hasNonEmptyValue(user.vkUserId)).length
    : 0
  const telegramEnabled = users.filter((user) => user.notifyTelegram).length
  const telegramDeliverable = telegramConfigured
    ? users.filter(
        (user) => user.notifyTelegram && hasNonEmptyValue(user.telegramChatId)
      ).length
    : 0

  const blockers: string[] = []
  if (emailEnabled > emailDeliverable) blockers.push("email")
  if (vkEnabled > vkDeliverable) blockers.push("VK")
  if (telegramEnabled > telegramDeliverable) blockers.push("Telegram")

  const externalEnabled = emailEnabled + vkEnabled + telegramEnabled

  if (externalEnabled > 0 && emailDeliverable + vkDeliverable + telegramDeliverable === 0) {
    return {
      status: "error",
      summary: "Внешние уведомления включены у пользователей, но сейчас ни один внешний канал не доставит сообщение.",
      details: [
        `In-app включено: ${inAppEnabled}.`,
        `Email: ${emailDeliverable} из ${emailEnabled} (${emailConfigured ? "канал настроен" : "канал не настроен"}).`,
        `VK: ${vkDeliverable} из ${vkEnabled} (${vkConfigured ? "канал настроен" : "канал не настроен"}).`,
        `Telegram: ${telegramDeliverable} из ${telegramEnabled} (${telegramConfigured ? "канал настроен" : "канал не настроен"}).`,
      ],
    }
  }

  if (blockers.length > 0) {
    return {
      status: "warning",
      summary: `Часть внешних уведомлений не будет доставлена: ${blockers.join(", ")}.`,
      details: [
        `In-app включено: ${inAppEnabled}.`,
        `Email: ${emailDeliverable} из ${emailEnabled} (${emailConfigured ? "канал настроен" : "канал не настроен"}).`,
        `VK: ${vkDeliverable} из ${vkEnabled} (${vkConfigured ? "канал настроен" : "канал не настроен"}).`,
        `Telegram: ${telegramDeliverable} из ${telegramEnabled} (${telegramConfigured ? "канал настроен" : "канал не настроен"}).`,
      ],
    }
  }

  if (externalEnabled === 0) {
    return {
      status: "warning",
      summary: "Пользователи пока не включили внешние уведомления: работает только внутренняя лента.",
      details: [
        `In-app включено: ${inAppEnabled}.`,
        "Включите email, VK или Telegram в профилях пользователей, чтобы проверить внешнюю рассылку.",
      ],
    }
  }

  return {
    status: "ok",
    summary: "Каналы уведомлений готовы: включенные внешние подписки можно доставить.",
    details: [
      `In-app включено: ${inAppEnabled}.`,
      `Email: ${emailDeliverable} из ${emailEnabled}.`,
      `VK: ${vkDeliverable} из ${vkEnabled}.`,
      `Telegram: ${telegramDeliverable} из ${telegramEnabled}.`,
    ],
  }
}

const scenarioHandlers: Record<AdminSimulationScenarioId, () => Promise<ScenarioPayload>> = {
  "public-feed": runPublicFeedScenario,
  "registration-flow": runRegistrationFlowScenario,
  "telegram-auth": runTelegramAuthScenario,
  "notification-delivery": runNotificationDeliveryScenario,
}

const runScenario = async (
  scenarioId: AdminSimulationScenarioId
): Promise<AdminSimulationResult> => {
  const scenario = scenarioMeta.get(scenarioId)
  const startedAt = Date.now()

  if (!scenario) {
    return {
      scenarioId,
      label: scenarioId,
      status: "error",
      summary: "Сценарий не найден.",
      details: ["Проверьте каталог симуляций админки."],
      durationMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    }
  }

  try {
    const result = await scenarioHandlers[scenarioId]()
    return {
      scenarioId,
      label: scenario.label,
      status: result.status,
      summary: result.summary,
      details: result.details,
      durationMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      scenarioId,
      label: scenario.label,
      status: "error",
      summary: "Сценарий завершился с ошибкой.",
      details: [
        error instanceof Error ? error.message : "Неизвестная ошибка.",
        "Проверьте логи сервера и конфигурацию окружения.",
      ],
      durationMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    }
  }
}

export const runAdminDiagnosticsSimulation = async (
  requestedScenario: AdminSimulationScenarioId | "all" = "all"
): Promise<AdminSimulationResponse> => {
  const scenarioIds =
    requestedScenario === "all"
      ? ADMIN_SIMULATION_SCENARIOS.map((scenario) => scenario.id)
      : [requestedScenario]

  const results = await Promise.all(scenarioIds.map((scenarioId) => runScenario(scenarioId)))

  return {
    generatedAt: new Date().toISOString(),
    requestedScenario,
    results,
  }
}
