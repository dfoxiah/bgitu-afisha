/**
 * File responsibility:
 * Admin metrics endpoint for dashboard analytics widgets.
 *
 * Main logic:
 * - Validate admin session access
 * - Parse optional period filter (from/to)
 * - Return aggregated activity/event/user metrics
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/admin-metrics-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { getAdminDashboardMetrics } from "@/server/admin/admin-metrics-service"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

const parseDateParam = (value: string | null, endOfDay = false) => {
  if (!value) return null
  const normalized = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  const date = new Date(`${normalized}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  try {
    const { searchParams } = new URL(req.url)
    const fromRaw = searchParams.get("from")
    const toRaw = searchParams.get("to")
    const from = parseDateParam(fromRaw, false)
    const to = parseDateParam(toRaw, true)

    if (fromRaw && !from) {
      return errorJson(400, "VALIDATION_ERROR", "Параметр from должен быть в формате YYYY-MM-DD")
    }
    if (toRaw && !to) {
      return errorJson(400, "VALIDATION_ERROR", "Параметр to должен быть в формате YYYY-MM-DD")
    }
    if (from && to && from > to) {
      return errorJson(400, "VALIDATION_ERROR", "Дата начала периода больше даты окончания")
    }
    if (from && to) {
      const diffDays = Math.ceil((to.getTime() - from.getTime() + 1) / (24 * 60 * 60 * 1000))
      if (diffDays > 366) {
        return errorJson(400, "VALIDATION_ERROR", "Период не должен превышать 366 дней")
      }
    }

    const metrics = await getAdminDashboardMetrics({ from, to })
    return NextResponse.json(metrics, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("GET /api/admin/metrics error:", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

