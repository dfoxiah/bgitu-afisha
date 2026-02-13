/**
 * File responsibility:
 * Participant moderation API for an event.
 *
 * Main logic:
 * - Confirm/reject participant requests by teacher/admin moderators
 * - Keep participant counters, notifications and audit logs consistent
 *
 * Integrations:
 * - Event card moderation UI
 * - src/server/shared/session.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { NotificationType, ParticipantStatus } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { revalidateEventsCache } from "@/server/events/event-cache"
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

    const bodyRaw: unknown = await req.json()
    if (!bodyRaw || typeof bodyRaw !== "object") {
      return errorJson(400, "BAD_REQUEST", "Некорректное тело запроса")
    }

    const body = bodyRaw as Record<string, unknown>
    const userId = String(body.userId || "").trim()
    const action = String(body.action || "").trim()

    if (!userId || (action !== "confirm" && action !== "reject")) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректные данные")
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        date: true,
        time: true,
        maxParticipants: true,
        currentParticipants: true,
        creatorId: true,
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
      return errorJson(403, "FORBIDDEN", "Недостаточно прав для модерации")
    }

    const participant = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })

    if (!participant) {
      return errorJson(404, "NOT_FOUND", "Участник не найден")
    }

    const notifyTarget = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifyChanges: true },
    })
    const shouldNotify = notifyTarget?.notifyChanges ?? true

    const prevStatus = participant.status
    let nextStatus: ParticipantStatus | "REMOVED" = prevStatus
    let delta = 0

    if (action === "confirm") {
      if (prevStatus !== ParticipantStatus.CONFIRMED) {
        if (event.maxParticipants > 0 && event.currentParticipants >= event.maxParticipants) {
          return errorJson(400, "VALIDATION_ERROR", "Достигнут лимит участников")
        }

        nextStatus = ParticipantStatus.CONFIRMED
        delta = 1
      }
    } else {
      nextStatus = "REMOVED"
      if (prevStatus === ParticipantStatus.CONFIRMED) {
        delta = -1
      }
    }

    await prisma.$transaction(async (tx) => {
      if (action === "confirm" && prevStatus !== ParticipantStatus.CONFIRMED) {
        await tx.eventParticipant.update({
          where: { eventId_userId: { eventId, userId } },
          data: { status: ParticipantStatus.CONFIRMED },
        })
      }

      if (action === "reject") {
        await tx.eventParticipant.delete({
          where: { eventId_userId: { eventId, userId } },
        })
      }

      if (delta !== 0) {
        await tx.event.update({
          where: { id: eventId },
          data: { currentParticipants: { increment: delta } },
        })
      }

      if (shouldNotify) {
        const title = action === "confirm" ? "Участие подтверждено" : "Заявка отклонена"
        const content =
          action === "confirm"
            ? `Ваше участие в мероприятии «${event.title}» подтверждено. Дата: ${new Date(
                event.date
              ).toLocaleDateString("ru-RU")} ${event.time || ""}`
            : `Ваша заявка на участие в мероприятии «${event.title}» отклонена.`

        await tx.notification.create({
          data: {
            userId,
            title,
            content,
            type: NotificationType.CHANGE,
            read: false,
            metadata: {
              eventId,
              action,
              approvedBy: session.user.email || session.user.name,
            },
          },
        })
      }
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: action === "confirm" ? "EVENT_PARTICIPANT_CONFIRM" : "EVENT_PARTICIPANT_REJECT",
      entityType: "EventParticipant",
      entityId: `${eventId}:${userId}`,
      metadata: { eventId, participantId: userId, prevStatus, nextStatus },
      ip,
      userAgent,
    })

    revalidateEventsCache()

    return NextResponse.json({
      success: true,
      userId,
      eventId,
      prevStatus,
      nextStatus,
      currentParticipants: event.currentParticipants + delta,
    })
  } catch (error) {
    console.error("POST /api/events/[id]/participants error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
