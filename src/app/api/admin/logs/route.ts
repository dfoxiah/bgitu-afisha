/**
 * File responsibility:
 * Admin audit logs list endpoint.
 *
 * Main logic:
 * - Return paginated audit log records with optional filters
 * - Enforce no-store cache for sensitive admin data
 *
 * Integrations:
 * - src/app/admin/page.tsx (logs tab)
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureAdminSession } from "@/server/admin/admin-session"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!ensureAdminSession(session)) {
      return NextResponse.json(
        { error: "Недостаточно прав", code: "FORBIDDEN" },
        {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      })
    }

    const { searchParams } = new URL(req.url)
    const actorId = searchParams.get("actorId")?.trim() || undefined
    const entityType = searchParams.get("entityType")?.trim() || undefined
    const action = searchParams.get("action")?.trim() || undefined
    const limit = Number(searchParams.get("limit") || 50)
    const offset = Number(searchParams.get("offset") || 0)

    const where: Record<string, unknown> = {}
    if (actorId) where.actorId = actorId
    if (entityType) where.entityType = entityType
    if (action) where.action = action

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      skip: Math.max(offset, 0),
    })

    return NextResponse.json(logs, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("GET /api/admin/logs error", error)
    return NextResponse.json(
      { error: "Ошибка сервера", code: "SERVER_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
