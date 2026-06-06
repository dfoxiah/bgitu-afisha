/**
 * File responsibility:
 * Broadcast notification cancellation endpoint.
 *
 * Main logic:
 * - Delete previously sent notification batch for all recipients
 * - Enforce teacher/admin + moderation/sender access checks
 *
 * Integrations:
 * - src/features/notifications/client/notifications-api.ts
 * - src/components/ui/NotificationModal.tsx
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { canModerateEventByRole } from "@/server/shared/session"
import { errorJson } from "@/server/shared/http-response"
import { isAdminRole, isContentManagerRole } from "@/lib/roles"

type RouteParams = {
  params: Promise<{ broadcastId: string }>
}

const getMetadataString = (value: unknown, key: string) => {
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  const raw = record[key]
  return typeof raw === "string" ? raw.trim() : ""
}

const buildBroadcastWhere = (broadcastId: string): Prisma.NotificationWhereInput => ({
  metadata: {
    path: ["broadcastId"],
    equals: broadcastId,
  },
})

export const dynamic = "force-dynamic"

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    if (!isContentManagerRole(session.user.role)) {
      return errorJson(403, "FORBIDDEN", "Недостаточно прав")
    }

    const { broadcastId } = await params
    const normalizedBroadcastId = String(broadcastId || "").trim()
    if (!normalizedBroadcastId) {
      return errorJson(400, "VALIDATION_ERROR", "Не указан идентификатор рассылки")
    }

    const sample = await prisma.notification.findFirst({
      where: buildBroadcastWhere(normalizedBroadcastId),
      select: {
        metadata: true,
      },
    })

    if (!sample) {
      return errorJson(404, "NOT_FOUND", "Рассылка не найдена")
    }

    const eventId = getMetadataString(sample.metadata, "eventId")
    const sentById = getMetadataString(sample.metadata, "sentById")

    if (!eventId) {
      return errorJson(400, "VALIDATION_ERROR", "Невозможно определить мероприятие рассылки")
    }

    if (!isAdminRole(session.user.role)) {
      if (sentById && sentById !== session.user.id) {
        return errorJson(403, "FORBIDDEN", "Можно отменять только свои рассылки")
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          creatorId: true,
          moderators: { select: { userId: true } },
        },
      })

      if (!event) {
        return errorJson(404, "NOT_FOUND", "Мероприятие рассылки не найдено")
      }

      const canModerate = canModerateEventByRole({
        role: session.user.role,
        userId: session.user.id,
        creatorId: event.creatorId,
        moderatorIds: event.moderators.map((moderator) => moderator.userId),
        permission: "events.manageParticipants",
      })

      if (!canModerate) {
        return errorJson(403, "FORBIDDEN", "Недостаточно прав для отмены рассылки")
      }
    }

    const deleteResult = await prisma.notification.deleteMany({
      where: buildBroadcastWhere(normalizedBroadcastId),
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "EVENT_NOTIFY_CANCEL",
      entityType: "Event",
      entityId: eventId,
      metadata: {
        broadcastId: normalizedBroadcastId,
        deleted: deleteResult.count,
      },
      ip,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      broadcastId: normalizedBroadcastId,
      eventId,
      deleted: deleteResult.count,
    })
  } catch (error) {
    console.error("DELETE /api/notifications/broadcast/[broadcastId] error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
