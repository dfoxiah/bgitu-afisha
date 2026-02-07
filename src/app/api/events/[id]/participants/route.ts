import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NotificationType, ParticipantStatus } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const body = await req.json()
    const userId = String(body.userId || '').trim()
    const action = String(body.action || '').trim()

    if (!userId || (action !== 'confirm' && action !== 'reject')) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        date: true,
        time: true,
        maxParticipants: true,
        currentParticipants: true,
        creatorId: true,
        moderators: { select: { userId: true } }
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
      return NextResponse.json({ error: 'Недостаточно прав для модерации' }, { status: 403 })
    }

    const participant = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } }
    })

    if (!participant) {
      return NextResponse.json({ error: 'Участник не найден' }, { status: 404 })
    }

    const prevStatus = participant.status
    let nextStatus: ParticipantStatus | 'REMOVED' = prevStatus
    let delta = 0

    if (action === 'confirm') {
      if (prevStatus !== ParticipantStatus.CONFIRMED) {
        if (event.maxParticipants > 0 && event.currentParticipants >= event.maxParticipants) {
          return NextResponse.json({ error: 'Достигнут лимит участников' }, { status: 400 })
        }
        nextStatus = ParticipantStatus.CONFIRMED
        delta = 1
      }
    } else {
      // reject
      nextStatus = 'REMOVED'
      if (prevStatus === ParticipantStatus.CONFIRMED) {
        delta = -1
      }
    }

    await prisma.$transaction(async (tx) => {
      if (action === 'confirm' && prevStatus !== ParticipantStatus.CONFIRMED) {
        await tx.eventParticipant.update({
          where: { eventId_userId: { eventId, userId } },
          data: { status: ParticipantStatus.CONFIRMED }
        })
      }

      if (action === 'reject') {
        await tx.eventParticipant.delete({
          where: { eventId_userId: { eventId, userId } }
        })
      }

      if (delta !== 0) {
        await tx.event.update({
          where: { id: eventId },
          data: { currentParticipants: { increment: delta } }
        })
      }

      const title =
        action === 'confirm'
          ? 'Участие подтверждено'
          : 'Заявка отклонена'
      const content =
        action === 'confirm'
          ? `Ваше участие в мероприятии «${event.title}» подтверждено. Дата: ${new Date(event.date).toLocaleDateString('ru-RU')} ${event.time || ''}`
          : `Ваша заявка на участие в мероприятии «${event.title}» отклонена.`

      await tx.notification.create({
        data: {
          userId,
          title,
          content,
          type: NotificationType.EVENT,
          read: false,
          metadata: {
            eventId,
            action,
            approvedBy: session.user.email || session.user.name
          }
        }
      })
    })

    const { ip, userAgent } = buildAuditMeta(req)
    await logAuditEvent({
      actorId: session.user.id,
      action: action === 'confirm' ? 'EVENT_PARTICIPANT_CONFIRM' : 'EVENT_PARTICIPANT_REJECT',
      entityType: 'EventParticipant',
      entityId: `${eventId}:${userId}`,
      metadata: { eventId, participantId: userId },
      ip,
      userAgent
    })

    return NextResponse.json({
      success: true,
      userId,
      eventId,
      prevStatus,
      nextStatus,
      currentParticipants: event.currentParticipants + delta
    })
  } catch (error) {
    console.error('Participant status update error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
