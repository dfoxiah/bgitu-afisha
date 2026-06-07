/**
 * File responsibility:
 * Orchestration services for event create/update API workflows.
 *
 * Main logic:
 * - Execute business validation around date/category/permissions/relations
 * - Coordinate participants/moderators notifications and audit logging
 * - Return normalized serialized event payloads for route handlers
 *
 * Integrations:
 * - src/app/api/events/route.ts
 * - src/app/api/events/[id]/route.ts
 */

import type { NextRequest } from "next/server"
import { EventCategory, NotificationType, ParticipantStatus, Prisma, Role } from "@prisma/client"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { createEventWithRelations, updateEventWithRelations } from "@/server/events/event-command-service"
import { revalidateEventsCache } from "@/server/events/event-cache"
import { findEventByIdForEdit } from "@/server/events/event-query-service"
import { flattenModerators, serializeReport, splitEventParticipants } from "@/server/events/event-serializer"
import { isValidEventCategory, validEventCategories } from "@/server/events/event-validator"
import { resolveModerators, resolveParticipantUsers } from "@/server/events/participant-service"
import { buildFieldChanges } from "@/server/shared/audit-diff"
import { formatLocalDate, parseLocalDateTime } from "@/server/shared/date-time"
import { ServiceError } from "@/server/shared/service-error"
import { canModerateEventByRole } from "@/server/shared/session"
import type { CreateEventBodyInput, UpdateEventBodyInput } from "@/server/shared/schemas/event-api-schema"
import { buildEmailInsensitiveFilter } from "@/server/shared/user-email"
import { isAdminRole, isModeratorRole } from "@/lib/roles"
import {
  buildEventLink,
  createNotifications,
  type NotificationInput,
} from "@/server/notifications/notification-service"

type EventActor = {
  id: string
  role: Role
  email?: string | null
  name?: string | null
}

const toIsoString = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  return value
}

const buildEventAuditInfo = (
  event: {
    title: string
    category: EventCategory | string
    date: Date | string
    time: string | null
    location: string
    description?: string | null
    duration?: string | null
    maxParticipants: number
    requiresApproval?: boolean
    isNews?: boolean
    removedFromCalendar?: boolean
    images?: string[]
    responsible?: string | null
    contact?: string | null
  },
  participantsCount: number,
  moderatorsCount: number
) => ({
  title: event.title,
  category: String(event.category),
  date: toIsoString(event.date),
  time: event.time || "",
  location: event.location,
  description: event.description || "",
  duration: event.duration || "",
  maxParticipants: event.maxParticipants,
  currentParticipants: participantsCount,
  moderatorsCount,
  imagesCount: Array.isArray(event.images) ? event.images.length : 0,
  requiresApproval: event.requiresApproval !== false,
  isNews: Boolean(event.isNews),
  removedFromCalendar: Boolean(event.removedFromCalendar),
  responsible: event.responsible || "",
  contact: event.contact || "",
})

type EventWithRelations = {
  id: string
  title: string
  category: string
  date: Date | string
  time: string | null
  duration: string | null
  location: string
  description: string
  maxParticipants: number
  currentParticipants?: number
  requiresApproval: boolean
  isPast: boolean
  removedFromCalendar: boolean
  isNews: boolean
  images: string[]
  responsible: string | null
  contact: string | null
  creatorId: string
  creator?: unknown
  createdAt: Date | string
  updatedAt: Date | string
  moderators: Array<{ user: unknown; userId?: string }>
  eventParticipants: Array<{ status: ParticipantStatus; user: unknown; userId?: string }>
  report?: Parameters<typeof serializeReport>[0]
}

