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

export const dynamic = "force-dynamic"

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
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
    const recipients = String(body.recipients || "all")
    const type = (body.type as NotificationType) || "EVENT"
    const groups = parseStringList(body.groups)
    const departments = parseStringList(body.departments)

    const validRecipients = new Set(["all", "confirmed", "pending"])
    if (!validRecipients.has(recipients)) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректное значение recipients")
    }

    if (!eventId || !content) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректные данные")
    }

    if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
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

    const canModerate = canModerateEventByRole({
      role: session.user.role,
      userId: session.user.id,
      creatorId: event.creatorId,
      moderatorIds: event.moderators.map((moderator) => moderator.userId),
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

    const baseIds =
      recipients === "confirmed"
        ? confirmedIds
        : recipients === "pending"
          ? pendingIds
          : [...confirmedIds, ...pendingIds]

    const scopeIds = Array.from(new Set([...baseIds, event.creatorId]))
    let targetIds = scopeIds

    if (groups.length > 0 || departments.length > 0) {
      const structureFilters: Prisma.UserWhereInput[] = []
      if (groups.length > 0) {
        structureFilters.push({ group: { in: groups } })
      }
      if (departments.length > 0) {
        structureFilters.push({ department: { in: departments } })
      }

      const users = await prisma.user.findMany({
        where: {
          id: { in: scopeIds },
          AND: [{ OR: structureFilters }],
        },
        select: { id: true },
      })
      targetIds = users.map((user) => user.id)
    }

    const notificationsData = Array.from(new Set(targetIds)).map((userId) => ({
      userId,
      title: "Уведомление о мероприятии",
      content,
      type,
      read: false,
      metadata: {
        eventId,
        recipients,
        groups,
        departments,
        sentBy: session.user.name || session.user.email || "Система",
      },
    }))

    if (notificationsData.length === 0) {
      return NextResponse.json({ created: 0 })
    }

    const result = await prisma.notification.createMany({ data: notificationsData })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_NOTIFY",
      entityType: "Event",
      entityId: eventId,
      metadata: { recipients, groups, departments, count: result.count },
      ip,
      userAgent,
    })

    return NextResponse.json({ created: result.count })
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
