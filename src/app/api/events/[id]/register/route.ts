/**
 * File responsibility:
 * Event registration API endpoint.
 *
 * Main logic:
 * - Register current user in event as confirmed/pending by role
 * - Enforce event availability and participant limits
 *
 * Integrations:
 * - Event details page registration button
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ParticipantStatus } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { revalidateEventsCache } from "@/server/events/event-cache"
import { errorJson } from "@/server/shared/http-response"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const { id: eventId } = await params
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        isPast: true,
        date: true,
        maxParticipants: true,
        currentParticipants: true,
      },
    })

    if (!event) {
      return errorJson(404, "NOT_FOUND", "Мероприятие не найдено")
    }

    if (event.isPast || new Date(event.date) < new Date()) {
      return errorJson(400, "CONFLICT", "Мероприятие уже завершено")
    }

    if (event.maxParticipants > 0 && event.currentParticipants >= event.maxParticipants) {
      return errorJson(400, "CONFLICT", "Достигнуто максимальное количество участников")
    }

    const existing = await prisma.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: session.user.id,
        },
      },
    })

    if (existing) {
      return errorJson(400, "CONFLICT", "Вы уже зарегистрированы на это мероприятие")
    }

    const isPrivileged = session.user.role === "TEACHER" || session.user.role === "ADMIN"
    const status = isPrivileged ? ParticipantStatus.CONFIRMED : ParticipantStatus.PENDING

    await prisma.$transaction(async (tx) => {
      await tx.eventParticipant.create({
        data: {
          eventId,
          userId: session.user.id,
          status,
        },
      })

      if (status === ParticipantStatus.CONFIRMED) {
        await tx.event.update({
          where: { id: eventId },
          data: { currentParticipants: { increment: 1 } },
        })
      }
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_REGISTER",
      entityType: "Event",
      entityId: eventId,
      metadata: { status },
      ip,
      userAgent,
    })

    revalidateEventsCache()

    return NextResponse.json({
      success: true,
      status,
      message:
        status === ParticipantStatus.CONFIRMED
          ? "Вы успешно зарегистрированы на мероприятие"
          : "Заявка отправлена, ожидайте подтверждения",
    })
  } catch (error) {
    console.error("POST /api/events/[id]/register error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
