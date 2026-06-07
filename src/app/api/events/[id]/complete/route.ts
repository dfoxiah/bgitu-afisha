/**
 * File responsibility:
 * Event completion API endpoint.
 *
 * Main logic:
 * - Finalize event by creating report and setting `isPast`
 * - Validate moderation rights and emit audit logs
 *
 * Integrations:
 * - Complete event modal
 * - src/server/shared/session.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { NotificationType, Role } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { revalidateEventsCache } from "@/server/events/event-cache"
import { flattenModerators, serializeReport, splitEventParticipants } from "@/server/events/event-serializer"
import { canModerateEventByRole } from "@/server/shared/session"
import { errorJson } from "@/server/shared/http-response"
import { isContentManagerRole } from "@/lib/roles"
import { buildEventLink, createNotifications } from "@/server/notifications/notification-service"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    if (!isContentManagerRole(session.user.role)) {
      return errorJson(403, "FORBIDDEN", "Недостаточно прав")
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        report: true,
        moderators: { select: { userId: true } },
        eventParticipants: {
          where: { status: "CONFIRMED" },
          select: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
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
      permission: "events.complete",
    })

    if (!canModerate) {
      return errorJson(403, "FORBIDDEN", "Недостаточно прав для завершения мероприятия")
    }

    if (event.report) {
      return errorJson(400, "CONFLICT", "Мероприятие уже завершено")
    }

    let bodyRaw: unknown = {}
    try {
      bodyRaw = await req.json()
    } catch {
      bodyRaw = {}
    }

    const body = bodyRaw && typeof bodyRaw === "object" ? (bodyRaw as Record<string, unknown>) : {}
    const summary = typeof body.summary === "string" ? body.summary.trim() : ""
    const participantNames = event.eventParticipants
      .map((participant) => participant.user.name || participant.user.email)
      .filter(Boolean)
    const draftSummary =
      summary ||
      [
        `Мероприятие «${event.title}» завершено.`,
        `Дата проведения: ${new Date(event.date).toLocaleDateString("ru-RU")} ${event.time || ""}.`,
        `Участников по списку: ${event.currentParticipants}.`,
        "Черновик создан автоматически и требует проверки перед публикацией.",
      ].join("\n")

    const tasks = Array.isArray(body.tasks)
      ? body.tasks.map((task) => String(task).trim()).filter(Boolean)
      : []
    const activeParticipants = Array.isArray(body.activeParticipants)
      ? body.activeParticipants.map((item) => String(item)).filter(Boolean)
      : participantNames
    const images = Array.isArray(body.images)
      ? body.images.map((item) => String(item)).filter(Boolean)
      : []

    let reportDate = new Date()
    if (body.reportDate !== undefined && body.reportDate !== null && String(body.reportDate).trim()) {
      const parsedReportDate = new Date(String(body.reportDate))
      if (Number.isNaN(parsedReportDate.getTime())) {
        return errorJson(400, "VALIDATION_ERROR", "Некорректная дата отчета")
      }
      reportDate = parsedReportDate
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        isPast: true,
        completedAt: new Date(),
        report: {
          create: {
            summary: draftSummary,
            tasks,
            activeParticipants,
            images,
            reportDate,
            status: "DRAFT",
          },
        },
      },
      include: {
        report: true,
        eventParticipants: {
          select: {
            status: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                group: true,
                image: true,
                createdAt: true,
              },
            },
          },
        },
        creator: true,
        moderators: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                group: true,
                image: true,
              },
            },
          },
        },
      },
    })

    const { confirmed, pending } = splitEventParticipants(updated.eventParticipants)

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_COMPLETE",
      entityType: "Event",
      entityId: updated.id,
      metadata: {
        summaryLength: summary.length,
        autoDraft: !summary,
        tasksCount: tasks.length,
        imagesCount: images.length,
      },
      ip,
      userAgent,
    })

    revalidateEventsCache()

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true },
      take: 50,
    })
    const notificationRecipientIds = Array.from(
      new Set([
        updated.creatorId,
        ...updated.moderators.map((moderator) => moderator.user.id),
        ...admins.map((admin) => admin.id),
      ].filter(Boolean))
    )

    await createNotifications(
      notificationRecipientIds
        .filter((userId) => userId !== session.user.id)
        .map((userId) => ({
          userId,
          title: "Создан черновик отчета",
          content: `Мероприятие «${updated.title}» завершено. Сформирован черновик отчета, его нужно проверить перед публикацией.`,
          type: NotificationType.REPORT_DRAFT_CREATED,
          link: buildEventLink(updated.id),
          metadata: {
            eventId: updated.id,
            reportId: updated.report?.id,
            action: "report_draft_created",
          },
        }))
    )

    return NextResponse.json({
      ...updated,
      currentParticipants: confirmed.length,
      participants: confirmed,
      pendingParticipants: pending,
      moderators: flattenModerators(updated.moderators),
      date: updated.date.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      report: serializeReport(updated.report),
    })
  } catch (error) {
    console.error("POST /api/events/[id]/complete error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