const resolveResponsibleAssignee = async (responsibleId?: string) => {
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

export const serializeEventForApi = (event: EventWithRelations) => {
  const { confirmed, pending } = splitEventParticipants(event.eventParticipants)
  const confirmedCount =
    typeof event.currentParticipants === "number" ? event.currentParticipants : confirmed.length

  return {
    ...event,
    currentParticipants: confirmedCount,
    confirmedParticipantsCount: confirmedCount,
    pendingParticipantsCount: pending.length,
    participants: confirmed,
    pendingParticipants: pending,
    moderators: flattenModerators(event.moderators),
    date: toIsoString(event.date),
    createdAt: toIsoString(event.createdAt),
    updatedAt: toIsoString(event.updatedAt),
    report: serializeReport(event.report),
  }
}

export const createEventFromApi = async (params: {
  dto: CreateEventBodyInput
  actor: EventActor
  req: NextRequest
}) => {
  const { dto, actor, req } = params

  if (!isValidEventCategory(dto.category)) {
    throw new ServiceError(400, "VALIDATION_ERROR", `Недопустимая категория: ${dto.category}`, {
      validCategories: validEventCategories,
    })
  }

  const normalizedTime = (dto.time || "").trim() || "14:00"
  const eventDate = parseLocalDateTime(dto.date, normalizedTime)
  if (!eventDate) {
    throw new ServiceError(400, "VALIDATION_ERROR", "Неверный формат даты")
  }

  if (eventDate < new Date()) {
    throw new ServiceError(400, "VALIDATION_ERROR", "Дата мероприятия не может быть в прошлом")
  }

  const creator =
    (await prisma.user.findUnique({ where: { id: actor.id } })) ||
    (actor.email ? await prisma.user.findFirst({ where: buildEmailInsensitiveFilter(actor.email) }) : null)

  if (!creator) {
    throw new ServiceError(
      401,
      "UNAUTHORIZED",
      "Пользователь не найден. Перелогиньтесь и попробуйте снова."
    )
  }

  const participantResolution = await resolveParticipantUsers(dto.participants, dto.participantGroups)
  if (participantResolution.missingEmails.length > 0 || participantResolution.missingGroups.length > 0) {
    const missingParts = [
      participantResolution.missingEmails.length > 0
        ? `email: ${participantResolution.missingEmails.join(", ")}`
        : "",
      participantResolution.missingGroups.length > 0
        ? `группы: ${participantResolution.missingGroups.join(", ")}`
        : "",
    ].filter(Boolean)
    throw new ServiceError(
      400,
      "VALIDATION_ERROR",
      `Не найдены участники: ${missingParts.join("; ")}`
    )
  }

  const maxParticipants = Number(dto.maxParticipants || 0)
  if (maxParticipants > 0 && participantResolution.users.length > maxParticipants) {
    throw new ServiceError(400, "VALIDATION_ERROR", "Количество участников превышает лимит")
  }

  const moderatorResolution = await resolveModerators(dto.moderators, creator.id)
  if (moderatorResolution.missingEmails.length > 0) {
    throw new ServiceError(
      400,
      "VALIDATION_ERROR",
      `Не найдены преподаватели/редакторы: ${moderatorResolution.missingEmails.join(", ")}`
    )
  }

  const responsibleAssignee = await resolveResponsibleAssignee(dto.responsibleId)

  const created = await createEventWithRelations({
    title: dto.title,
    category: dto.category,
    date: eventDate,
    time: normalizedTime,
    duration: dto.duration?.trim() || "2 часа",
    location: dto.location,
    description: dto.description,
    maxParticipants,
    requiresApproval: dto.requiresApproval !== false,
    isNews: Boolean(dto.isNews),
    images: Array.isArray(dto.images) ? dto.images : [],
    responsible:
      dto.responsible?.trim() ||
      responsibleAssignee?.name ||
      responsibleAssignee?.email ||
      actor.name ||
      "Не указан",
    contact: dto.contact?.trim() || responsibleAssignee?.email || actor.email || "",
    creatorId: creator.id,
    participantIds: participantResolution.users.map((user) => user.id),
    moderatorIds: moderatorResolution.users.map((user) => user.id),
  })

  const participantEmails = created.eventParticipants
    .filter((participant) => participant.status === ParticipantStatus.CONFIRMED)
    .map((participant) => participant.user?.email)
    .filter((email): email is string => Boolean(email))

  const moderatorEmails = created.moderators
    .map((moderator) => moderator.user?.email)
    .filter((email): email is string => Boolean(email))

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: actor.id,
    action: "EVENT_CREATE",
    entityType: "Event",
    entityId: created.id,
    metadata: {
      title: created.title,
      eventInfo: buildEventAuditInfo(created, participantEmails.length, moderatorEmails.length),
      participantChanges: {
        added: participantEmails,
        removed: [],
        totalAfter: participantEmails.length,
      },
      moderatorChanges: {
        added: moderatorEmails,
        removed: [],
        totalAfter: moderatorEmails.length,
      },
    },
    ip,
    userAgent,
  })

  try {
    const eventDateText = new Date(created.date).toLocaleDateString("ru-RU")
    const timeText = created.time ? ` ${created.time}` : ""
    const locationText = created.location ? `, место: ${created.location}` : ""
    const participantIds = participantResolution.users.map((user) => user.id)
    const moderatorIds = moderatorResolution.users.map((user) => user.id)

    const notifications: NotificationInput[] = []

    const changeRecipients = await prisma.user.findMany({
      where: {
        id: { in: [...participantIds, ...moderatorIds] },
        notifyChanges: true,
      },
      select: { id: true },
    })
    const changeRecipientIds = new Set(changeRecipients.map((user) => user.id))

    participantIds.forEach((userId) => {
      if (!changeRecipientIds.has(userId)) return
      notifications.push({
        userId,
        title: "Добавление в мероприятие",
        content: `Вас добавили в мероприятие «${created.title}». Дата: ${eventDateText}${timeText}${locationText}`,
        type: NotificationType.PARTICIPANT_ADDED,
        link: buildEventLink(created.id),
        read: false,
        metadata: { eventId: created.id, action: "participant_added" },
      })
    })

    moderatorIds.forEach((userId) => {
      if (!changeRecipientIds.has(userId)) return
      notifications.push({
        userId,
        title: "Назначение модератором",
        content: `Вас назначили модератором мероприятия «${created.title}». Дата: ${eventDateText}${timeText}${locationText}`,
        type: NotificationType.ROLE_ASSIGNED,
        link: buildEventLink(created.id),
        read: false,
        metadata: { eventId: created.id, action: "moderator_added" },
      })
    })

    const excludedIds = new Set<string>([creator.id, ...participantIds, ...moderatorIds])
    const audienceWhere: Prisma.UserWhereInput = {
      id: { notIn: Array.from(excludedIds) },
      OR: [
        { notificationCategories: { isEmpty: true } },
        { notificationCategories: { has: created.category as EventCategory } },
      ],
    }

    if (created.isNews || created.category === EventCategory.NEWS) {
      audienceWhere.notifyNews = true
    } else {
      audienceWhere.notifyNewEvents = true
    }

    const audience = await prisma.user.findMany({
      where: audienceWhere,
      select: { id: true },
    })

    const isNewsEvent = created.isNews || created.category === EventCategory.NEWS
    const title = isNewsEvent ? "Новая новость" : "Новое мероприятие"
    const content = isNewsEvent
      ? `Новая новость: «${created.title}». ${eventDateText}${timeText}`
      : `Новое мероприятие: «${created.title}». Дата: ${eventDateText}${timeText}${locationText}`

    audience.forEach((recipient) => {
      notifications.push({
        userId: recipient.id,
        title,
        content,
        type: NotificationType.NEW,
        link: buildEventLink(created.id),
        read: false,
        metadata: { eventId: created.id, action: "event_new" },
      })
    })

    if (notifications.length > 0) {
      await createNotifications(notifications)
    }
  } catch (notificationError) {
    console.error("createEventFromApi notifications error", notificationError)
  }

  revalidateEventsCache()

  return {
    serialized: serializeEventForApi(created as unknown as EventWithRelations),
    createdId: created.id,
  }
}

