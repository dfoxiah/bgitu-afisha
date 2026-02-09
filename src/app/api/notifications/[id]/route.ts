import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '\u041d\u0435 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d' }, { status: 401 })
    }

    const { id } = await params
    const notification = await prisma.notification.findFirst({
      where: { id, userId: session.user.id }
    })

    if (!notification) {
      return NextResponse.json({ error: '\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e' }, { status: 404 })
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
  } catch (error) {
    console.error('Notifications PATCH error:', error)
    return NextResponse.json(
      { error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430' },
      { status: 500 }
    )
  }
}
