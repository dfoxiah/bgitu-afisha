/**
 * File responsibility:
 * Admin structure endpoint for departments/groups dictionaries.
 *
 * Main logic:
 * - Return current departments/groups with role split
 * - Apply bulk rename/cleanup operations for selected field
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/features/admin/client/admin-api.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma, Role } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { errorJson } from "@/server/shared/http-response"
import { isRoleValue } from "@/lib/roles"

type StructureField = "department" | "group"

type StructureEntry = {
  value: string
  total: number
  byRole: Record<Role, number>
}

const isStructureField = (value: unknown): value is StructureField =>
  value === "department" || value === "group"

const normalizeStructureValue = (value: string | null | undefined) => String(value || "").trim()

const emptyRoleCounter = (): Record<Role, number> => ({
  STUDENT: 0,
  TEACHER: 0,
  MODERATOR: 0,
  EDITOR: 0,
  ADMIN: 0,
})

const buildStructureEntries = (
  rows: Array<{ role: Role; department: string | null; group: string | null }>,
  field: StructureField
): StructureEntry[] => {
  const map = new Map<string, StructureEntry>()

  rows.forEach((row) => {
    const normalized = normalizeStructureValue(row[field])
    if (!normalized) return

    const bucket = map.get(normalized) || {
      value: normalized,
      total: 0,
      byRole: emptyRoleCounter(),
    }

    bucket.total += 1
    bucket.byRole[row.role] += 1
    map.set(normalized, bucket)
  })

  return Array.from(map.values()).sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total
    return left.value.localeCompare(right.value, "ru-RU")
  })
}

const buildStructureSnapshot = async () => {
  const rows = await prisma.user.findMany({
    select: {
      role: true,
      department: true,
      group: true,
    },
    where: {
      OR: [{ department: { not: null } }, { group: { not: null } }],
    },
  })

  return {
    departments: buildStructureEntries(rows, "department"),
    groups: buildStructureEntries(rows, "group"),
  }
}

const promoteGroupAfterSummer = (group: string) => {
  const trimmed = group.trim()
  if (!trimmed) return null

  // ANNUAL_GROUP_PROMOTION: после летней сессии повышаем номер курса в конце группы.
  // Примеры: ИСТ-301 -> ИСТ-401, ИС-21 -> ИС-31. Группы 5 курса не трогаем.
  const match = trimmed.match(/^(.*?)([1-5])(\d{1,2})(\D*)$/)
  if (!match) return null

  const currentCourse = Number(match[2])
  if (!Number.isInteger(currentCourse) || currentCourse >= 5) return null

  return `${match[1]}${currentCourse + 1}${match[3]}${match[4]}`.trim()
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  let bodyRaw: unknown = {}
  try {
    bodyRaw = await req.json()
  } catch {
    bodyRaw = {}
  }

  const body = bodyRaw && typeof bodyRaw === "object" ? (bodyRaw as Record<string, unknown>) : {}
  const dryRun = Boolean(body.dryRun)
  const now = new Date()
  const isAfterSummer = now.getMonth() >= 8

  try {
    const rows = await prisma.user.findMany({
      where: { role: Role.STUDENT, group: { not: null } },
      select: { group: true },
    })

    const groupMap = new Map<string, { next: string; users: number }>()
    const skippedGroups = new Set<string>()

    rows.forEach((row) => {
      const group = normalizeStructureValue(row.group)
      if (!group) return
      const next = promoteGroupAfterSummer(group)
      if (!next || next === group) {
        skippedGroups.add(group)
        return
      }

      const bucket = groupMap.get(group) || { next, users: 0 }
      bucket.users += 1
      groupMap.set(group, bucket)
    })

    let affectedUsers = 0
    const promotedGroups = Array.from(groupMap.entries()).map(([from, value]) => ({
      from,
      to: value.next,
      users: value.users,
    }))

    if (!dryRun && promotedGroups.length > 0) {
      await prisma.$transaction(
        promotedGroups.map((item) =>
          prisma.user.updateMany({
            where: { role: Role.STUDENT, group: item.from },
            data: {
              group: item.to,
              groupChangeCount: 0,
              updatedAt: new Date(),
            },
          })
        )
      )
      affectedUsers = promotedGroups.reduce((sum, item) => sum + item.users, 0)
    }

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: adminId,
      action: dryRun ? "ADMIN_GROUP_PROMOTION_PREVIEW" : "ADMIN_GROUP_PROMOTION_APPLY",
      entityType: "User",
      entityId: null,
      metadata: {
        isAfterSummer,
        promotedGroups,
        skippedGroups: Array.from(skippedGroups),
        affectedUsers: dryRun ? 0 : affectedUsers,
      },
      ip,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      isAfterSummer,
      promotedGroups,
      skippedGroups: Array.from(skippedGroups),
      affectedUsers: dryRun ? 0 : affectedUsers,
    })
  } catch (error) {
    console.error("POST /api/admin/structure error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  try {
    const snapshot = await buildStructureSnapshot()
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("GET /api/admin/structure error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}

export async function PUT(req: NextRequest) {
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
  const fieldRaw = body.field
  if (!isStructureField(fieldRaw)) {
    return errorJson(400, "VALIDATION_ERROR", "Поле field должно быть department или group")
  }

  const fromValue = String(body.fromValue || "").trim()
  if (!fromValue) {
    return errorJson(400, "VALIDATION_ERROR", "Укажите значение, которое нужно изменить")
  }

  if (
    body.toValue !== undefined &&
    body.toValue !== null &&
    typeof body.toValue !== "string"
  ) {
    return errorJson(400, "VALIDATION_ERROR", "Поле toValue должно быть строкой или null")
  }

  const toValueRaw = typeof body.toValue === "string" ? body.toValue : null
  const toValueNormalized = normalizeStructureValue(toValueRaw)
  const toValue = toValueNormalized.length > 0 ? toValueNormalized : null

  if (toValue === fromValue) {
    return errorJson(400, "VALIDATION_ERROR", "Новое значение должно отличаться от текущего")
  }

  const roleRaw = String(body.role || "ALL").trim().toUpperCase()
  let roleFilter: Role | "ALL" = "ALL"
  if (roleRaw !== "ALL") {
    if (!isRoleValue(roleRaw)) {
      return errorJson(400, "VALIDATION_ERROR", "Поле role должно быть ALL/STUDENT/TEACHER/EDITOR/ADMIN")
    }
    roleFilter = roleRaw
  }

  const resetGroupChangeCount =
    fieldRaw === "group" && Boolean(body.resetGroupChangeCount)

  const where: Prisma.UserWhereInput = {}
  if (fieldRaw === "department") {
    where.department = fromValue
  } else {
    where.group = fromValue
  }
  if (roleFilter !== "ALL") {
    where.role = roleFilter
  }

  const data: Prisma.UserUpdateManyMutationInput = {
    updatedAt: new Date(),
  }
  if (fieldRaw === "department") {
    data.department = toValue
  } else {
    data.group = toValue
    if (resetGroupChangeCount) {
      data.groupChangeCount = 0
    }
  }

  try {
    const result = await prisma.user.updateMany({
      where,
      data,
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: adminId,
      action: "ADMIN_USER_STRUCTURE_UPDATE",
      entityType: "User",
      entityId: null,
      metadata: {
        field: fieldRaw,
        fromValue,
        toValue,
        role: roleFilter,
        affectedUsers: result.count,
        resetGroupChangeCountApplied: resetGroupChangeCount,
      },
      ip,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      field: fieldRaw,
      fromValue,
      toValue,
      role: roleFilter,
      affectedUsers: result.count,
      resetGroupChangeCountApplied: resetGroupChangeCount,
    })
  } catch (error) {
    console.error("PUT /api/admin/structure error", error)
    return errorJson(500, "SERVER_ERROR", "Ошибка сервера")
  }
}