export const updateEventFromApi = async (params: {
  eventId: string
  body: UpdateEventBodyInput
  actor: EventActor
  req: NextRequest
}) => {
  const { eventId, body, actor, req } = params
  const event = await findEventByIdForEdit(eventId)

  if (!event) {
    throw new ServiceError(404, "NOT_FOUND", "Мероприятие не найдено")
  }

  const moderatorIdsBefore = event.moderators.map((moderator) => moderator.userId)
  const canModerate = canModerateEventByRole({
    role: actor.role,
    userId: actor.id,
    creatorId: event.creatorId,
    moderatorIds: moderatorIdsBefore,
  })

  if (!canModerate) {
    throw new ServiceError(403, "FORBIDDEN", "Недостаточно прав для редактирования")
  }

  const updateData: Record<string, unknown> = {}
  let confirmedParticipantIds: string[] | null = null
  let moderatorIds: string[] | null = null

  if (body.responsibleId !== undefined) {
    const responsibleAssignee = await resolveResponsibleAssignee(body.responsibleId)
    if (responsibleAssignee) {
      updateData.responsible = responsibleAssignee.name || responsibleAssignee.email
      if (body.contact === undefined) {
        updateData.contact = responsibleAssignee.email
      }
    } else {
      updateData.responsible = null
      if (body.contact === undefined) {
        updateData.contact = ""
      }
    }
  }

  if (body.title) updateData.title = body.title
  if (body.description) updateData.description = body.description
  if (body.location) updateData.location = body.location
  if (body.duration) updateData.duration = body.duration
  if (body.responsible) updateData.responsible = body.responsible
  if (body.contact) updateData.contact = body.contact

  if (body.category !== undefined) {
    if (!isValidEventCategory(body.category)) {
      throw new ServiceError(400, "VALIDATION_ERROR", `Недопустимая категория: ${body.category}`)
    }
    updateData.category = body.category
  }

  if (body.maxParticipants !== undefined) {
    updateData.maxParticipants = Number(body.maxParticipants) || 0
  }

  if (body.requiresApproval !== undefined) {
    updateData.requiresApproval = body.requiresApproval
  }

  if (Array.isArray(body.images)) {
    updateData.images = body.images.map((value) => String(value))
  }

  if (body.date !== undefined || body.time !== undefined) {
    const incomingDate = body.date !== undefined ? String(body.date) : formatLocalDate(new Date(event.date))
    const incomingTime = body.time !== undefined ? String(body.time).trim() : event.time || "00:00"

    const parsedDate = parseLocalDateTime(incomingDate, incomingTime)
    if (!parsedDate) {
      throw new ServiceError(400, "VALIDATION_ERROR", "Неверный формат даты")
    }

    if (parsedDate < new Date()) {
      throw new ServiceError(400, "VALIDATION_ERROR", "Дата мероприятия не может быть в прошлом")
    }

    updateData.date = parsedDate
    if (body.time !== undefined) {
      updateData.time = incomingTime
    }
  }

  if (Array.isArray(body.participants) || Array.isArray(body.participantGroups)) {
    const participantResolution = await resolveParticipantUsers(body.participants, body.participantGroups)
    if (participantResolution.missingEmails.length > 0 || participantResolution.missingGroups.length > 0) {
      const missingParts = [
        participantResolution.missingEmails.length > 0
          ? `email: ${participantResolution.missingEmails.join(", ")}`
          : "",
        participantResolution.missingGroups.length > 0
          ? `группы: ${participantResolution.missingGroups.join(", ")}`
          : "",
      ].filter(Boolean)
      throw new ServiceError(
        400,
        "VALIDATION_ERROR",
        `Не найдены участники: ${missingParts.join("; ")}`
      )
    }

    const maxAllowed =
      updateData.maxParticipants !== undefined ? Number(updateData.maxParticipants) : event.maxParticipants
    if (maxAllowed > 0 && participantResolution.users.length > maxAllowed) {
      throw new ServiceError(400, "VALIDATION_ERROR", "Количество участников превышает лимит")
    }

    confirmedParticipantIds = participantResolution.users.map((user) => user.id)
  }

  if (Array.isArray(body.moderators)) {
    const isOwner = event.creatorId === actor.id
    if (!isAdminRole(actor.role) && !isOwner) {
      throw new ServiceError(
        403,
        "FORBIDDEN",
        "Только создатель или администратор может изменять модераторов"
      )
    }

    const moderatorResolution = await resolveModerators(body.moderators, event.creatorId)
    if (moderatorResolution.missingEmails.length > 0) {
      throw new ServiceError(
        400,
        "VALIDATION_ERROR",
        `Не найдены преподаватели/редакторы: ${moderatorResolution.missingEmails.join(", ")}`
      )
    }

    moderatorIds = moderatorResolution.users.map((user) => user.id)
  }

  if (body.requiresApproval === false && event.requiresApproval) {
    const pendingParticipantIds = event.eventParticipants
      .filter((participant) => participant.status === ParticipantStatus.PENDING)
      .map((participant) => participant.userId)

    if (pendingParticipantIds.length > 0) {
      const baseConfirmedIds =
        confirmedParticipantIds ??
        event.eventParticipants
          .filter((participant) => participant.status === ParticipantStatus.CONFIRMED)
          .map((participant) => participant.userId)

      const nextConfirmedIds = Array.from(new Set([...baseConfirmedIds, ...pendingParticipantIds]))
      const maxAllowed =
        updateData.maxParticipants !== undefined ? Number(updateData.maxParticipants) : event.maxParticipants

      if (maxAllowed > 0 && nextConfirmedIds.length > maxAllowed) {
        throw new ServiceError(
          400,
          "VALIDATION_ERROR",
          "Невозможно отключить подтверждение: превышен лимит участников. Увеличьте лимит или обработайте заявки."
        )
      }

      confirmedParticipantIds = nextConfirmedIds
    }
  }

  const updated = await updateEventWithRelations({
    eventId,
    updateData,
    moderatorIds,
    confirmedParticipantIds,
  })

  if (!updated) {
    throw new ServiceError(404, "NOT_FOUND", "Мероприятие не найдено")
  }

  const { confirmed } = splitEventParticipants(updated.eventParticipants)

  try {
    const existingParticipantIds = event.eventParticipants.map((participant) => participant.userId)
    const existingPendingIds = event.eventParticipants
      .filter((participant) => participant.status === ParticipantStatus.PENDING)
      .map((participant) => participant.userId)
    const newlyAddedParticipantIds = confirmedParticipantIds
      ? confirmedParticipantIds.filter((id) => !existingParticipantIds.includes(id))
      : []
    const newlyConfirmedIds = confirmedParticipantIds
      ? confirmedParticipantIds.filter((id) => existingPendingIds.includes(id))
      : []
    const newlyAddedModeratorIds = moderatorIds
      ? moderatorIds.filter((id) => !moderatorIdsBefore.includes(id))
      : []

    const eventDateText = new Date(updated.date).toLocaleDateString("ru-RU")
    const timeText = updated.time ? ` ${updated.time}` : ""
    const locationText = updated.location ? `, место: ${updated.location}` : ""

    const notifications: NotificationInput[] = []

    const loadRecipients = async (ids: string[]) => {
      if (ids.length === 0) return new Set<string>()
      const users = await prisma.user.findMany({
        where: { id: { in: ids }, notifyChanges: true },
        select: { id: true },
      })
      return new Set(users.map((user) => user.id))
    }

    const addedRecipients = await loadRecipients([
      ...newlyAddedParticipantIds,
      ...newlyConfirmedIds,
      ...newlyAddedModeratorIds,
    ])

    newlyAddedParticipantIds.forEach((userId) => {
      if (!addedRecipients.has(userId) || userId === actor.id) return
      notifications.push({
        userId,
        title: "Добавление в мероприятие",
        content: `Вас добавили в мероприятие «${updated.title}». Дата: ${eventDateText}${timeText}${locationText}`,
        type: NotificationType.PARTICIPANT_ADDED,
        link: buildEventLink(updated.id),
        read: false,
        metadata: { eventId: updated.id, action: "participant_added" },
      })
    })

    newlyConfirmedIds.forEach((userId) => {
      if (!addedRecipients.has(userId) || userId === actor.id) return
      notifications.push({
        userId,
        title: "Участие подтверждено",
        content: `Ваше участие в мероприятии «${updated.title}» подтверждено. Дата: ${eventDateText}${timeText}${locationText}`,
        type: NotificationType.PARTICIPATION_STATUS_CHANGED,
        link: buildEventLink(updated.id),
        read: false,
        metadata: { eventId: updated.id, action: "participant_confirmed" },
      })
    })

    newlyAddedModeratorIds.forEach((userId) => {
      if (!addedRecipients.has(userId) || userId === actor.id) return
      notifications.push({
        userId,
        title: "Назначение модератором",
        content: `Вас назначили модератором мероприятия «${updated.title}». Дата: ${eventDateText}${timeText}${locationText}`,
        type: NotificationType.ROLE_ASSIGNED,
        link: buildEventLink(updated.id),
        read: false,
        metadata: { eventId: updated.id, action: "moderator_added" },
      })
    })

    const changedFields = Object.keys(updateData)
    if (changedFields.length > 0) {
      const fieldLabels: Record<string, string> = {
        title: "название",
        description: "описание",
        location: "место",
        duration: "длительность",
        responsible: "ответственный",
        contact: "контакт",
        category: "категория",
        maxParticipants: "лимит участников",
        requiresApproval: "подтверждение участников",
        images: "фотографии",
        date: "дата",
        time: "время",
      }

      const updatedFieldNames = changedFields
        .map((field) => fieldLabels[field])
        .filter((value): value is string => Boolean(value))
      const changeSummary =
        updatedFieldNames.length > 0
          ? `Обновлены: ${updatedFieldNames.join(", ")}.`
          : "Обновлены детали мероприятия."

      const audienceIds = new Set<string>()
      updated.eventParticipants.forEach((participant) => {
        if (participant.user?.id) audienceIds.add(participant.user.id)
      })
      updated.moderators.forEach((moderator) => {
        if (moderator.user?.id) audienceIds.add(moderator.user.id)
      })
      audienceIds.delete(actor.id)

      const recipients = await loadRecipients(Array.from(audienceIds))
      Array.from(recipients).forEach((userId) => {
        notifications.push({
          userId,
          title: "Изменение мероприятия",
          content: `Мероприятие «${updated.title}» было обновлено. ${changeSummary} Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.CHANGE,
          link: buildEventLink(updated.id),
          read: false,
          metadata: { eventId: updated.id, action: "event_updated" },
        })
      })
    }

    if (notifications.length > 0) {
      await createNotifications(notifications)
    }
  } catch (notificationError) {
    console.error("updateEventFromApi notifications error", notificationError)
  }

  const beforeConfirmedParticipantEmails = event.eventParticipants
    .filter((participant) => participant.status === ParticipantStatus.CONFIRMED)
    .map((participant) => participant.user?.email)
    .filter((email): email is string => Boolean(email))
  const afterConfirmedParticipantEmails = confirmed
    .map((participant) => participant?.email)
    .filter((email): email is string => Boolean(email))

  const beforeModeratorEmails = event.moderators
    .map((moderator) => moderator.user?.email)
    .filter((email): email is string => Boolean(email))
  const afterModeratorEmails = updated.moderators
    .map((moderator) => moderator.user?.email)
    .filter((email): email is string => Boolean(email))

  const updatedFields = Object.keys(updateData)
  const fieldChanges = buildFieldChanges(
    {
      title: event.title,
      description: event.description,
      location: event.location,
      duration: event.duration,
      responsible: event.responsible,
      contact: event.contact,
      category: event.category,
      maxParticipants: event.maxParticipants,
      requiresApproval: event.requiresApproval,
      images: event.images,
      date: event.date,
      time: event.time,
      isNews: event.isNews,
      removedFromCalendar: event.removedFromCalendar,
    },
    {
      title: updated.title,
      description: updated.description,
      location: updated.location,
      duration: updated.duration,
      responsible: updated.responsible,
      contact: updated.contact,
      category: updated.category,
      maxParticipants: updated.maxParticipants,
      requiresApproval: updated.requiresApproval,
      images: updated.images,
      date: updated.date,
      time: updated.time,
      isNews: updated.isNews,
      removedFromCalendar: updated.removedFromCalendar,
    },
    updatedFields
  )

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: actor.id,
    action: "EVENT_UPDATE",
    entityType: "Event",
    entityId: updated.id,
    metadata: {
      updatedFields,
      fieldChanges,
      participantsUpdated: confirmedParticipantIds !== null,
      participantChanges: {
        added: afterConfirmedParticipantEmails.filter(
          (email) => !beforeConfirmedParticipantEmails.includes(email)
        ),
        removed: beforeConfirmedParticipantEmails.filter(
          (email) => !afterConfirmedParticipantEmails.includes(email)
        ),
        totalBefore: beforeConfirmedParticipantEmails.length,
        totalAfter: afterConfirmedParticipantEmails.length,
      },
      moderatorsUpdated: moderatorIds !== null,
      moderatorChanges: {
        added: afterModeratorEmails.filter((email) => !beforeModeratorEmails.includes(email)),
        removed: beforeModeratorEmails.filter((email) => !afterModeratorEmails.includes(email)),
        totalBefore: beforeModeratorEmails.length,
        totalAfter: afterModeratorEmails.length,
      },
      eventInfoBefore: buildEventAuditInfo(
        event,
        beforeConfirmedParticipantEmails.length,
        beforeModeratorEmails.length
      ),
      eventInfo: buildEventAuditInfo(updated, afterConfirmedParticipantEmails.length, afterModeratorEmails.length),
    },
    ip,
    userAgent,
  })

  revalidateEventsCache()

  return serializeEventForApi(updated as unknown as EventWithRelations)
}
