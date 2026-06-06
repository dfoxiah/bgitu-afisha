/**
 * File responsibility:
 * Admin event/news domain service for CRUD, moderation links and audit metadata.
 *
 * Main logic:
 * - Read filtered admin event lists and full event details
 * - Create news items and update/delete event aggregates with report/moderator sync
 * - Emit change notifications and rich audit payloads for admin operations
 *
 * Integrations:
 * - src/app/api/admin/events/route.ts
 * - src/app/api/admin/events/[id]/route.ts
 */

import {
  EventCategory,
  NotificationType,
  ParticipantStatus,
  Prisma,
  type EventReport,
  type Event,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { parseLocalDateTime } from "@/server/shared/date-time"
import { buildFieldChanges, toAuditValue } from "@/server/shared/audit-diff"
import { ServiceError } from "@/server/shared/service-error"
import type { NextRequest } from "next/server"
import { isModeratorRole } from "@/lib/roles"

type EventListQuery = {
  search?: string | null
  category?: string | null
  upcoming?: string | null
  past?: string | null
  news?: string | null
  limit?: number
  offset?: number
}

type EventUpdatePayload = Record<string, unknown>

type ReportPatch = {
  summary?: string
  reportDate?: Date
  images?: string[]
  tasks?: string[]
  comment?: string | null
} | null

const eventListInclude = {
  creator: {
    select: { id: true, name: true, email: true, role: true },
  },
  eventParticipants: {
    select: {
      status: true,
    },
  },
  moderators: {
    select: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
} satisfies Prisma.EventInclude

const eventDetailsInclude = {
  report: true,
  eventParticipants: {
    select: {
      status: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          group: true,
          image: true,
          createdAt: true,
        },
      },
    },
  },
  creator: {
    select: { id: true, name: true, email: true, role: true },
  },
  moderators: {
    select: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
} satisfies Prisma.EventInclude

const eventForEditSelect = {
  id: true,
  title: true,
  description: true,
  date: true,
  time: true,
  location: true,
  duration: true,
  responsible: true,
  contact: true,
  category: true,
  maxParticipants: true,
  currentParticipants: true,
  isNews: true,
  removedFromCalendar: true,
  images: true,
  report: {
    select: {
      summary: true,
      reportDate: true,
      images: true,
      tasks: true,
      comment: true,
    },
  },
  eventParticipants: {
    select: {
      userId: true,
      status: true,
      user: {
        select: { email: true },
      },
    },
  },
  moderators: {
    select: {
      userId: true,
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.EventSelect

const serializeListEvent = (
  event: Prisma.EventGetPayload<{ include: typeof eventListInclude }>
) => {
  const { eventParticipants: _eventParticipants, ...eventBase } = event
  const confirmedParticipants = event.eventParticipants.filter(
    (row) => row.status === ParticipantStatus.CONFIRMED
  ).length
  const pendingParticipants = event.eventParticipants.filter(
    (row) => row.status === ParticipantStatus.PENDING
  ).length

  return {
    ...eventBase,
    currentParticipants: confirmedParticipants,
    confirmedParticipants,
    pendingParticipants,
    moderators: event.moderators.map((row) => row.user),
    date: event.date.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}

const serializeEventDetails = (
  event: Prisma.EventGetPayload<{ include: typeof eventDetailsInclude }>
) => {
  const confirmed = event.eventParticipants
    .filter((row) => row.status === ParticipantStatus.CONFIRMED)
    .map((row) => row.user)
  const pending = event.eventParticipants
    .filter((row) => row.status === ParticipantStatus.PENDING)
    .map((row) => row.user)

  return {
    ...event,
    currentParticipants: confirmed.length,
    participants: confirmed,
    pendingParticipants: pending,
    moderators: event.moderators.map((row) => row.user),
    date: event.date.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    report: event.report
      ? {
          ...event.report,
          reportDate: event.report.reportDate.toISOString(),
          createdAt: event.report.createdAt.toISOString(),
          updatedAt: event.report.updatedAt.toISOString(),
        }
      : null,
  }
}

const parseNewsDate = (rawDate: unknown) => {
  const fallback = new Date()
  fallback.setHours(12, 0, 0, 0)

  if (typeof rawDate !== "string") return fallback
  const value = rawDate.trim()
  if (!value) return fallback

  const parsed = parseLocalDateTime(value)
  return parsed || fallback
}

const parseReportPatch = (value: unknown): ReportPatch => {
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>

  const summary = input.summary !== undefined ? String(input.summary).trim() : undefined
  const comment = input.comment !== undefined ? String(input.comment).trim() : undefined
  const reportDateRaw = input.reportDate !== undefined ? String(input.reportDate).trim() : undefined

  let reportDate: Date | undefined
  if (reportDateRaw) {
    reportDate = parseLocalDateTime(reportDateRaw) || undefined
    if (!reportDate) {
      throw new ServiceError(400, "VALIDATION_ERROR", "Некорректный формат даты отчета")
    }
  }

  const images = Array.isArray(input.images)
    ? input.images.map((item) => String(item).trim()).filter(Boolean)
    : undefined

  let tasks: string[] | undefined
  if (Array.isArray(input.tasks)) {
    tasks = input.tasks.map((item) => String(item).trim()).filter(Boolean)
  } else if (typeof input.tasks === "string") {
    tasks = input.tasks
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return { summary, reportDate, images, tasks, comment }
}

const parseModerators = async (value: unknown) => {
  if (!Array.isArray(value)) return null

  const emails = value.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
  const uniqueEmails = Array.from(new Set(emails))
  if (uniqueEmails.length === 0) return [] as string[]

  const users = await prisma.user.findMany({
    where: {
      email: { in: uniqueEmails },
      role: { in: ["TEACHER", "EDITOR", "ADMIN"] },
    },
    select: { id: true, email: true },
  })

  const found = new Set(users.map((user) => user.email.toLowerCase()))
  const missing = uniqueEmails.filter((email) => !found.has(email))
  if (missing.length) {
    throw new ServiceError(400, "VALIDATION_ERROR", `Не найдены преподаватели/редакторы: ${missing.join(", ")}`)
  }

  return users.map((user) => user.id)
}

const resolveResponsibleById = async (value: unknown) => {
  if (value === undefined || value === null) return null
  const responsibleId = String(value).trim()
  if (!responsibleId) return null

  const user = await prisma.user.findUnique({
    where: { id: responsibleId },
    select: { id: true, name: true, email: true, role: true },
  })

  if (!user || !isModeratorRole(user.role)) {
    throw new ServiceError(
      400,
      "VALIDATION_ERROR",
      "Руководитель должен быть преподавателем, редактором или администратором"
    )
  }

  return user
}

const buildEventAuditInfo = (
  event: Pick<
    Event,
    | "title"
    | "category"
    | "date"
    | "time"
    | "location"
    | "description"
    | "duration"
    | "maxParticipants"
    | "isNews"
    | "removedFromCalendar"
    | "images"
    | "responsible"
    | "contact"
  > & {
    currentParticipants?: number
  },
  participantsCount: number,
  moderatorsCount: number
) => ({
  title: event.title,
  category: String(event.category),
  date: event.date.toISOString(),
  time: event.time || "",
  location: event.location,
  description: event.description || "",
  duration: event.duration || "",
  maxParticipants: event.maxParticipants,
  currentParticipants: participantsCount,
  moderatorsCount,
  imagesCount: Array.isArray(event.images) ? event.images.length : 0,
  isNews: Boolean(event.isNews),
  removedFromCalendar: Boolean(event.removedFromCalendar),
  responsible: event.responsible || "",
  contact: event.contact || "",
})

const buildReportAuditInfo = (report: Pick<EventReport, "summary" | "reportDate" | "images" | "tasks" | "comment"> | null) => {
  if (!report) return null
  return {
    summary: report.summary,
    reportDate: report.reportDate.toISOString(),
    imagesCount: report.images.length,
    tasksCount: report.tasks.length,
    comment: report.comment || "",
  }
}

const loadNotifyChangesUserSet = async (ids: string[]) => {
  if (ids.length === 0) return new Set<string>()
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, notifyChanges: true },
    select: { id: true },
  })
  return new Set(users.map((user) => user.id))
}

export const listAdminEvents = async (query: EventListQuery) => {
  const where: Prisma.EventWhereInput = {}
  if (query.category && Object.values(EventCategory).includes(query.category as EventCategory)) {
    where.category = query.category as EventCategory
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { location: { contains: query.search, mode: "insensitive" } },
    ]
  }

  if (query.upcoming === "true") {
    where.date = { gte: new Date() }
  }
  if (query.past === "true") {
    where.isPast = true
  }

  if (query.news === "true") {
    const newsFilter: Prisma.EventWhereInput = {
      OR: [{ isNews: true }, { category: EventCategory.NEWS }, { report: { isNot: null } }],
    }
    const andConditions: Prisma.EventWhereInput[] = []
    if (where.AND) {
      if (Array.isArray(where.AND)) {
        andConditions.push(...where.AND)
      } else {
        andConditions.push(where.AND)
      }
    }
    if (where.OR) {
      andConditions.push({ OR: where.OR })
      delete where.OR
    }
    andConditions.push(newsFilter)
    where.AND = andConditions
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "desc" },
    take: Math.min(Number(query.limit || 50), 200),
    skip: Math.max(Number(query.offset || 0), 0),
    include: eventListInclude,
  })

  return events.map(serializeListEvent)
}

