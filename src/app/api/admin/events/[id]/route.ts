import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EventCategory, ParticipantStatus } from '@prisma/client'
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
  const body = await req.json()
  const updateData: any = {}
  let moderatorIds: string[] | null = null

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

  if (body.date || body.time) {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { date: true, time: true }
    })
    if (!event) {
      return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })
    }

    const formatLocalDate = (date: Date) => {
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const incomingDate = body.date ? String(body.date) : formatLocalDate(new Date(event.date))
    const incomingTime = body.time ? String(body.time).trim() : (event.time || '00:00')

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

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.event.update({
        where: { id },
        data: updateData
      })
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

    return tx.event.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true, role: true } },
        moderators: {
          select: { user: { select: { id: true, name: true, email: true, role: true } } }
        }
      }
    })
  })

  if (!updated) {
    return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })
  }

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: 'ADMIN_EVENT_UPDATE',
    entityType: 'Event',
    entityId: updated.id,
    metadata: { updatedFields: Object.keys(updateData), moderatorsUpdated: moderatorIds !== null },
    ip,
    userAgent
  })

  return NextResponse.json({
    ...updated,
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
  await prisma.event.delete({
    where: { id }
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: 'ADMIN_EVENT_DELETE',
    entityType: 'Event',
    entityId: id,
    metadata: null,
    ip,
    userAgent
  })

  return NextResponse.json({ success: true })
}
