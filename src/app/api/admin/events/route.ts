import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EventCategory } from '@prisma/client'

const isAdminSession = (session: any) => session?.user?.id && session.user.role === 'ADMIN'

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
