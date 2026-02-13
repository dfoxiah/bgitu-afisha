/**
 * File responsibility:
 * Admin bulk import endpoint for users/events/news.
 *
 * Main logic:
 * - Validate admin access and import mode/type
 * - Parse CSV/JSON payload into normalized rows
 * - Delegate import logic to domain services and write audit log
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/server/admin/import-parser.ts
 * - src/server/admin/import-service.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { ensureAdminSession } from "@/server/admin/admin-session"
import {
  EVENT_HEADER_ALIASES,
  USER_HEADER_ALIASES,
  mapCsvRows,
  mapJsonRows,
  type ImportRow,
} from "@/server/admin/import-parser"
import {
  importEventRows,
  importUsersRows,
  type ImportMode,
  type ImportResult,
  type ImportType,
} from "@/server/admin/import-service"
import { adminImportQuerySchema } from "@/server/shared/schemas/admin-api-schema"
import { errorJson } from "@/server/shared/http-response"

const parseRows = async (req: NextRequest, type: ImportType): Promise<ImportRow[]> => {
  const contentType = req.headers.get("content-type") || ""
  const aliases = type === "users" ? USER_HEADER_ALIASES : EVENT_HEADER_ALIASES

  if (contentType.includes("application/json")) {
    const payload = await req.json()
    return mapJsonRows(payload, aliases)
  }

  const text = await req.text()
  return mapCsvRows(text, aliases)
}

const runImport = async (
  type: ImportType,
  mode: ImportMode,
  rows: ImportRow[],
  actorId: string
): Promise<ImportResult> => {
  if (type === "users") {
    return importUsersRows(rows, mode)
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, name: true, email: true },
  })

  if (!actor) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: ["Текущий администратор не найден"],
      warnings: [],
    }
  }

  return importEventRows(rows, mode, type, actor)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { searchParams } = new URL(req.url)
  const parsedQuery = adminImportQuerySchema.safeParse({
    type: searchParams.get("type"),
    mode: searchParams.get("mode"),
  })

  if (!parsedQuery.success) {
    return errorJson(400, "VALIDATION_ERROR", "Укажите type=users|events|news и mode=upsert|create", {
      details: parsedQuery.error.flatten(),
    })
  }

  const { type, mode } = parsedQuery.data

  let rows: ImportRow[]
  try {
    rows = await parseRows(req, type)
  } catch {
    return errorJson(400, "BAD_REQUEST", "Не удалось прочитать файл импорта")
  }

  if (rows.length === 0) {
    return errorJson(400, "VALIDATION_ERROR", "Файл пустой или формат не распознан")
  }

  const result = await runImport(type, mode, rows, adminId)

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action:
      type === "users"
        ? "ADMIN_USERS_IMPORT"
        : type === "news"
          ? "ADMIN_NEWS_IMPORT"
          : "ADMIN_EVENTS_IMPORT",
    entityType: type === "users" ? "User" : "Event",
    entityId: null,
    metadata: {
      mode,
      inputRows: rows.length,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
      warnings: result.warnings.length,
    },
    ip,
    userAgent,
  })

  return NextResponse.json(result)
}
