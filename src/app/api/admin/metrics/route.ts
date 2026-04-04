/**
 * File responsibility:
 * Admin metrics endpoint for dashboard analytics widgets.
 *
 * Main logic:
 * - Validate admin session access
 * - Return aggregated activity/event/user metrics
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/admin-metrics-service.ts
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { getAdminDashboardMetrics } from "@/server/admin/admin-metrics-service"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  try {
    const metrics = await getAdminDashboardMetrics()
    return NextResponse.json(metrics, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("GET /api/admin/metrics error:", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

