/**
 * File responsibility:
 * Profile API endpoint for current authenticated user.
 *
 * Main logic:
 * - GET: return normalized profile payload
 * - PUT: validate and update profile fields/preferences
 *
 * Integrations:
 * - src/app/profile/page.tsx
 * - src/server/auth/profile-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { EventCategory } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { buildProfileUpdates, toProfileResponse } from "@/server/auth/profile-service"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return errorJson(404, "NOT_FOUND", "Пользователь не найден")
    }

    return NextResponse.json(toProfileResponse(user))
  } catch (error) {
    console.error("GET /api/auth/profile error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return errorJson(401, "UNAUTHORIZED", "Не авторизован")
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return errorJson(404, "NOT_FOUND", "Пользователь не найден")
    }

    let bodyRaw: unknown
    try {
      bodyRaw = await req.json()
    } catch {
      return errorJson(400, "BAD_REQUEST", "Неверный формат JSON")
    }

    if (!bodyRaw || typeof bodyRaw !== "object") {
      return errorJson(400, "BAD_REQUEST", "Тело запроса должно быть объектом")
    }

    const { updates, validationError } = buildProfileUpdates({
      body: bodyRaw as Record<string, unknown>,
      user,
      role: session.user.role,
      validCategories: Object.values(EventCategory),
    })

    if (validationError) {
      return errorJson(403, "FORBIDDEN", validationError)
    }

    if (Object.keys(updates).length === 0) {
      return errorJson(400, "BAD_REQUEST", "Нет данных для обновления")
    }

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: updatedUser.id,
      action: "USER_PROFILE_UPDATE",
      entityType: "User",
      entityId: updatedUser.id,
      metadata: { updatedFields: Object.keys(updates) },
      ip,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      message: "Профиль обновлен",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        image: updatedUser.image,
        department: updatedUser.department,
        group: updatedUser.group,
        admissionYear: updatedUser.admissionYear,
        groupChangeCount: updatedUser.groupChangeCount,
        bio: updatedUser.bio,
        notifyNewEvents: updatedUser.notifyNewEvents,
        notifyChanges: updatedUser.notifyChanges,
        notifyNews: updatedUser.notifyNews,
        notifyInApp: updatedUser.notifyInApp,
        notifyEmail: updatedUser.notifyEmail,
        notifyVk: updatedUser.notifyVk,
        notificationCategories: updatedUser.notificationCategories,
        vkUserId: updatedUser.vkUserId,
        yandexEmail: updatedUser.yandexEmail,
        privacyConsentAt: updatedUser.privacyConsentAt,
        privacyConsentVersion: updatedUser.privacyConsentVersion,
        termsConsentAt: updatedUser.termsConsentAt,
        termsConsentVersion: updatedUser.termsConsentVersion,
        profileCompletedAt: updatedUser.profileCompletedAt,
      },
    })
  } catch (error) {
    console.error("PUT /api/auth/profile error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
