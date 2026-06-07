/**
 * File responsibility:
 * Admin user details endpoint (get/update/delete).
 *
 * Main logic:
 * - Return selected user fields
 * - Update role/profile/password
 * - Delete user with self-delete protection
 *
 * Integrations:
 * - src/app/admin/page.tsx
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { deriveProfileCompletionState } from "@/lib/profile-completion"
import { prisma } from "@/lib/prisma"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { errorJson } from "@/server/shared/http-response"
import { buildEmailInsensitiveFilter } from "@/server/shared/user-email"
import { isRoleValue } from "@/lib/roles"

type RouteParams = {
  params: Promise<{ id: string }>
}

const normalizeAdmissionYear = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || String(value).trim() === "") return null
  const year = Number(value)
  const currentYear = new Date().getFullYear()
  return Number.isInteger(year) && year >= 1990 && year <= currentYear + 1 ? year : "invalid"
}

const parseOptionalDateInput = (value: unknown, label: string) => {
  if (value === undefined) return { value: undefined as Date | null | undefined }
  if (value === null || String(value).trim() === "") return { value: null as Date | null }

  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    return { error: `Некорректная дата: ${label}` }
  }

  return { value: parsed }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      admissionYear: true,
      groupChangeCount: true,
      bio: true,
      privacyConsentAt: true,
      termsConsentAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    return errorJson(404, "NOT_FOUND", "Пользователь не найден")
  }

  return NextResponse.json(user)
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      admissionYear: true,
      groupChangeCount: true,
      bio: true,
      privacyConsentAt: true,
      privacyConsentVersion: true,
      termsConsentAt: true,
      termsConsentVersion: true,
      consentSource: true,
      profileCompletedAt: true,
    },
  })

  if (!existingUser) {
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

  const body = bodyRaw as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = String(body.name || "").trim()
  if (body.email !== undefined) {
    const nextEmail = String(body.email || "").trim().toLowerCase()
    if (!nextEmail) {
      return errorJson(400, "VALIDATION_ERROR", "Email не может быть пустым")
    }
    updates.email = nextEmail
  }
  if (body.department !== undefined) {
    updates.department = body.department ? String(body.department).trim() : null
  }
  if (body.group !== undefined) updates.group = body.group ? String(body.group).trim() : null
  if (body.admissionYear !== undefined) {
    const admissionYear = normalizeAdmissionYear(body.admissionYear)
    if (admissionYear === "invalid") {
      return errorJson(400, "VALIDATION_ERROR", "Некорректный год поступления")
    }
    updates.admissionYear = admissionYear
  }
  if (body.groupChangeCount !== undefined) updates.groupChangeCount = Number(body.groupChangeCount) || 0
  if (body.bio !== undefined) updates.bio = body.bio ? String(body.bio).trim() : null

  if (body.role !== undefined) {
    const roleRaw = String(body.role).trim()
    if (!isRoleValue(roleRaw)) {
      return errorJson(400, "VALIDATION_ERROR", "Некорректная роль")
    }
    updates.role = roleRaw
  }

  if (body.password) {
    const password = String(body.password).trim()
    if (password.length < 6) {
      return errorJson(400, "VALIDATION_ERROR", "Пароль должен быть не короче 6 символов")
    }
    updates.password = await bcrypt.hash(password, 10)
  }

  const privacyConsentDate = parseOptionalDateInput(body.privacyConsentAt, "privacyConsentAt")
  if (privacyConsentDate.error) {
    return errorJson(400, "VALIDATION_ERROR", privacyConsentDate.error)
  }
  if (privacyConsentDate.value !== undefined) {
    updates.privacyConsentAt = privacyConsentDate.value
  }

  const termsConsentDate = parseOptionalDateInput(body.termsConsentAt, "termsConsentAt")
  if (termsConsentDate.error) {
    return errorJson(400, "VALIDATION_ERROR", termsConsentDate.error)
  }
  if (termsConsentDate.value !== undefined) {
    updates.termsConsentAt = termsConsentDate.value
  }

  if (typeof updates.email === "string") {
    const duplicate = await prisma.user.findFirst({
      where: {
        AND: [
          buildEmailInsensitiveFilter(updates.email),
          { id: { not: id } },
        ],
      },
      select: { id: true },
    })

    if (duplicate) {
      return errorJson(409, "CONFLICT", "Пользователь с таким email уже существует")
    }
  }

  if (Object.keys(updates).length === 0) {
    return errorJson(400, "BAD_REQUEST", "Нет данных для обновления")
  }

  Object.assign(
    updates,
    deriveProfileCompletionState(
      {
        name: typeof updates.name === "string" ? updates.name : existingUser.name,
        email: typeof updates.email === "string" ? updates.email : existingUser.email,
        role: typeof updates.role === "string" ? updates.role : existingUser.role,
        department:
          updates.department !== undefined ? (updates.department as string | null) : existingUser.department,
        group: updates.group !== undefined ? (updates.group as string | null) : existingUser.group,
        admissionYear:
          updates.admissionYear !== undefined
            ? (updates.admissionYear as number | null)
            : existingUser.admissionYear,
        privacyConsentAt:
          updates.privacyConsentAt !== undefined
            ? (updates.privacyConsentAt as Date | null)
            : existingUser.privacyConsentAt,
        termsConsentAt:
          updates.termsConsentAt !== undefined
            ? (updates.termsConsentAt as Date | null)
            : existingUser.termsConsentAt,
        privacyConsentVersion: existingUser.privacyConsentVersion,
        termsConsentVersion: existingUser.termsConsentVersion,
        consentSource: existingUser.consentSource,
        profileCompletedAt: existingUser.profileCompletedAt,
      },
      "admin"
    )
  )

  const updated = await prisma.user.update({
    where: { id },
    data: updates,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      admissionYear: true,
      groupChangeCount: true,
      bio: true,
      privacyConsentAt: true,
      privacyConsentVersion: true,
      termsConsentAt: true,
      termsConsentVersion: true,
      profileCompletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: "ADMIN_USER_UPDATE",
    entityType: "User",
    entityId: updated.id,
    metadata: { updatedFields: Object.keys(updates) },
    ip,
    userAgent,
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params
  if (id === adminId) {
    return errorJson(400, "VALIDATION_ERROR", "Нельзя удалить самого себя")
  }

  await prisma.user.delete({ where: { id } })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: "ADMIN_USER_DELETE",
    entityType: "User",
    entityId: id,
    metadata: null,
    ip,
    userAgent,
  })

  return NextResponse.json({ success: true })
}
