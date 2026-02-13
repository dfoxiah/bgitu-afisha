/**
 * File responsibility:
 * Admin event details endpoint (get/update/delete).
 *
 * Main logic:
 * - GET: return event details with participants/report/moderators
 * - PUT: update event aggregate and related report/moderators
 * - DELETE: remove event and persist audit trail
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/admin-event-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureAdminSession } from "@/server/admin/admin-session"
import {
  deleteAdminEvent,
  getAdminEventDetails,
  updateAdminEvent,
} from "@/server/admin/admin-event-service"
import { errorJson } from "@/server/shared/http-response"
import { isServiceError } from "@/server/shared/service-error"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params
  try {
    const details = await getAdminEventDetails(id)
    return NextResponse.json(details)
  } catch (error) {
    if (isServiceError(error)) {
      return errorJson(error.status, error.code, error.message, { details: error.details })
    }
    console.error("GET /api/admin/events/[id] error:", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return errorJson(400, "BAD_REQUEST", "Неверный формат JSON")
  }

  try {
    const updated = await updateAdminEvent(id, payload, adminId, req)
    return NextResponse.json(updated)
  } catch (error) {
    if (isServiceError(error)) {
      return errorJson(error.status, error.code, error.message, { details: error.details })
    }
    console.error("PUT /api/admin/events/[id] error:", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params
  try {
    await deleteAdminEvent(id, adminId, req)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isServiceError(error)) {
      return errorJson(error.status, error.code, error.message, { details: error.details })
    }
    console.error("DELETE /api/admin/events/[id] error:", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