export const createAdminNews = async (
  adminId: string,
  input: Record<string, unknown>,
  req?: NextRequest
) => {
  const title = String(input.title || "").trim()
  const content = String(input.content || input.description || "").trim()
  if (!title) {
    throw new ServiceError(400, "VALIDATION_ERROR", "Укажите заголовок новости")
  }
  if (!content) {
    throw new ServiceError(400, "VALIDATION_ERROR", "Укажите текст новости")
  }

  const images = Array.isArray(input.images)
    ? input.images.map((value) => String(value).trim()).filter(Boolean)
    : []
  const tasks = Array.isArray(input.tasks)
    ? input.tasks.map((value) => String(value).trim()).filter(Boolean)
    : typeof input.tasks === "string"
      ? input.tasks
          .split(/\r?\n/g)
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  const reportComment = typeof input.reportComment === "string" ? input.reportComment.trim() : null
  const shouldCreateReport = Boolean(input.createReport) || tasks.length > 0 || Boolean(reportComment)

  const date = parseNewsDate(input.date)
  const time = typeof input.time === "string" && input.time.trim() ? input.time.trim() : "12:00"
  const location =
    typeof input.location === "string" && input.location.trim() ? input.location.trim() : "Не указано"

  const adminUser = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, name: true, email: true },
  })
  if (!adminUser) {
    throw new ServiceError(404, "NOT_FOUND", "Администратор не найден")
  }

  const responsibleAssignee = await resolveResponsibleById(input.responsibleId)

  const created = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        title,
        category: EventCategory.NEWS,
        date,
        time,
        duration: "1 день",
        location,
        description: content,
        maxParticipants: 0,
        currentParticipants: 0,
        isPast: date < new Date(),
        removedFromCalendar: false,
        isNews: true,
        images,
        responsible:
          typeof input.responsible === "string" && input.responsible.trim()
            ? input.responsible.trim()
            : responsibleAssignee?.name || responsibleAssignee?.email || adminUser.name || adminUser.email || "Администратор",
        contact:
          typeof input.contact === "string" && input.contact.trim()
            ? input.contact.trim()
            : responsibleAssignee?.email || adminUser.email || "",
        creatorId: adminUser.id,
      },
      include: eventListInclude,
    })

    if (shouldCreateReport) {
      await tx.eventReport.create({
        data: {
          eventId: event.id,
          summary: content,
          tasks,
          comment: reportComment || null,
          reportDate: date,
          activeParticipants: [],
          images,
        },
      })
    }

    return event
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: "ADMIN_NEWS_CREATE",
    entityType: "Event",
    entityId: created.id,
    metadata: {
      title: created.title,
      hasReport: shouldCreateReport,
      imagesCount: images.length,
      tasksCount: tasks.length,
      eventInfo: {
        category: created.category,
        date: created.date.toISOString(),
        time: created.time,
        location: created.location,
        isNews: created.isNews,
      },
    },
    ip,
    userAgent,
  })

  return serializeListEvent(created)
}

