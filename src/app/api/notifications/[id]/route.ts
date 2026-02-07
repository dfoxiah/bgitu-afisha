import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const notification = await prisma.notification.findFirst({
    where: { id, userId: session.user.id }
  })

  if (!notification) {
    return NextResponse.json({ error: 'Уведомление не найдено' }, { status: 404 })
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true }
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: session.user.id,
    action: 'NOTIFICATION_READ',
    entityType: 'Notification',
    entityId: id,
    metadata: { read: true },
    ip,
    userAgent
  })

  return NextResponse.json(updated)
}
