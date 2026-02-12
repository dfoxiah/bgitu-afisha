import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EventCategory, NotificationType, ParticipantStatus, Prisma } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

const isAdminSession = (session: any) => session?.user?.id && session.user.role === 'ADMIN'

const parseDateTime = (dateString: string, timeString?: string): Date | null => {
  try {
    if (!dateString) return null
    if (dateString.includes('T')) {
      const parsed = new Date(dateString)
      if (isNaN(parsed.getTime())) return null
      if (timeString) {
        const [hours, minutes] = timeString.split(':').map(Number)
        if (Number.isFinite(hours) && Number.isFinite(minutes)) {
          parsed.setHours(hours, minutes, 0, 0)
        }
      }
      return parsed
    }

    const [year, month, day] = dateString.split('-').map(Number)
    if (!year || !month || !day) return null

    let hours = 0
    let minutes = 0
    if (timeString) {
      const parts = timeString.split(':').map(Number)
      if (parts.length >= 2) {
        hours = parts[0]
        minutes = parts[1]
      }
    }
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const toAuditValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    return value.map(item => {
      if (item instanceof Date) return item.toISOString()
      if (item === null || item === undefined) return null
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return item
      return String(item)
    })
  }
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

const buildFieldChanges = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
) => {
  const changes: Record<string, { before: unknown; after: unknown }> = {}
  fields.forEach(field => {
    const beforeValue = toAuditValue(before[field])
    const afterValue = toAuditValue(after[field])
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[field] = { before: beforeValue, after: afterValue }
    }
  })
  return changes
}

const buildEventAuditInfo = (
  event: {
    title: string
    category: EventCategory | string
    date: Date
    time: string | null
    location: string
    description?: string | null
    duration?: string | null
    maxParticipants: number
    currentParticipants?: number
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
  date: event.date.toISOString(),
  time: event.time || '',
  location: event.location,
  description: event.description || '',
  duration: event.duration || '',
  maxParticipants: event.maxParticipants,
  currentParticipants: participantsCount,
  moderatorsCount,
  imagesCount: Array.isArray(event.images) ? event.images.length : 0,
  isNews: Boolean(event.isNews),
  removedFromCalendar: Boolean(event.removedFromCalendar),
  responsible: event.responsible || '',
  contact: event.contact || ''
})

