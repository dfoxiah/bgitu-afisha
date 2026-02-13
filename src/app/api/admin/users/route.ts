/**
 * File responsibility:
 * Admin users collection endpoint (list + create).
 *
 * Main logic:
 * - GET: search/filter users for admin panel
 * - POST: create user account with role and optional profile fields
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/admin-session.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { errorJson } from "@/server/shared/http-response"

const isRole = (value: string): value is Role =>
  value === "STUDENT" || value === "TEACHER" || value === "ADMIN"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.trim()
  const roleParam = searchParams.get("role")?.trim() || ""
  const role = isRole(roleParam) ? roleParam : null
  const limit = Number(searchParams.get("limit") || 50)
  const offset = Number(searchParams.get("offset") || 0)

  const where: Record<string, unknown> = {}
  if (role) where.role = role
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { department: { contains: search, mode: "insensitive" } },
      { group: { contains: search, mode: "insensitive" } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
    skip: Math.max(offset, 0),
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      groupChangeCount: true,
      bio: true,
      privacyConsentAt: true,
      termsConsentAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
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
  const email = String(body.email || "").trim().toLowerCase()
  const name = String(body.name || "").trim()
  const password = String(body.password || "").trim()
  const roleRaw = String(body.role || "STUDENT").trim()

  if (!email || !name || !password) {
    return errorJson(400, "VALIDATION_ERROR", "Заполните email, имя и пароль")
  }

  if (!isRole(roleRaw)) {
    return errorJson(400, "VALIDATION_ERROR", "Некорректная роль")
  }

  if (password.length < 6) {
    return errorJson(400, "VALIDATION_ERROR", "Пароль должен быть не короче 6 символов")
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return errorJson(409, "CONFLICT", "Пользователь с таким email уже существует")
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const consentAt = body.acceptPrivacy && body.acceptTerms ? new Date() : null

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: roleRaw,
      department: body.department ? String(body.department).trim() : null,
      group: body.group ? String(body.group).trim() : null,
      bio: body.bio ? String(body.bio).trim() : null,
      privacyConsentAt: consentAt,
      termsConsentAt: consentAt,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      groupChangeCount: true,
      bio: true,
      createdAt: true,
    },
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: "ADMIN_USER_CREATE",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    ip,
    userAgent,
  })

  return NextResponse.json(user, { status: 201 })
}
