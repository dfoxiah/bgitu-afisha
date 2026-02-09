import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '\u041d\u0435 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d' }, { status: 401 })
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(notifications)
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430' },
      { status: 500 }
    )
  }
}
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '\u041d\u0435 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d' }, { status: 401 })
    }

    const body = await req.json()
    const eventId = String(body.eventId || '').trim()
    const content = String(body.content || '').trim()
    const recipients = String(body.recipients || 'all')
    const type = (body.type as NotificationType) || 'EVENT'

    if (!eventId || !content) {
      return NextResponse.json({ error: '\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435' }, { status: 400 })
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432' }, { status: 403 })
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
      return NextResponse.json({ error: '\u041c\u0435\u0440\u043e\u043f\u0440\u0438\u044f\u0442\u0438\u0435 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e' }, { status: 404 })
    }

    const isOwner = event.creatorId === session.user.id
    const isModerator = event.moderators.some(m => m.userId === session.user.id)
    const canModerate =
      session.user.role === 'ADMIN' ||
      (session.user.role === 'TEACHER' && (isOwner || isModerator))

    if (!canModerate) {
      return NextResponse.json({ error: '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0440\u0430\u0441\u0441\u044b\u043b\u043a\u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439' }, { status: 403 })
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
      title: '\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u043e \u043c\u0435\u0440\u043e\u043f\u0440\u0438\u044f\u0442\u0438\u0438',
      content,
      type,
      read: false,
      metadata: {
        eventId,
        recipients,
        sentBy: session.user.name || session.user.email || '\u0421\u0438\u0441\u0442\u0435\u043c\u0430'
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
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json(
      { error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430' },
      { status: 500 }
    )
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '\u041d\u0435 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d' }, { status: 401 })
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
  } catch (error) {
    console.error('Notifications DELETE error:', error)
    return NextResponse.json(
      { error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430' },
      { status: 500 }
    )
  }
}
