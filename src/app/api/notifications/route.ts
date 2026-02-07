import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(notifications)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await req.json()
  const eventId = String(body.eventId || '').trim()
  const content = String(body.content || '').trim()
  const recipients = String(body.recipients || 'all')
  const type = (body.type as NotificationType) || 'EVENT'

  if (!eventId || !content) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  }

  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      moderators: {
        select: { userId: true }
      },
      eventParticipants: {
        select: {
          status: true,
          userId: true
        }
      }
    }
  })

  if (!event) {
    return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 })
  }

  const isOwner = event.creatorId === session.user.id
  const isModerator = event.moderators.some(m => m.userId === session.user.id)
  const canModerate =
    session.user.role === 'ADMIN' ||
    (session.user.role === 'TEACHER' && (isOwner || isModerator))

  if (!canModerate) {
    return NextResponse.json({ error: 'Недостаточно прав для рассылки уведомлений' }, { status: 403 })
  }

  const confirmedIds = event.eventParticipants
    .filter(p => p.status === 'CONFIRMED')
    .map(p => p.userId)
  const pendingIds = event.eventParticipants
    .filter(p => p.status === 'PENDING')
    .map(p => p.userId)

  const baseIds =
    recipients === 'confirmed'
      ? confirmedIds
      : recipients === 'pending'
        ? pendingIds
        : [...confirmedIds, ...pendingIds]

  const targetIds = new Set<string>([...baseIds, event.creatorId])

  const notificationsData = Array.from(targetIds).map(userId => ({
    userId,
    title: 'Уведомление о мероприятии',
    content,
    type,
    read: false,
    metadata: {
      eventId,
      recipients,
      sentBy: session.user.name || session.user.email || 'Система'
    }
  }))

  if (notificationsData.length === 0) {
    return NextResponse.json({ created: 0 })
  }

  const result = await prisma.notification.createMany({
    data: notificationsData
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'EVENT_NOTIFY',
    entityType: 'Event',
    entityId: eventId,
    metadata: { recipients, count: result.count },
    ip,
    userAgent
  })

  return NextResponse.json({ created: result.count })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  await prisma.notification.deleteMany({
    where: { userId: session.user.id }
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'NOTIFICATIONS_CLEAR',
    entityType: 'Notification',
    entityId: session.user.id,
    metadata: { scope: 'self' },
    ip,
    userAgent
  })

  return NextResponse.json({ success: true })
}
