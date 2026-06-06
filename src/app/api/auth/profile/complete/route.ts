/**
 * File responsibility:
 * Required profile completion endpoint for first OAuth sign-in.
 *
 * Main logic:
 * - Validate required profile and consent fields.
 * - Save latest legal consent versions and profile completion timestamp.
 *
 * Integrations:
 * - src/app/profile/complete/page.tsx
 * - NextAuth OAuth callbacks
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ConsentType } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import {
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
  getProfileCompletionIssues,
} from "@/lib/profile-completion"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase()

const normalizeAdmissionYear = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === "") return null
  const year = Number(value)
  const currentYear = new Date().getFullYear()
  return Number.isInteger(year) && year >= 1990 && year <= currentYear + 1 ? year : null
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return errorJson(401, "UNAUTHORIZED", "Не авторизован")
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

  const body = bodyRaw as Record<string, unknown>
  const name = String(body.name || "").trim()
  const email = normalizeEmail(body.email)
  const department = String(body.department || "").trim()
  const group = String(body.group || "").trim()
  const admissionYear = normalizeAdmissionYear(body.admissionYear)
  const acceptPrivacy = Boolean(body.acceptPrivacy)
  const acceptTerms = Boolean(body.acceptTerms)
  const vkUserId = String(body.vkUserId || "").trim()

  if (!isValidEmail(email)) {
    return errorJson(400, "VALIDATION_ERROR", "Укажите корректный email")
  }

  if (!acceptPrivacy || !acceptTerms) {
    return errorJson(400, "VALIDATION_ERROR", "Необходимо принять политику и соглашение")
  }

  const existingEmailOwner = await prisma.user.findFirst({
    where: {
      email,
      id: { not: session.user.id },
    },
    select: { id: true },
  })

  if (existingEmailOwner) {
    return errorJson(409, "CONFLICT", "Этот email уже привязан к другому аккаунту")
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      accounts: {
        select: { provider: true },
      },
    },
  })

  if (!currentUser) {
    return errorJson(404, "NOT_FOUND", "Пользователь не найден")
  }

  const consentSource = currentUser.accounts.map((account) => account.provider).join(",") || "profile"
  const now = new Date()
  const candidate = {
    ...currentUser,
    name,
    email,
    department,
    group,
    admissionYear,
    privacyConsentAt: now,
    privacyConsentVersion: PRIVACY_POLICY_VERSION,
    termsConsentAt: now,
    termsConsentVersion: TERMS_VERSION,
    profileCompletedAt: now,
  }
  const issues = getProfileCompletionIssues(candidate)

  if (issues.length > 0) {
    return errorJson(400, "VALIDATION_ERROR", "Профиль заполнен не полностью", {
      details: { issues },
    })
  }

  const { ip, userAgent } = buildAuditMeta(req)
  const updatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: session.user.id },
      data: {
        name,
        email,
        department,
        group,
        admissionYear,
        vkUserId: vkUserId || currentUser.vkUserId,
        notifyInApp: body.notifyInApp === undefined ? true : Boolean(body.notifyInApp),
        notifyEmail: Boolean(body.notifyEmail),
        notifyVk: Boolean(body.notifyVk),
        privacyConsentAt: now,
        privacyConsentVersion: PRIVACY_POLICY_VERSION,
        termsConsentAt: now,
        termsConsentVersion: TERMS_VERSION,
        consentSource,
        profileCompletedAt: now,
      },
    })

    await tx.userConsent.createMany({
      data: [
        {
          userId: updated.id,
          type: ConsentType.PRIVACY,
          version: PRIVACY_POLICY_VERSION,
          source: "profile-complete",
          provider: consentSource,
          ip,
          userAgent,
          acceptedAt: now,
        },
        {
          userId: updated.id,
          type: ConsentType.TERMS,
          version: TERMS_VERSION,
          source: "profile-complete",
          provider: consentSource,
          ip,
          userAgent,
          acceptedAt: now,
        },
      ],
    })

    return updated
  })

  await logAuditEvent({
    actorId: updatedUser.id,
    action: "USER_PROFILE_COMPLETE",
    entityType: "User",
    entityId: updatedUser.id,
    metadata: {
      consentSource,
      privacyVersion: PRIVACY_POLICY_VERSION,
      termsVersion: TERMS_VERSION,
    },
    ip,
    userAgent,
  })

  return NextResponse.json({
    success: true,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      department: updatedUser.department,
      group: updatedUser.group,
      admissionYear: updatedUser.admissionYear,
      notifyInApp: updatedUser.notifyInApp,
      notifyEmail: updatedUser.notifyEmail,
      notifyVk: updatedUser.notifyVk,
      vkUserId: updatedUser.vkUserId,
      privacyConsentAt: updatedUser.privacyConsentAt,
      privacyConsentVersion: updatedUser.privacyConsentVersion,
      termsConsentAt: updatedUser.termsConsentAt,
      termsConsentVersion: updatedUser.termsConsentVersion,
      profileCompletedAt: updatedUser.profileCompletedAt,
    },
  })
}
