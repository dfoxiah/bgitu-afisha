/**
 * File responsibility:
 * News template item API.
 *
 * Main logic:
 * - Update and delete reusable news templates.
 * - Restrict changes by backend permissions.
 *
 * Integrations:
 * - Prisma NewsTemplate model
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { errorJson } from "@/server/shared/http-response"

type RouteParams = {
  params: Promise<{ id: string }>
}

const extractVariables = (body: string) =>
  Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)).map((match) => match[1])))

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !hasPermission(session.user.role, "news.edit")) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params
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

  const updated = await prisma.newsTemplate.update({
    where: { id },
    data: {
      name,
      description: description || null,
      body: templateBody,
      variables,
    },
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: "NEWS_TEMPLATE_UPDATE",
    entityType: "NewsTemplate",
    entityId: updated.id,
    metadata: { name, variables },
    ip,
    userAgent,
  })

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  })
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !hasPermission(session.user.role, "news.edit")) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const { id } = await params
  await prisma.newsTemplate.delete({ where: { id } })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: "NEWS_TEMPLATE_DELETE",
    entityType: "NewsTemplate",
    entityId: id,
    metadata: {},
    ip,
    userAgent,
  })

  return NextResponse.json({ success: true })
}
