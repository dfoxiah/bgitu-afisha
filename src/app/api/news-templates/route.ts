/**
 * File responsibility:
 * News template collection API.
 *
 * Main logic:
 * - List and create reusable news templates.
 * - Restrict access by backend permissions.
 *
 * Integrations:
 * - Prisma NewsTemplate model
 * - admin/news editor UI
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

const extractVariables = (body: string) =>
  Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)).map((match) => match[1])))

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !hasPermission(session.user.role, "news.create")) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const templates = await prisma.newsTemplate.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(
    templates.map((template) => ({
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      createdBy: template.createdBy
        ? {
            id: template.createdBy.id,
            name: template.createdBy.name,
            email: template.createdBy.email,
          }
        : null,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !hasPermission(session.user.role, "news.create")) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  let bodyRaw: unknown
  try {
    bodyRaw = await req.json()
  } catch {
    return errorJson(400, "BAD_REQUEST", "Неверный формат JSON")
  }

  const body = bodyRaw && typeof bodyRaw === "object" ? (bodyRaw as Record<string, unknown>) : {}
  const name = String(body.name || "").trim()
  const description = String(body.description || "").trim()
  const templateBody = String(body.body || "").trim()
  const variables = Array.isArray(body.variables)
    ? body.variables.map((item) => String(item).trim()).filter(Boolean)
    : extractVariables(templateBody)

  if (!name || !templateBody) {
    return errorJson(400, "VALIDATION_ERROR", "Укажите название и текст шаблона")
  }

  const created = await prisma.newsTemplate.create({
    data: {
      name,
      description: description || null,
      body: templateBody,
      variables,
      createdById: session.user.id,
    },
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: "NEWS_TEMPLATE_CREATE",
    entityType: "NewsTemplate",
    entityId: created.id,
    metadata: { name, variables },
    ip,
    userAgent,
  })

  return NextResponse.json(
    {
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 }
  )
}
