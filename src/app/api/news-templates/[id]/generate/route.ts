/**
 * File responsibility:
 * Generate an editable news draft from a saved template and event data.
 *
 * Main logic:
 * - Resolve template variables from the event aggregate.
 * - Create a hidden news Event draft instead of publishing automatically.
 * - Notify the actor about the created draft.
 *
 * Integrations:
 * - Prisma NewsTemplate/Event models
 * - notification service
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { EventCategory, NotificationType } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { buildEventLink, createNotification } from "@/server/notifications/notification-service"
import { errorJson } from "@/server/shared/http-response"

type RouteParams = {
  params: Promise<{ id: string }>
}

const formatDate = (value: Date) =>
  value.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

const renderTemplate = (template: string, variables: Record<string, string>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "")

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !hasPermission(session.user.role, "news.create")) {
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
  const eventId = String(body.eventId || "").trim()
  const customTitle = String(body.title || "").trim()

  if (!eventId) {
    return errorJson(400, "VALIDATION_ERROR", "Укажите мероприятие для генерации")
  }

  const [template, sourceEvent, actor] = await Promise.all([
    prisma.newsTemplate.findUnique({ where: { id } }),
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        report: true,
        creator: { select: { name: true, email: true, department: true } },
        moderators: {
          select: {
            user: { select: { name: true, email: true, department: true } },
          },
        },
        eventParticipants: {
          where: { status: "CONFIRMED" },
          select: {
            user: { select: { name: true, email: true, department: true, group: true } },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    }),
  ])

  if (!template) {
    return errorJson(404, "NOT_FOUND", "Шаблон не найден")
  }
  if (!sourceEvent) {
    return errorJson(404, "NOT_FOUND", "Мероприятие не найдено")
  }
  if (!actor) {
    return errorJson(401, "UNAUTHORIZED", "Пользователь не найден")
  }

  const activeParticipants = sourceEvent.report?.activeParticipants || []
  const departments = Array.from(
    new Set([
      sourceEvent.creator?.department,
      ...sourceEvent.moderators.map((moderator) => moderator.user.department),
      ...sourceEvent.eventParticipants.map((participant) => participant.user.department),
    ].filter(Boolean))
  )

  const variables: Record<string, string> = {
    title: sourceEvent.title,
    "event.title": sourceEvent.title,
    date: formatDate(sourceEvent.date),
    "event.date": formatDate(sourceEvent.date),
    time: sourceEvent.time || "",
    location: sourceEvent.location || "",
    "event.location": sourceEvent.location || "",
    participantsCount: String(sourceEvent.currentParticipants),
    "event.participantsCount": String(sourceEvent.currentParticipants),
    responsible: sourceEvent.responsible || sourceEvent.creator?.name || "",
    faculty: departments.join(", "),
    department: departments.join(", "),
    summary: sourceEvent.report?.summary || sourceEvent.description || "",
    results: sourceEvent.report?.summary || "",
    activeParticipants: activeParticipants.join(", "),
  }

  const rendered = renderTemplate(template.body, variables)
  const draftTitle = customTitle || `Черновик новости: ${sourceEvent.title}`
  const images = sourceEvent.report?.images?.length ? sourceEvent.report.images : sourceEvent.images

  const draft = await prisma.event.create({
    data: {
      title: draftTitle,
      category: EventCategory.NEWS,
      date: new Date(),
      time: "09:00",
      duration: "Публикация",
      location: sourceEvent.location || "БГИТУ",
      description: rendered,
      maxParticipants: 0,
      currentParticipants: 0,
      requiresApproval: false,
      isPublic: false,
      isPast: false,
      removedFromCalendar: true,
      isNews: true,
      images,
      responsible: actor.name || actor.email,
      contact: actor.email,
      creatorId: actor.id,
    },
  })

  await createNotification({
    userId: actor.id,
    title: "Создан черновик новости",
    content: `По мероприятию «${sourceEvent.title}» создан черновик новости. Проверьте текст перед публикацией.`,
    type: NotificationType.REPORT_DRAFT_CREATED,
    link: buildEventLink(draft.id),
    metadata: {
      eventId: draft.id,
      sourceEventId: sourceEvent.id,
      templateId: template.id,
      action: "news_draft_created",
    },
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: actor.id,
    action: "NEWS_DRAFT_GENERATE",
    entityType: "Event",
    entityId: draft.id,
    metadata: { sourceEventId: sourceEvent.id, templateId: template.id },
    ip,
    userAgent,
  })

  return NextResponse.json(
    {
      id: draft.id,
      title: draft.title,
      description: draft.description,
      sourceEventId: sourceEvent.id,
      templateId: template.id,
      link: buildEventLink(draft.id),
    },
    { status: 201 }
  )
}
