/**
 * File responsibility:
 * Notifications collection endpoint for current user.
 *
 * Main logic:
 * - GET list, PATCH mark-all-read, DELETE clear-all
 * - POST event notification broadcast for moderators
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - src/components/ui/NotificationModal.tsx
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { NotificationType } from "@prisma/client"
import type { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { canModerateEventByRole } from "@/server/shared/session"
import { errorJson } from "@/server/shared/http-response"
import { canManageDirectoryNotifications, isContentManagerRole } from "@/lib/roles"
import { buildEventLink, createNotifications } from "@/server/notifications/notification-service"

export const dynamic = "force-dynamic"

const broadcastNotificationTypes = new Set<NotificationType>(["EVENT", "CHANGE"])

const parseStringList = (value: unknown) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item).trim())
          .filter(Boolean)
      )
    )
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[,\n;|]/g)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    )
  }

  return [] as string[]
}

const parseEventTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return 0
  const match = value.trim().match(/(\d{1,2}):(\d{2})/)
  if (!match) return 0
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return 0
  return hh * 60 + mm
}

const toEventDateTime = (date: Date, time: string | null | undefined) => {
  const result = new Date(date)
  const minutes = parseEventTimeToMinutes(time)
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return result
}

const renderNotificationContent = (
  template: string,
  event: { title: string; date: Date; time: string | null }
) => {
  const eventDate = event.date.toLocaleDateString("ru-RU")
  const eventTime = event.time?.trim() || "[Время]"

  return template
    .replace(/\[Название мероприятия\]/gi, event.title)
    .replace(/\[Название\]/gi, event.title)
    .replace(/\[Дата\]/gi, eventDate)
    .replace(/\[Время\]/gi, eventTime)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const { searchParams } = new URL(req.url)
    const rawLimit = searchParams.get("limit")
    const parsedLimit = rawLimit ? Number(rawLimit) : NaN
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.trunc(parsedLimit), 500) : 120

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json(notifications)
  } catch (error) {
    console.error("GET /api/notifications error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const bodyRaw: unknown = await req.json()
    if (!bodyRaw || typeof bodyRaw !== "object") {
      return errorJson(400, "BAD_REQUEST", "Некорректное тело запроса")
    }

    const body = bodyRaw as Record<string, unknown>
    const eventId = String(body.eventId || "").trim()
    const content = String(body.content || "").trim()
    const audience = String(body.audience || "participants")
    const recipients = String(body.recipients || "all")
    const rawType = typeof body.type === "string" ? body.type.trim().toUpperCase() : "EVENT"
    const type = (rawType || "EVENT") as NotificationType
    const broadcastId = globalThis.crypto.randomUUID()
    const groups = parseStringList(body.groups)
    const userIds = parseStringList(body.userIds)
    const departments = Array.from(
      new Set([...parseStringList(body.departments), ...parseStringList(body.faculties)])
    )

    const validRecipients = new Set(["all", "confirmed", "pending"])
    if (!validRecipients.has(recipients)) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректное значение recipients")
    }
    if (!["participants", "users"].includes(audience)) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректная область рассылки")
    }

    if (!broadcastNotificationTypes.has(type)) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректный тип уведомления")
    }

    if (audience === "users" && !canManageDirectoryNotifications(session.user.role)) {
      return errorJson(
        403,
        "FORBIDDEN",
        "Рассылка по базе пользователей доступна только редакторам и администраторам"
      )
    }

    if (!eventId || !content) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректные данные")
    }

    if (!isContentManagerRole(session.user.role)) {
      return errorJson(403, "FORBIDDEN", "Недостаточно прав")
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        moderators: { select: { userId: true } },
        eventParticipants: { select: { status: true, userId: true } },
      },
    })

    if (!event) {
      return errorJson(404, "NOT_FOUND", "Мероприятие не найдено")
    }

    const now = new Date()
    const eventDateTime = toEventDateTime(event.date, event.time)
    if (event.isPast || eventDateTime.getTime() < now.getTime()) {
      return errorJson(
        400,
        "VALIDATION_ERROR",
        "Нельзя отправлять уведомления по прошедшим мероприятиям"
      )
    }

    const canModerate = canModerateEventByRole({
      role: session.user.role,
      userId: session.user.id,
      creatorId: event.creatorId,
      moderatorIds: event.moderators.map((moderator) => moderator.userId),
      permission: "events.manageParticipants",
    })

    if (!canModerate) {
      return errorJson(403, "FORBIDDEN", "Недостаточно прав для рассылки уведомлений")
    }

    const confirmedIds = event.eventParticipants
      .filter((participant) => participant.status === "CONFIRMED")
      .map((participant) => participant.userId)
    const pendingIds = event.eventParticipants
      .filter((participant) => participant.status === "PENDING")
      .map((participant) => participant.userId)

    const participantBaseIds =
      recipients === "confirmed"
        ? confirmedIds
        : recipients === "pending"
          ? pendingIds
          : [...confirmedIds, ...pendingIds]

    const scopeIds = Array.from(new Set(participantBaseIds))
    let targetIds = scopeIds

    if (audience === "users") {
      if (groups.length === 0 && departments.length === 0 && userIds.length === 0) {
        return errorJson(
          400,
          "VALIDATION_ERROR",
          "Для рассылки по базе пользователей выберите конкретных людей, группы или кафедры"
        )
      }

      const userWhere: Prisma.UserWhereInput = {}
      if (userIds.length > 0) userWhere.id = { in: userIds }
      if (groups.length > 0) userWhere.group = { in: groups }
      if (departments.length > 0) userWhere.department = { in: departments }

      const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true },
        take: 1000,
      })
      targetIds = users.map((user) => user.id)
    } else if (groups.length > 0 || departments.length > 0 || userIds.length > 0) {
      const userWhere: Prisma.UserWhereInput = {
        id: { in: scopeIds },
      }
      if (userIds.length > 0) {
        userWhere.id = { in: scopeIds.filter((id) => userIds.includes(id)) }
      }
      if (groups.length > 0) {
        userWhere.group = { in: groups }
      }
      if (departments.length > 0) {
        userWhere.department = { in: departments }
      }
      const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true },
      })
      targetIds = users.map((user) => user.id)
    }

    const renderedContent = renderNotificationContent(content, {
      title: event.title,
      date: event.date,
      time: event.time,
    })

    const notificationsData = Array.from(new Set(targetIds)).map((userId) => ({
      userId,
      title: "Уведомление о мероприятии",
      content: renderedContent,
      type,
      link: buildEventLink(eventId),
      read: false,
      metadata: {
        broadcastId,
        eventId,
        audience,
        recipients,
        groups,
        userIds,
        departments,
        faculties: departments,
        sentById: session.user.id,
        sentBy: session.user.name || session.user.email || "Система",
        sentAt: new Date().toISOString(),
      },
    }))

    if (notificationsData.length === 0) {
      return NextResponse.json({
        created: 0,
        inAppCreated: 0,
        externalAttempted: 0,
        externalFailed: 0,
        broadcastId,
        eventId,
        filters: { audience, groups, departments, userIds },
      })
    }

    const result = await createNotifications(notificationsData)

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_NOTIFY",
      entityType: "Event",
      entityId: eventId,
      metadata: {
        recipients,
        audience,
        groups,
        userIds,
        departments,
        count: result.targetedUsers,
        inAppCreated: result.count,
        externalAttempted: result.externalAttempted,
        externalFailed: result.externalFailed,
        baseScopeCount: scopeIds.length,
      },
      ip,
      userAgent,
    })

    return NextResponse.json({
      created: result.targetedUsers,
      inAppCreated: result.count,
      externalAttempted: result.externalAttempted,
      externalFailed: result.externalFailed,
      broadcastId,
      eventId,
      filters: { audience, groups, departments, userIds },
    })
  } catch (error) {
    console.error("POST /api/notifications error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    await prisma.notification.deleteMany({
      where: { userId: session.user.id },
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "NOTIFICATIONS_CLEAR",
      entityType: "Notification",
      entityId: session.user.id,
      metadata: { scope: "self" },
      ip,
      userAgent,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/notifications error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "NOTIFICATIONS_MARK_READ",
      entityType: "Notification",
      entityId: session.user.id,
      metadata: { updated: result.count },
      ip,
      userAgent,
    })

    return NextResponse.json({ success: true, updated: result.count })
  } catch (error) {
    console.error("PATCH /api/notifications error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
