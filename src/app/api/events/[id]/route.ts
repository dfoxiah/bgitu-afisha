/**
 * File responsibility:
 * Event details API endpoint (get + update).
 *
 * Main logic:
 * - GET: return event with participants/report/moderators
 * - PUT: validate access and delegate update workflow to domain service
 *
 * Integrations:
 * - src/server/events/* domain services
 * - src/server/shared/* guards/helpers
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { Role } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { findEventByIdForRead } from "@/server/events/event-query-service"
import { serializeEventForApi, updateEventFromApi } from "@/server/events/event-mutation-service"
import { applyParticipantVisibility } from "@/server/events/participant-visibility"
import { updateEventBodySchema } from "@/server/shared/schemas/event-api-schema"
import { errorJson } from "@/server/shared/http-response"
import { isServiceError } from "@/server/shared/service-error"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    const event = await findEventByIdForRead(id)

    if (!event) {
      return errorJson(404, "NOT_FOUND", "Мероприятие не найдено")
    }

    return NextResponse.json(
      applyParticipantVisibility(
        serializeEventForApi(event) as unknown as Record<string, unknown>,
        session?.user
      )
    )
  } catch (error) {
    console.error("GET /api/events/[id] error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
      return errorJson(403, "FORBIDDEN", "Недостаточно прав")
    }

    const { id: eventId } = await params

    let bodyRaw: unknown
    try {
      bodyRaw = await req.json()
    } catch {
      return errorJson(400, "BAD_REQUEST", "Неверный формат JSON")
    }

    const parsedBody = updateEventBodySchema.safeParse(bodyRaw)
    if (!parsedBody.success) {
      return errorJson(400, "VALIDATION_ERROR", "Ошибка валидации параметров обновления", {
        details: parsedBody.error.flatten(),
      })
    }

    const updated = await updateEventFromApi({
      eventId,
      body: parsedBody.data,
      actor: {
        id: session.user.id,
        role: session.user.role as Role,
        email: session.user.email,
        name: session.user.name,
      },
      req,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PUT /api/events/[id] error", error)

    if (isServiceError(error)) {
      return errorJson(error.status, error.code, error.message, { details: error.details })
    }

    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
