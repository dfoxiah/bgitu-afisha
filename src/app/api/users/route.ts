/**
 * File responsibility:
 * Teacher/admin-only endpoint for listing users with role/search filters.
 *
 * Main logic:
 * - Validate session and role access
 * - Build typed Prisma `where` filter from query params
 * - Return minimal user projection for admin UI usage
 *
 * Integrations:
 * - src/app/admin/page.tsx (legacy users block)
 * - Prisma User model
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { canManageDirectoryNotifications, isContentManagerRole, isRoleValue } from '@/lib/roles'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  if (!isContentManagerRole(session.user.role)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const role = (searchParams.get('role') || 'TEACHER').toUpperCase()
  const search = searchParams.get('search')?.trim()
  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? Number(rawLimit) : NaN
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.trunc(parsedLimit), 500) : 200

  const where: Prisma.UserWhereInput = {}

  if (role === 'ALL' && !canManageDirectoryNotifications(session.user.role)) {
    return NextResponse.json(
      { error: 'Полный справочник пользователей доступен только редакторам и администраторам' },
      { status: 403 }
    )
  }

  if (isRoleValue(role)) {
    where.role = role
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { department: { contains: search, mode: 'insensitive' } },
      { group: { contains: search, mode: 'insensitive' } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      image: true,
    },
  })

  return NextResponse.json(users, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
