/**
 * File responsibility:
 * Event attendance Excel export endpoint.
 *
 * Main logic:
 * - Validate teacher/admin session access
 * - Enforce moderation permissions for non-admin users
 * - Generate XLSX workbook for selected event attendees and active participants
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/admin-metrics-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildEventAttendanceExcel } from "@/server/admin/admin-metrics-service"
import { canModerateEventByRole } from "@/server/shared/session"
import { errorJson } from "@/server/shared/http-response"
import { isServiceError } from "@/server/shared/service-error"
import { isAdminRole, isContentManagerRole } from "@/lib/roles"

type RouteParams = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return errorJson(401, "UNAUTHORIZED", "Не авторизован")
  }

  if (!isContentManagerRole(session.user.role)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params

  try {
    if (!isAdminRole(session.user.role)) {
      const event = await prisma.event.findUnique({
        where: { id },
        select: {
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
        return errorJson(403, "FORBIDDEN", "Недостаточно прав для выгрузки")
      }
    }

    const { fileName, buffer } = await buildEventAttendanceExcel(id)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (isServiceError(error)) {
      return errorJson(error.status, error.code, error.message, {
        details: error.details,
      })
    }
    console.error("GET /api/admin/events/[id]/export error:", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
