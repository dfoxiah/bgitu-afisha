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
import { ImportStatus, ImportType as PrismaImportType, NotificationType } from "@prisma/client"
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
import { buildAdminLink, createNotification } from "@/server/notifications/notification-service"

const importTemplates: Record<ImportType, string[][]> = {
  users: [
    ["email", "name", "password", "role", "department", "group", "admissionYear", "bio"],
    ["student@example.com", "Иванов Иван Иванович", "", "STUDENT", "Информационные системы", "ИС-23", "2023", ""],
  ],
  events: [
    [
      "title",
      "category",
      "date",
      "time",
      "duration",
      "location",
      "description",
      "maxParticipants",
      "requiresApproval",
      "isPublic",
      "responsible",
      "contact",
      "creatorEmail",
      "moderatorEmails",
      "images",
    ],
    [
      "День открытых дверей",
      "PUBLIC_EVENT",
      "2026-09-01",
      "12:00",
      "2 часа",
      "Актовый зал",
      "Описание мероприятия",
      "120",
      "true",
      "true",
      "Иванов И.И.",
      "events@example.com",
      "admin@example.com",
      "moderator@example.com",
      "",
    ],
  ],
  news: [
    ["title", "date", "time", "location", "description", "responsible", "creatorEmail", "images"],
    ["Итоги мероприятия", "2026-09-02", "10:00", "БГИТУ", "Текст новости", "Редакция", "admin@example.com", ""],
  ],
}

const toCsv = (rows: string[][]) =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "")
          return /[",;\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(";")
    )
    .join("\n")

const parseImportTypeParam = (value: string | null): ImportType | null => {
  if (value === "users" || value === "events" || value === "news") return value
  return null
}

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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminId = ensureAdminSession(session)
  if (!adminId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { searchParams } = new URL(req.url)
  const templateType = parseImportTypeParam(searchParams.get("template"))
  if (templateType) {
    const csv = toCsv(importTemplates[templateType])
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bgitu_${templateType}_import_template.csv"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      actor: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json(
    jobs.map((job) => ({
      id: job.id,
      type: job.type,
      mode: job.mode,
      status: job.status,
      inputRows: job.inputRows,
      created: job.created,
      updated: job.updated,
      skipped: job.skipped,
      errors: job.errors,
      warnings: job.warnings,
      createdAt: job.createdAt.toISOString(),
      actor: job.actor?.name || job.actor?.email || null,
    })),
    { headers: { "Cache-Control": "no-store" } }
  )
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
  const hasErrors = result.errors.length > 0
  const importStatus = hasErrors ? ImportStatus.COMPLETED_WITH_ERRORS : ImportStatus.COMPLETED
  const importType =
    type === "users"
      ? PrismaImportType.USERS
      : type === "events"
        ? PrismaImportType.EVENTS
        : PrismaImportType.NEWS

  await prisma.importJob.create({
    data: {
      actorId: adminId,
      type: importType,
      mode,
      status: importStatus,
      inputRows: rows.length,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      warnings: result.warnings,
    },
  })

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

  await createNotification({
    userId: adminId,
    title: hasErrors ? "Импорт завершён с ошибками" : "Импорт завершён",
    content: `Тип: ${type}. Создано: ${result.created}, обновлено: ${result.updated}, пропущено: ${result.skipped}. Ошибок: ${result.errors.length}.`,
    type: hasErrors ? NotificationType.IMPORT_COMPLETED_WITH_ERRORS : NotificationType.IMPORT_COMPLETED,
    link: buildAdminLink("import"),
    metadata: {
      type,
      mode,
      inputRows: rows.length,
      errors: result.errors.length,
      warnings: result.warnings.length,
    },
  })

  return NextResponse.json(result)
}
