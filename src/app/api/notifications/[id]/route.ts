/**
 * File responsibility:
 * Notification details endpoint for current user.
 *
 * Main logic:
 * - Mark one notification as read with ownership check
 *
 * Integrations:
 * - src/components/ui/NotificationBell.tsx
 * - src/app/notifications/page.tsx
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const { id } = await params
    const notification = await prisma.notification.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!notification) {
      return errorJson(404, "NOT_FOUND", "Уведомление не найдено")
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: "NOTIFICATION_READ",
      entityType: "Notification",
      entityId: id,
      metadata: { read: true },
      ip,
      userAgent,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
