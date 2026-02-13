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
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { revalidateEventsCache } from "@/server/events/event-cache"
import { flattenModerators, serializeReport, splitEventParticipants } from "@/server/events/event-serializer"
import { canModerateEventByRole } from "@/server/shared/session"
import { errorJson } from "@/server/shared/http-response"

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

    if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
      return errorJson(403, "FORBIDDEN", "Недостаточно прав")
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        report: true,
        moderators: { select: { userId: true } },
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
      return errorJson(403, "FORBIDDEN", "Недостаточно прав для завершения мероприятия")
    }

    if (event.report) {
      return errorJson(400, "CONFLICT", "Мероприятие уже завершено")
    }

    const bodyRaw: unknown = await req.json()
    if (!bodyRaw || typeof bodyRaw !== "object") {
      return errorJson(400, "BAD_REQUEST", "Некорректное тело запроса")
    }

    const body = bodyRaw as Record<string, unknown>
    const summary = typeof body.summary === "string" ? body.summary.trim() : ""
    if (!summary) {
      return errorJson(400, "VALIDATION_ERROR", "Заполните описание мероприятия")
    }

    const tasks = Array.isArray(body.tasks)
      ? body.tasks.map((task) => String(task).trim()).filter(Boolean)
      : []
    const activeParticipants = Array.isArray(body.activeParticipants)
      ? body.activeParticipants.map((item) => String(item)).filter(Boolean)
      : []
    const images = Array.isArray(body.images)
      ? body.images.map((item) => String(item)).filter(Boolean)
      : []

    const reportDate = body.reportDate ? new Date(String(body.reportDate)) : new Date()

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        isPast: true,
        report: {
          create: {
            summary,
            tasks,
            activeParticipants,
            images,
            reportDate,
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
        tasksCount: tasks.length,
        imagesCount: images.length,
      },
      ip,
      userAgent,
    })

    revalidateEventsCache()

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
