/**
 * File responsibility:
 * Profile stats endpoint for the current authenticated user.
 *
 * Main logic:
 * - Validate active session and resolve user
 * - Return aggregated role-aware profile statistics
 *
 * Integrations:
 * - src/app/profile/page.tsx
 * - src/server/auth/profile-stats-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildProfileStats } from "@/server/auth/profile-stats-service"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return errorJson(404, "NOT_FOUND", "Пользователь не найден")
    }

    const stats = await buildProfileStats(user)
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("GET /api/auth/profile/stats error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