const buildReportAuditInfo = (report: {
  summary: string
  reportDate: Date
  images: string[]
  tasks: string[]
  comment: string | null
} | null | undefined) => {
  if (!report) return null
  return {
    summary: report.summary,
    reportDate: report.reportDate.toISOString(),
    imagesCount: Array.isArray(report.images) ? report.images.length : 0,
    tasksCount: Array.isArray(report.tasks) ? report.tasks.length : 0,
    comment: report.comment || ''
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { id } = await params
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
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
              createdAt: true
            }
          }
        }
      },
      creator: {
        select: { id: true, name: true, email: true, role: true }
      },
      moderators: {
        select: { user: { select: { id: true, name: true, email: true, role: true } } }
      }
    }
  })

  if (!event) {
    return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })
  }

  const confirmed = event.eventParticipants.filter(p => p.status === ParticipantStatus.CONFIRMED).map(p => p.user)
  const pending = event.eventParticipants.filter(p => p.status === ParticipantStatus.PENDING).map(p => p.user)

  return NextResponse.json({
    ...event,
    currentParticipants: confirmed.length,
    participants: confirmed,
    pendingParticipants: pending,
    moderators: event.moderators.map(m => m.user),
    date: event.date.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    report: event.report
      ? {
          ...event.report,
          reportDate: event.report.reportDate.toISOString(),
          createdAt: event.report.createdAt.toISOString(),
          updatedAt: event.report.updatedAt.toISOString()
        }
      : null
  })
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const adminId = session!.user!.id

  const { id } = await params
  const existingEvent = await prisma.event.findUnique({
    where: { id },
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
          comment: true
        }
      },
      eventParticipants: {
        select: {
          userId: true,
          status: true,
          user: {
            select: {
              email: true
            }
          }
        }
      },
      moderators: {
        select: {
          userId: true,
          user: {
            select: {
              email: true
            }
          }
        }
      }
    }
  })

  if (!existingEvent) {
    return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })
  }

  const body = await req.json()
  const updateData: any = {}
  let moderatorIds: string[] | null = null
  let reportPayload: {
    summary?: string
    reportDate?: Date
    images?: string[]
    tasks?: string[]
    comment?: string | null
  } | null = null

  if (body.title) updateData.title = String(body.title).trim()
  if (body.description) updateData.description = String(body.description).trim()
  if (body.location) updateData.location = String(body.location).trim()
  if (body.duration) updateData.duration = String(body.duration).trim()
  if (body.responsible) updateData.responsible = String(body.responsible).trim()
  if (body.contact) updateData.contact = String(body.contact).trim()
  if (body.isNews !== undefined) updateData.isNews = Boolean(body.isNews)
  if (body.removedFromCalendar !== undefined) updateData.removedFromCalendar = Boolean(body.removedFromCalendar)

  if (body.category) {
    if (!Object.values(EventCategory).includes(body.category as EventCategory)) {
      return NextResponse.json({ error: `Недопустимая категория: ${body.category}` }, { status: 400 })
    }
    updateData.category = body.category
  }

  if (body.maxParticipants !== undefined) {
    updateData.maxParticipants = parseInt(body.maxParticipants) || 0
  }

  if (Array.isArray(body.images)) {
    updateData.images = body.images
  }

  if (body.report && typeof body.report === 'object') {
    const reportInput = body.report as Record<string, any>
    const summary = reportInput.summary !== undefined ? String(reportInput.summary).trim() : undefined
    const comment = reportInput.comment !== undefined ? String(reportInput.comment).trim() : undefined
    const reportDateRaw = reportInput.reportDate !== undefined ? String(reportInput.reportDate).trim() : undefined
    let reportDate: Date | undefined
    if (reportDateRaw) {
      const parsedReportDate = parseDateTime(reportDateRaw)
      if (!parsedReportDate) {
        return NextResponse.json({ error: 'Неверный формат даты отчёта' }, { status: 400 })
      }
      reportDate = parsedReportDate
    }

    const images = Array.isArray(reportInput.images)
      ? reportInput.images.map((value: any) => String(value).trim()).filter(Boolean)
      : undefined

    let tasks: string[] | undefined
    if (Array.isArray(reportInput.tasks)) {
      tasks = reportInput.tasks.map((value: any) => String(value).trim()).filter(Boolean)
    } else if (typeof reportInput.tasks === 'string') {
      tasks = reportInput.tasks
        .split(/\r?\n/g)
        .map((value: string) => value.trim())
        .filter(Boolean)
    }

    reportPayload = { summary, comment, reportDate, images, tasks }
  }

  if (body.date || body.time) {
    const formatLocalDate = (date: Date) => {
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const incomingDate = body.date ? String(body.date) : formatLocalDate(new Date(existingEvent.date))
    const incomingTime = body.time ? String(body.time).trim() : (existingEvent.time || '00:00')

    const parsedDate = parseDateTime(incomingDate, incomingTime)
    if (!parsedDate) {
      return NextResponse.json({ error: 'Неверный формат даты' }, { status: 400 })
    }

    updateData.date = parsedDate
    if (body.time) {
      updateData.time = incomingTime
    }
  }

  if (Array.isArray(body.moderators)) {
    const moderatorEmails = (body.moderators as unknown[])
      .map(value => String(value).trim())
      .filter((email): email is string => Boolean(email))
    const uniqueModeratorEmails = Array.from(new Set<string>(moderatorEmails))

    if (uniqueModeratorEmails.length === 0) {
      moderatorIds = []
    } else {
      const moderatorUsers = await prisma.user.findMany({
        where: {
          email: { in: uniqueModeratorEmails },
          role: { in: ['TEACHER', 'ADMIN'] }
        },
        select: { id: true, email: true }
      })

      const foundEmails = new Set(moderatorUsers.map(u => u.email))
      const missingEmails = uniqueModeratorEmails.filter(email => !foundEmails.has(email))
      if (missingEmails.length > 0) {
        return NextResponse.json({ error: `Не найдены преподаватели: ${missingEmails.join(', ')}` }, { status: 400 })
      }

      moderatorIds = moderatorUsers.map(u => u.id)
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.event.update({
        where: { id },
        data: updateData
      })
    }

    if (reportPayload && (
      reportPayload.summary !== undefined ||
      reportPayload.reportDate !== undefined ||
      reportPayload.images !== undefined ||
      reportPayload.tasks !== undefined ||
      reportPayload.comment !== undefined
    )) {
      const existingReport = await tx.eventReport.findUnique({ where: { eventId: id } })
      if (existingReport) {
        const reportUpdate: Prisma.EventReportUpdateInput = {}
        if (reportPayload.summary !== undefined) reportUpdate.summary = reportPayload.summary
        if (reportPayload.reportDate !== undefined) reportUpdate.reportDate = reportPayload.reportDate
        if (reportPayload.images !== undefined) reportUpdate.images = reportPayload.images
        if (reportPayload.tasks !== undefined) reportUpdate.tasks = reportPayload.tasks
        if (reportPayload.comment !== undefined) reportUpdate.comment = reportPayload.comment
        if (Object.keys(reportUpdate).length > 0) {
          await tx.eventReport.update({
            where: { eventId: id },
            data: reportUpdate
          })
        }
      } else {
        await tx.eventReport.create({
          data: {
            eventId: id,
            summary: reportPayload.summary !== undefined
              ? reportPayload.summary
              : updateData.description || existingEvent.description || existingEvent.title,
            reportDate: reportPayload.reportDate || new Date(existingEvent.date),
            tasks: reportPayload.tasks || [],
            activeParticipants: [],
            images: reportPayload.images || [],
            comment: reportPayload.comment ?? null
          }
        })
      }
    }

    if (moderatorIds !== null) {
      await tx.eventModerator.deleteMany({
        where: {
          eventId: id,
          userId: { notIn: moderatorIds.length > 0 ? moderatorIds : ['__none__'] }
        }
      })
      if (moderatorIds.length > 0) {
        await tx.eventModerator.createMany({
          data: moderatorIds.map(userId => ({ eventId: id, userId })),
          skipDuplicates: true
        })
      }
    }

  })

  const updated = await prisma.event.findUnique({
    where: { id },
    include: {
      report: {
        select: {
          summary: true,
          reportDate: true,
          images: true,
          tasks: true,
          comment: true
        }
      },
      eventParticipants: {
        select: {
          status: true,
          user: {
            select: { id: true, email: true }
          }
        }
      },
      creator: { select: { id: true, name: true, email: true, role: true } },
      moderators: {
        select: { user: { select: { id: true, name: true, email: true, role: true } } }
      }
    }
  })

  if (!updated) {
    return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })
  }

  try {
    const existingModeratorIds = existingEvent.moderators.map(m => m.userId)
    const currentModeratorIds = moderatorIds ?? existingModeratorIds
    const newlyAddedModeratorIds = moderatorIds
      ? moderatorIds.filter(idValue => !existingModeratorIds.includes(idValue))
      : []

    const eventDateText = new Date(updated.date).toLocaleDateString('ru-RU')
    const timeText = updated.time ? ` ${updated.time}` : ''
    const locationText = updated.location ? `, место: ${updated.location}` : ''

    const notifications: Prisma.NotificationCreateManyInput[] = []

    const loadChangeRecipients = async (ids: string[]) => {
      if (ids.length === 0) return new Set<string>()
      const users = await prisma.user.findMany({
        where: { id: { in: ids }, notifyChanges: true },
        select: { id: true }
      })
      return new Set(users.map(user => user.id))
    }

    const addedRecipients = await loadChangeRecipients(newlyAddedModeratorIds)
    for (const userId of newlyAddedModeratorIds) {
      if (!addedRecipients.has(userId) || userId === adminId) continue
      notifications.push({
        userId,
        title: 'Назначение модератором',
        content: `Вас назначили модератором мероприятия «${updated.title}». Дата: ${eventDateText}${timeText}${locationText}`,
        type: NotificationType.EVENT,
        read: false,
        metadata: { eventId: updated.id, action: 'moderator_added' }
      })
    }

    const changedFields = Object.keys(updateData)
    if (changedFields.length > 0) {
      const fieldLabels: Record<string, string> = {
        title: 'название',
        description: 'описание',
        location: 'место',
        duration: 'длительность',
        responsible: 'ответственный',
        contact: 'контакт',
        category: 'категория',
        maxParticipants: 'лимит участников',
        images: 'фотографии',
        date: 'дата',
        time: 'время',
        isNews: 'статус новости',
        removedFromCalendar: 'отображение'
      }
      const updatedFieldNames = changedFields
        .map(field => fieldLabels[field])
        .filter(Boolean)
      const changeSummary = updatedFieldNames.length > 0
        ? `Обновлены: ${updatedFieldNames.join(', ')}.`
        : 'Обновлены детали мероприятия.'

      const changeAudienceIds = new Set<string>()
      existingEvent.eventParticipants.forEach(participant => {
        changeAudienceIds.add(participant.userId)
      })
      currentModeratorIds.forEach(userId => changeAudienceIds.add(userId))
      changeAudienceIds.delete(adminId)

      const changeRecipients = await loadChangeRecipients(Array.from(changeAudienceIds))
      for (const userId of Array.from(changeRecipients)) {
        notifications.push({
          userId,
          title: 'Изменение мероприятия',
          content: `Мероприятие «${updated.title}» было обновлено. ${changeSummary} Дата: ${eventDateText}${timeText}${locationText}`,
          type: NotificationType.CHANGE,
          read: false,
          metadata: { eventId: updated.id, action: 'event_updated' }
        })
      }
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications })
    }
  } catch (notifyError) {
    console.error('Admin event notifications error:', notifyError)
  }

  const beforeModeratorEmails = existingEvent.moderators
    .map(moderator => moderator.user?.email)
    .filter((email): email is string => Boolean(email))
  const afterModeratorEmails = updated.moderators
    .map(moderator => moderator.user?.email)
    .filter((email): email is string => Boolean(email))
  const addedModeratorEmails = afterModeratorEmails
    .filter(email => !beforeModeratorEmails.includes(email))
  const removedModeratorEmails = beforeModeratorEmails
    .filter(email => !afterModeratorEmails.includes(email))

  const beforeConfirmedParticipants = existingEvent.eventParticipants
    .filter(participant => participant.status === ParticipantStatus.CONFIRMED)
  const afterConfirmedParticipants = updated.eventParticipants
    .filter(participant => participant.status === ParticipantStatus.CONFIRMED)

  const updatedFields = Object.keys(updateData)
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
    removedFromCalendar: existingEvent.removedFromCalendar
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
    removedFromCalendar: updated.removedFromCalendar
  }
  const fieldChanges = buildFieldChanges(eventBeforeFields, eventAfterFields, updatedFields)

  const reportFieldsTouched = reportPayload
    ? ([
        reportPayload.summary !== undefined ? 'summary' : null,
        reportPayload.reportDate !== undefined ? 'reportDate' : null,
        reportPayload.images !== undefined ? 'images' : null,
        reportPayload.tasks !== undefined ? 'tasks' : null,
        reportPayload.comment !== undefined ? 'comment' : null
      ].filter(Boolean) as string[])
    : []
  const reportBeforeFields: Record<string, unknown> = {
    summary: existingEvent.report?.summary ?? null,
    reportDate: existingEvent.report?.reportDate ?? null,
    images: existingEvent.report?.images ?? [],
    tasks: existingEvent.report?.tasks ?? [],
    comment: existingEvent.report?.comment ?? null
  }
  const reportAfterFields: Record<string, unknown> = {
    summary: updated.report?.summary ?? null,
    reportDate: updated.report?.reportDate ?? null,
    images: updated.report?.images ?? [],
    tasks: updated.report?.tasks ?? [],
    comment: updated.report?.comment ?? null
  }
  const reportFieldChanges = buildFieldChanges(reportBeforeFields, reportAfterFields, reportFieldsTouched)
  for (const [key, value] of Object.entries(reportFieldChanges)) {
    fieldChanges[`report.${key}`] = value
  }

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: 'ADMIN_EVENT_UPDATE',
    entityType: 'Event',
    entityId: updated.id,
    metadata: {
      updatedFields,
      moderatorsUpdated: moderatorIds !== null,
      reportUpdated: reportFieldsTouched.length > 0,
      fieldChanges,
      moderatorChanges: {
        added: addedModeratorEmails,
        removed: removedModeratorEmails,
        totalBefore: beforeModeratorEmails.length,
        totalAfter: afterModeratorEmails.length
      },
      eventInfoBefore: buildEventAuditInfo(
        existingEvent,
        beforeConfirmedParticipants.length,
        beforeModeratorEmails.length
      ),
      eventInfo: buildEventAuditInfo(
        updated,
        afterConfirmedParticipants.length,
        afterModeratorEmails.length
      ),
      reportInfoBefore: buildReportAuditInfo(existingEvent.report),
      reportInfo: buildReportAuditInfo(updated.report)
    },
    ip,
    userAgent
  })

  const { eventParticipants: _eventParticipants, ...updatedWithoutParticipants } = updated
  return NextResponse.json({
    ...updatedWithoutParticipants,
    report: updated.report
      ? {
          ...updated.report,
          reportDate: updated.report.reportDate.toISOString()
        }
      : null,
    moderators: updated.moderators.map(m => m.user),
    date: updated.date.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString()
  })
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const adminId = session!.user!.id

  const { id } = await params
  const existingEvent = await prisma.event.findUnique({
    where: { id },
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
          comment: true
        }
      },
      eventParticipants: {
        select: {
          status: true,
          user: {
            select: { email: true }
          }
        }
      },
      moderators: {
        select: {
          user: {
            select: { email: true }
          }
        }
      }
    }
  })
  if (!existingEvent) {
    return NextResponse.json({ error: 'РњРµСЂРѕРїСЂРёСЏС‚РёРµ РЅРµ РЅР°Р№РґРµРЅРѕ' }, { status: 404 })
  }

  const confirmedParticipantEmails = existingEvent.eventParticipants
    .filter(participant => participant.status === ParticipantStatus.CONFIRMED)
    .map(participant => participant.user?.email)
    .filter((email): email is string => Boolean(email))
  const moderatorEmails = existingEvent.moderators
    .map(moderator => moderator.user?.email)
    .filter((email): email is string => Boolean(email))

  await prisma.event.delete({
    where: { id }
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: 'ADMIN_EVENT_DELETE',
    entityType: 'Event',
    entityId: id,
    metadata: {
      eventInfo: buildEventAuditInfo(
        existingEvent,
        confirmedParticipantEmails.length,
        moderatorEmails.length
      ),
      reportInfo: buildReportAuditInfo(existingEvent.report),
      participantChanges: {
        added: [],
        removed: confirmedParticipantEmails,
        totalBefore: confirmedParticipantEmails.length,
        totalAfter: 0
      },
      moderatorChanges: {
        added: [],
        removed: moderatorEmails,
        totalBefore: moderatorEmails.length,
        totalAfter: 0
      }
    },
    ip,
    userAgent
  })

  return NextResponse.json({ success: true })
}