export const getAdminEventDetails = async (id: string) => {
  const event = await prisma.event.findUnique({
    where: { id },
    include: eventDetailsInclude,
  })

  if (!event) {
    throw new ServiceError(404, "NOT_FOUND", "Мероприятие не найдено")
  }

  return serializeEventDetails(event)
}

export const updateAdminEvent = async (
  eventId: string,
  body: EventUpdatePayload,
  adminId: string,
  req?: NextRequest
) => {
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
    select: eventForEditSelect,
  })
  if (!existingEvent) {
    throw new ServiceError(404, "NOT_FOUND", "Мероприятие не найдено")
  }

  const updateData: Prisma.EventUpdateInput = {}
  if (body.responsibleId !== undefined) {
    const responsibleAssignee = await resolveResponsibleById(body.responsibleId)
    if (responsibleAssignee) {
      updateData.responsible = responsibleAssignee.name || responsibleAssignee.email
      if (body.contact === undefined) {
        updateData.contact = responsibleAssignee.email
      }
    }
  }
  if (body.title !== undefined) updateData.title = String(body.title).trim()
  if (body.description !== undefined) updateData.description = String(body.description).trim()
  if (body.location !== undefined) updateData.location = String(body.location).trim()
  if (body.duration !== undefined) updateData.duration = String(body.duration).trim()
  if (body.responsible !== undefined) updateData.responsible = String(body.responsible).trim()
  if (body.contact !== undefined) updateData.contact = String(body.contact).trim()
  if (body.isNews !== undefined) updateData.isNews = Boolean(body.isNews)
  if (body.removedFromCalendar !== undefined) updateData.removedFromCalendar = Boolean(body.removedFromCalendar)

  if (body.category !== undefined) {
    const categoryRaw = String(body.category).trim()
    if (!Object.values(EventCategory).includes(categoryRaw as EventCategory)) {
      throw new ServiceError(400, "VALIDATION_ERROR", `Недопустимая категория: ${categoryRaw}`)
    }
    updateData.category = categoryRaw as EventCategory
  }

  if (body.maxParticipants !== undefined) {
    updateData.maxParticipants = Number(body.maxParticipants) || 0
  }

  if (Array.isArray(body.images)) {
    updateData.images = body.images.map((item) => String(item).trim()).filter(Boolean)
  }

  if (body.date !== undefined || body.time !== undefined) {
    const incomingDate = body.date ? String(body.date) : existingEvent.date.toISOString().slice(0, 10)
    const incomingTime = body.time ? String(body.time).trim() : existingEvent.time || "00:00"
    const parsed = parseLocalDateTime(incomingDate, incomingTime)
    if (!parsed) {
      throw new ServiceError(400, "VALIDATION_ERROR", "Некорректный формат даты")
    }
    updateData.date = parsed
    updateData.time = incomingTime
  }

  const moderatorIds = await parseModerators(body.moderators)
  const reportPatch = parseReportPatch(body.report)

  await prisma.$transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.event.update({
        where: { id: eventId },
        data: updateData,
      })
    }

    if (
      reportPatch &&
      (reportPatch.summary !== undefined ||
        reportPatch.reportDate !== undefined ||
        reportPatch.images !== undefined ||
        reportPatch.tasks !== undefined ||
        reportPatch.comment !== undefined)
    ) {
      const existingReport = await tx.eventReport.findUnique({ where: { eventId } })
      if (existingReport) {
        const reportUpdate: Prisma.EventReportUpdateInput = {}
        if (reportPatch.summary !== undefined) reportUpdate.summary = reportPatch.summary
        if (reportPatch.reportDate !== undefined) reportUpdate.reportDate = reportPatch.reportDate
        if (reportPatch.images !== undefined) reportUpdate.images = reportPatch.images
        if (reportPatch.tasks !== undefined) reportUpdate.tasks = reportPatch.tasks
        if (reportPatch.comment !== undefined) reportUpdate.comment = reportPatch.comment

        if (Object.keys(reportUpdate).length > 0) {
          await tx.eventReport.update({
            where: { eventId },
            data: reportUpdate,
          })
        }
      } else {
        await tx.eventReport.create({
          data: {
            eventId,
            summary: reportPatch.summary ?? (updateData.description as string) ?? existingEvent.description ?? existingEvent.title,
            reportDate: reportPatch.reportDate || existingEvent.date,
            tasks: reportPatch.tasks || [],
            activeParticipants: [],
            images: reportPatch.images || [],
            comment: reportPatch.comment ?? null,
          },
        })
      }
    }

    if (moderatorIds !== null) {
      await tx.eventModerator.deleteMany({
        where: {
          eventId,
          userId: { notIn: moderatorIds.length > 0 ? moderatorIds : ["__none__"] },
        },
      })

      if (moderatorIds.length > 0) {
        await tx.eventModerator.createMany({
          data: moderatorIds.map((userId) => ({ eventId, userId })),
          skipDuplicates: true,
        })
      }
    }
  })

  const updated = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      report: {
        select: {
          summary: true,
          reportDate: true,
          images: true,
          tasks: true,
          comment: true,
        },
      },
      eventParticipants: {
        select: {
          status: true,
          user: { select: { id: true, email: true } },
        },
      },
      creator: { select: { id: true, name: true, email: true, role: true } },
      moderators: {
        select: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  })
  if (!updated) {
    throw new ServiceError(404, "NOT_FOUND", "Мероприятие не найдено")
  }

  const oldModeratorIds = existingEvent.moderators.map((item) => item.userId)
  const currentModeratorIds = moderatorIds ?? oldModeratorIds
  const addedModeratorIds = moderatorIds
    ? moderatorIds.filter((id) => !oldModeratorIds.includes(id))
    : []

  const eventDateText = updated.date.toLocaleDateString("ru-RU")
  const timeText = updated.time ? ` ${updated.time}` : ""
  const locationText = updated.location ? `, место: ${updated.location}` : ""

  const notifications: Prisma.NotificationCreateManyInput[] = []
  const notifyChangesRecipients = await loadNotifyChangesUserSet(addedModeratorIds)
  addedModeratorIds.forEach((userId) => {
    if (!notifyChangesRecipients.has(userId) || userId === adminId) return
    notifications.push({
      userId,
      title: "Назначение модератором",
      content: `Вас назначили модератором мероприятия «${updated.title}». Дата: ${eventDateText}${timeText}${locationText}`,
      type: NotificationType.EVENT,
      read: false,
      metadata: { eventId: updated.id, action: "moderator_added" },
    })
  })

  const updatedFields = Object.keys(updateData)
  if (updatedFields.length > 0) {
    const labels: Record<string, string> = {
      title: "название",
      description: "описание",
      location: "место",
      duration: "длительность",
      responsible: "ответственный",
      contact: "контакт",
      category: "категория",
      maxParticipants: "лимит участников",
      images: "изображения",
      date: "дата",
      time: "время",
      isNews: "флаг новости",
      removedFromCalendar: "скрытие из календаря",
    }
    const fieldText = updatedFields.map((field) => labels[field]).filter(Boolean)
    const summary =
      fieldText.length > 0
        ? `Обновлены поля: ${fieldText.join(", ")}.`
        : "Обновлены детали мероприятия."

    const audienceIds = new Set<string>()
    existingEvent.eventParticipants.forEach((item) => audienceIds.add(item.userId))
    currentModeratorIds.forEach((id) => audienceIds.add(id))
    audienceIds.delete(adminId)

    const allowed = await loadNotifyChangesUserSet(Array.from(audienceIds))
    allowed.forEach((userId) => {
      notifications.push({
        userId,
        title: "Изменение мероприятия",
        content: `Мероприятие «${updated.title}» было обновлено. ${summary} Дата: ${eventDateText}${timeText}${locationText}`,
        type: NotificationType.CHANGE,
        read: false,
        metadata: { eventId: updated.id, action: "event_updated" },
      })
    })
  }

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications })
  }

  const beforeModeratorEmails = existingEvent.moderators
    .map((item) => item.user?.email)
    .filter((value): value is string => Boolean(value))
  const afterModeratorEmails = updated.moderators
    .map((item) => item.user?.email)
    .filter((value): value is string => Boolean(value))

  const beforeConfirmed = existingEvent.eventParticipants.filter(
    (item) => item.status === ParticipantStatus.CONFIRMED
  )
  const afterConfirmed = updated.eventParticipants.filter(
    (item) => item.status === ParticipantStatus.CONFIRMED
  )

  const eventBeforeFields: Record<string, unknown> = {
    title: existingEvent.title,
    description: existingEvent.description,
    location: existingEvent.location,
    duration: existingEvent.duration,
    responsible: existingEvent.responsible,
    contact: existingEvent.contact,
    category: existingEvent.category,
    maxParticipants: existingEvent.maxParticipants,
    images: existingEvent.images,
    date: existingEvent.date,
    time: existingEvent.time,
    isNews: existingEvent.isNews,
    removedFromCalendar: existingEvent.removedFromCalendar,
  }
  const eventAfterFields: Record<string, unknown> = {
    title: updated.title,
    description: updated.description,
    location: updated.location,
    duration: updated.duration,
    responsible: updated.responsible,
    contact: updated.contact,
    category: updated.category,
    maxParticipants: updated.maxParticipants,
    images: updated.images,
    date: updated.date,
    time: updated.time,
    isNews: updated.isNews,
    removedFromCalendar: updated.removedFromCalendar,
  }

  const fieldChanges = buildFieldChanges(eventBeforeFields, eventAfterFields, updatedFields)
  const reportFieldsTouched = reportPatch
    ? ([
        reportPatch.summary !== undefined ? "summary" : null,
        reportPatch.reportDate !== undefined ? "reportDate" : null,
        reportPatch.images !== undefined ? "images" : null,
        reportPatch.tasks !== undefined ? "tasks" : null,
        reportPatch.comment !== undefined ? "comment" : null,
      ].filter(Boolean) as string[])
    : []

  const reportBefore: Record<string, unknown> = {
    summary: existingEvent.report?.summary ?? null,
    reportDate: existingEvent.report?.reportDate ?? null,
    images: existingEvent.report?.images ?? [],
    tasks: existingEvent.report?.tasks ?? [],
    comment: existingEvent.report?.comment ?? null,
  }
  const reportAfter: Record<string, unknown> = {
    summary: updated.report?.summary ?? null,
    reportDate: updated.report?.reportDate ?? null,
    images: updated.report?.images ?? [],
    tasks: updated.report?.tasks ?? [],
    comment: updated.report?.comment ?? null,
  }
  const reportChanges = buildFieldChanges(reportBefore, reportAfter, reportFieldsTouched)
  Object.entries(reportChanges).forEach(([key, value]) => {
    fieldChanges[`report.${key}`] = value
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: "ADMIN_EVENT_UPDATE",
    entityType: "Event",
    entityId: updated.id,
    metadata: {
      updatedFields,
      moderatorsUpdated: moderatorIds !== null,
      reportUpdated: reportFieldsTouched.length > 0,
      fieldChanges: toAuditValue(fieldChanges),
      moderatorChanges: {
        added: afterModeratorEmails.filter((email) => !beforeModeratorEmails.includes(email)),
        removed: beforeModeratorEmails.filter((email) => !afterModeratorEmails.includes(email)),
        totalBefore: beforeModeratorEmails.length,
        totalAfter: afterModeratorEmails.length,
      },
      eventInfoBefore: buildEventAuditInfo(existingEvent, beforeConfirmed.length, beforeModeratorEmails.length),
      eventInfo: buildEventAuditInfo(updated, afterConfirmed.length, afterModeratorEmails.length),
      reportInfoBefore: buildReportAuditInfo(existingEvent.report),
      reportInfo: buildReportAuditInfo(updated.report),
    },
    ip,
    userAgent,
  })

  return {
    ...updated,
    report: updated.report
      ? {
          ...updated.report,
          reportDate: updated.report.reportDate.toISOString(),
        }
      : null,
    moderators: updated.moderators.map((item) => item.user),
    date: updated.date.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
}

