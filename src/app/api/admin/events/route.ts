/**
 * File responsibility:
 * Admin events collection endpoint (list + news creation).
 *
 * Main logic:
 * - GET: list events/news with admin filters
 * - POST: create news material as an event entry with optional report
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/admin-event-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { createAdminNews, listAdminEvents } from "@/server/admin/admin-event-service"
import { adminEventsQuerySchema } from "@/server/shared/schemas/admin-api-schema"
import { errorJson } from "@/server/shared/http-response"
import { isServiceError } from "@/server/shared/service-error"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { searchParams } = new URL(req.url)
  const parsedQuery = adminEventsQuerySchema.safeParse({
    search: searchParams.get("search"),
    category: searchParams.get("category"),
    upcoming: searchParams.get("upcoming"),
    past: searchParams.get("past"),
    news: searchParams.get("news"),
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  })

  if (!parsedQuery.success) {
    return errorJson(400, "VALIDATION_ERROR", "Некорректные параметры фильтра", {
      details: parsedQuery.error.flatten(),
    })
  }

  const events = await listAdminEvents(parsedQuery.data)
  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return errorJson(400, "BAD_REQUEST", "Неверный формат JSON")
  }

  try {
    const created = await createAdminNews(adminId, payload, req)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (isServiceError(error)) {
      return errorJson(error.status, error.code, error.message, { details: error.details })
    }
    console.error("POST /api/admin/events error:", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
