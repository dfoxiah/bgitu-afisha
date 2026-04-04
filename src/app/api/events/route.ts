/**
 * File responsibility:
 * Events collection API endpoint (list + create).
 *
 * Main logic:
 * - GET: filter and return events list with tagged server cache
 * - POST: validate and create event via domain orchestration service
 *
 * Integrations:
 * - src/server/events/* domain services
 * - src/server/shared/* helpers
 */

import { unstable_cache } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ParticipantStatus } from "@prisma/client"
import type { Role } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildEventListWhere, findEventsForList } from "@/server/events/event-query-service"
import { EVENTS_CACHE_TAG } from "@/server/events/event-cache"
import { createEventFromApi, serializeEventForApi } from "@/server/events/event-mutation-service"
import { createEventBodySchema } from "@/server/shared/schemas/event-api-schema"
import { errorJson } from "@/server/shared/http-response"
import { isServiceError } from "@/server/shared/service-error"

const debugLog = (...args: unknown[]) => {
  if (process.env.DEBUG_EVENTS === "true") {
    console.log(...args)
  }
}

export const dynamic = "force-dynamic"

const canViewerSeeParticipants = (role?: string | null) =>
  role === "TEACHER" || role === "ADMIN"

const applyParticipantVisibility = (
  event: Record<string, unknown>,
  viewer: { id?: string | null; role?: string | null } | null | undefined
) => {
  const confirmed = Array.isArray(event.participants)
    ? (event.participants as Array<{ id?: string }>)
    : []
  const pending = Array.isArray(event.pendingParticipants)
    ? (event.pendingParticipants as Array<{ id?: string }>)
    : []
  const viewerId = viewer?.id || null

  const viewerParticipationStatus =
    viewerId && confirmed.some((participant) => participant?.id === viewerId)
      ? ParticipantStatus.CONFIRMED
      : viewerId && pending.some((participant) => participant?.id === viewerId)
        ? ParticipantStatus.PENDING
        : null

  if (canViewerSeeParticipants(viewer?.role)) {
    return {
      ...event,
      canViewParticipants: true,
      viewerParticipationStatus,
      confirmedParticipantsCount: confirmed.length,
      pendingParticipantsCount: pending.length,
    }
  }

  return {
    ...event,
    participants: [],
    pendingParticipants: [],
    canViewParticipants: false,
    viewerParticipationStatus,
    confirmedParticipantsCount: confirmed.length,
    pendingParticipantsCount: pending.length,
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(req.url)

    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const upcoming = searchParams.get("upcoming")
    const past = searchParams.get("past")
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined

    const where = buildEventListWhere({
      category,
      search,
      upcoming,
      past,
      limit,
      includePastForAuthorized: Boolean(session?.user?.id),
    })

    debugLog("GET /api/events where", where)

    const cacheKey = [
      "events",
      session?.user?.id || "anonymous",
      category || "all",
      search || "",
      upcoming || "",
      past || "",
      String(limit || ""),
    ].join(":")

    const getCachedEvents = unstable_cache(() => findEventsForList(where, limit), [cacheKey], {
      revalidate: 5,
      tags: [EVENTS_CACHE_TAG],
    })

    const events = await getCachedEvents()
    const serialized = events
      .map((event) => serializeEventForApi(event))
      .map((event) => applyParticipantVisibility(event as unknown as Record<string, unknown>, session?.user))

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
      "X-Total-Count": String(serialized.length),
    }

    if (session?.user?.id) {
      headers["X-User-Id"] = session.user.id
      headers["X-User-Role"] = session.user.role
    }

    return NextResponse.json(serialized, { headers })
  } catch (error) {
    console.error("GET /api/events error", error)
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
      return errorJson(
        403,
        "FORBIDDEN",
        "Недостаточно прав. Только преподаватели и администраторы могут создавать мероприятия."
      )
    }

    let bodyRaw: unknown
    try {
      bodyRaw = await req.json()
    } catch {
      return errorJson(400, "BAD_REQUEST", "Неверный формат JSON")
    }

    const parsedBody = createEventBodySchema.safeParse(bodyRaw)
    if (!parsedBody.success) {
      return errorJson(400, "VALIDATION_ERROR", "Заполните обязательные поля", {
        details: parsedBody.error.flatten(),
      })
    }

    const created = await createEventFromApi({
      dto: parsedBody.data,
      actor: {
        id: session.user.id,
        role: session.user.role as Role,
        email: session.user.email,
        name: session.user.name,
      },
      req,
    })

    return NextResponse.json(created.serialized, {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        Location: `/api/events/${created.createdId}`,
        "X-Event-Id": created.createdId,
      },
    })
  } catch (error) {
    console.error("POST /api/events error", error)

    if (isServiceError(error)) {
      return errorJson(error.status, error.code, error.message, { details: error.details })
    }

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return errorJson(409, "CONFLICT", "Мероприятие с таким названием уже существует")
    }

    if (error instanceof Error && error.message.includes("Foreign key constraint")) {
      return errorJson(400, "BAD_REQUEST", "Неверный идентификатор создателя")
    }

    return errorJson(500, "SERVER_ERROR", "Ошибка сервера при создании мероприятия", {
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    })
  }
}
