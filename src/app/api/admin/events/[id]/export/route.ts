/**
 * File responsibility:
 * Admin event attendance Excel export endpoint.
 *
 * Main logic:
 * - Validate admin session access
 * - Generate XLSX workbook for selected event attendees and metadata
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/admin-metrics-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { buildEventAttendanceExcel } from "@/server/admin/admin-metrics-service"
import { errorJson } from "@/server/shared/http-response"
import { isServiceError } from "@/server/shared/service-error"

type RouteParams = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params

  try {
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

