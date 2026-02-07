import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { buildAuditMeta, logAuditEvent } from '@/lib/audit'

const isAdminSession = (session: any) => session?.user?.id && session.user.role === 'ADMIN'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const role = searchParams.get('role')?.trim() as Role | null
  const limit = Number(searchParams.get('limit') || 50)
  const offset = Number(searchParams.get('offset') || 0)

  const where: any = {}
  if (role && ['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
    where.role = role
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { department: { contains: search, mode: 'insensitive' } },
      { group: { contains: search, mode: 'insensitive' } }
    ]
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    skip: Math.max(offset, 0),
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

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }
  const adminId = session!.user!.id

  const body = await req.json()
  const email = String(body.email || '').trim()
  const name = String(body.name || '').trim()
  const password = String(body.password || '').trim()
  const role = String(body.role || 'STUDENT').trim() as Role

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Заполните email, имя и пароль' }, { status: 400 })
  }

  if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Некорректная роль' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const consentAt = body.acceptPrivacy && body.acceptTerms ? new Date() : null

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role,
      department: body.department || null,
      group: body.group || null,
      bio: body.bio || null,
      privacyConsentAt: consentAt,
      termsConsentAt: consentAt
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      groupChangeCount: true,
      bio: true,
      createdAt: true
    }
  })

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: adminId,
    action: 'ADMIN_USER_CREATE',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    ip,
    userAgent
  })

  return NextResponse.json(user, { status: 201 })
}