export const deleteAdminEvent = async (eventId: string, adminId: string, req?: NextRequest) => {
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      time: true,
      location: true,
      duration: true,
      responsible: true,
      contact: true,
      category: true,
      maxParticipants: true,
      currentParticipants: true,
      isNews: true,
      removedFromCalendar: true,
      images: true,
      report: {
        select: {
          summary: true,
          reportDate: true,
          images: true,
          tasks: true,
          comment: true,
        },
      },
      eventParticipants: {
        select: {
          status: true,
          user: { select: { email: true } },
        },
      },
      moderators: {
        select: {
          user: { select: { email: true } },
        },
      },
    },
  })

  if (!existingEvent) {
    throw new ServiceError(404, "NOT_FOUND", "Мероприятие не найдено")
  }

  const participantEmails = existingEvent.eventParticipants
    .filter((participant) => participant.status === ParticipantStatus.CONFIRMED)
    .map((participant) => participant.user?.email)
    .filter((email): email is string => Boolean(email))
  const moderatorEmails = existingEvent.moderators
    .map((moderator) => moderator.user?.email)
    .filter((email): email is string => Boolean(email))

  await prisma.event.delete({ where: { id: eventId } })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: "ADMIN_EVENT_DELETE",
    entityType: "Event",
    entityId: eventId,
    metadata: {
      eventInfo: buildEventAuditInfo(existingEvent, participantEmails.length, moderatorEmails.length),
      reportInfo: buildReportAuditInfo(existingEvent.report),
      participantChanges: {
        added: [],
        removed: participantEmails,
        totalBefore: participantEmails.length,
        totalAfter: 0,
      },
      moderatorChanges: {
        added: [],
        removed: moderatorEmails,
        totalBefore: moderatorEmails.length,
        totalAfter: 0,
      },
    },
    ip,
    userAgent,
  })
}
