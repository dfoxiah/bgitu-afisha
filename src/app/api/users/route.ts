import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const role = (searchParams.get('role') || 'TEACHER').toUpperCase() as Role
  const search = searchParams.get('search')?.trim()

  const where: any = {}
  if (['TEACHER', 'ADMIN', 'STUDENT'].includes(role)) {
    where.role = role
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } }
    ]
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      image: true
    }
  })

  return NextResponse.json(users)
}
