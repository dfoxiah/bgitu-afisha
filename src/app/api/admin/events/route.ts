import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EventCategory } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

const isAdminSession = (session: any) => session?.user?.id && session.user.role === 'ADMIN'

const parseNewsDate = (rawDate: unknown) => {
  const fallback = new Date()
  fallback.setHours(12, 0, 0, 0)

  if (typeof rawDate !== 'string') return fallback
  const value = rawDate.trim()
  if (!value) return fallback

  if (value.includes('T')) {
    const parsed = new Date(value)
    if (isNaN(parsed.getTime())) return fallback
    return parsed
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return fallback

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0)
  return isNaN(parsed.getTime()) ? fallback : parsed
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const category = searchParams.get('category')?.trim()
  const upcoming = searchParams.get('upcoming')
  const past = searchParams.get('past')
  const news = searchParams.get('news')?.trim()
  const limit = Number(searchParams.get('limit') || 50)
  const offset = Number(searchParams.get('offset') || 0)

  const where: any = {}
  if (category && Object.values(EventCategory).includes(category as EventCategory)) {
    where.category = category
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } }
    ]
  }
  if (upcoming === 'true') {
    where.date = { gte: new Date() }
  }
  if (past === 'true') {
    where.isPast = true
  }

  if (news === 'true') {
    const newsFilter = { OR: [{ isNews: true }, { category: EventCategory.NEWS }, { report: { isNot: null } }] }
    if (where.OR) {
      where.AND = where.AND || []
      where.AND.push({ OR: where.OR })
      delete where.OR
    }
    if (where.AND) {
      where.AND.push(newsFilter)
    } else {
      where.AND = [newsFilter]
    }
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: 'desc' },
    take: Math.min(limit, 200),
    skip: Math.max(offset, 0),
    include: {
      creator: {
        select: { id: true, name: true, email: true, role: true }
      },
      moderators: {
        select: {
          user: { select: { id: true, name: true, email: true, role: true } }
        }
      }
    }
  })

  const serialized = events.map(event => ({
    ...event,
    moderators: event.moderators.map(m => m.user),
    date: event.date.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  }))

  return NextResponse.json(serialized)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }
    const adminId = session!.user!.id

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Неверный формат данных' }, { status: 400 })
    }

    const title = String(body.title || '').trim()
    const content = String(body.content || body.description || '').trim()
    if (!title) {
      return NextResponse.json({ error: 'Укажите заголовок новости' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: 'Укажите текст новости' }, { status: 400 })
    }

    const images = Array.isArray(body.images)
      ? body.images.map(value => String(value).trim()).filter(Boolean)
      : []
    const tasks = Array.isArray(body.tasks)
      ? body.tasks.map(value => String(value).trim()).filter(Boolean)
      : typeof body.tasks === 'string'
        ? body.tasks.split(/\r?\n/g).map(value => value.trim()).filter(Boolean)
        : []
    const reportComment = typeof body.reportComment === 'string' ? body.reportComment.trim() : null
    const shouldCreateReport = Boolean(body.createReport) || tasks.length > 0 || Boolean(reportComment)

    const eventDate = parseNewsDate(body.date)
    const time = typeof body.time === 'string' && body.time.trim() ? body.time.trim() : '12:00'
    const location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : 'Не указано'

    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true }
    })
    if (!adminUser) {
      return NextResponse.json({ error: 'Администратор не найден' }, { status: 404 })
    }

    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title,
          category: EventCategory.NEWS,
          date: eventDate,
          time,
          duration: '1 день',
          location,
          description: content,
          maxParticipants: 0,
          currentParticipants: 0,
          isPast: eventDate < new Date(),
          removedFromCalendar: false,
          isNews: true,
          images,
          responsible: typeof body.responsible === 'string' && body.responsible.trim()
            ? body.responsible.trim()
            : adminUser.name || adminUser.email || 'Администратор',
          contact: typeof body.contact === 'string' && body.contact.trim()
            ? body.contact.trim()
            : adminUser.email || '',
          creatorId: adminUser.id
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true, role: true }
          },
          moderators: {
            select: {
              user: { select: { id: true, name: true, email: true, role: true } }
            }
          }
        }
      })

      if (shouldCreateReport) {
        await tx.eventReport.create({
          data: {
            eventId: event.id,
            summary: content,
            tasks,
            comment: reportComment || null,
            reportDate: eventDate,
            activeParticipants: [],
            images
          }
        })
      }

      return event
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: adminId,
      action: 'ADMIN_NEWS_CREATE',
      entityType: 'Event',
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
          isNews: created.isNews
        }
      },
      ip,
      userAgent
    })

    return NextResponse.json({
      ...created,
      moderators: created.moderators.map(m => m.user),
      date: created.date.toISOString(),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    }, { status: 201 })
  } catch (error) {
    console.error('Admin create news error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}



