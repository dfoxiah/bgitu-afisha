import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

const isAdminSession = (session: any) => session?.user?.id && session.user.role === 'ADMIN'

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      groupChangeCount: true,
      bio: true,
      privacyConsentAt: true,
      termsConsentAt: true,
      createdAt: true,
      updatedAt: true
    }
  })

  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const adminId = session!.user!.id

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.email !== undefined) updates.email = String(body.email).trim()
  if (body.department !== undefined) updates.department = body.department ? String(body.department).trim() : null
  if (body.group !== undefined) updates.group = body.group ? String(body.group).trim() : null
  if (body.groupChangeCount !== undefined) updates.groupChangeCount = Number(body.groupChangeCount) || 0
  if (body.bio !== undefined) updates.bio = body.bio ? String(body.bio).trim() : null

  if (body.role !== undefined) {
    const role = String(body.role).trim() as Role
    if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Некорректная роль' }, { status: 400 })
    }
    updates.role = role
  }

  if (body.password) {
    const password = String(body.password).trim()
    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
    }
    updates.password = await bcrypt.hash(password, 10)
  }

  if (body.privacyConsentAt !== undefined) {
    updates.privacyConsentAt = body.privacyConsentAt ? new Date(body.privacyConsentAt) : null
  }

  if (body.termsConsentAt !== undefined) {
    updates.termsConsentAt = body.termsConsentAt ? new Date(body.termsConsentAt) : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updates,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      groupChangeCount: true,
      bio: true,
      privacyConsentAt: true,
      termsConsentAt: true,
      updatedAt: true
    }
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: 'ADMIN_USER_UPDATE',
    entityType: 'User',
    entityId: updated.id,
    metadata: { updatedFields: Object.keys(updates) },
    ip,
    userAgent
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const adminId = session!.user!.id

  const { id } = await params
  if (id === adminId) {
    return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 })
  }

  await prisma.user.delete({
    where: { id }
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: 'ADMIN_USER_DELETE',
    entityType: 'User',
    entityId: id,
    metadata: null,
    ip,
    userAgent
  })

  return NextResponse.json({ success: true })
}
