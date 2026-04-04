/**
 * File responsibility:
 * App Router page module for this route.
 *
 * Main logic:
 * - Compose route-level UI blocks.
 * - Connect page state with shared context/services.
 *
 * Integrations:
 * - Shared layout/providers
 * - Feature components and hooks
 */
import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface UserProfilePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      group: true,
      image: true,
      bio: true,
      createdAt: true,
    },
  })

  if (!user) {
    notFound()
  }

  const [createdEvents, participatedEvents, createdCount, participatedCount] = await Promise.all([
    prisma.event.findMany({
      where: { creatorId: user.id },
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        date: true,
      },
    }),
    prisma.event.findMany({
      where: { eventParticipants: { some: { userId: user.id } } },
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        date: true,
      },
    }),
    prisma.event.count({ where: { creatorId: user.id } }),
    prisma.event.count({ where: { eventParticipants: { some: { userId: user.id } } } }),
  ])

  const isSelf = session.user?.id === user.id

  return (
    <div className="page-shell min-h-screen px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="page-hero p-4 sm:p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard" className="rounded-lg border-2 border-primary/16 bg-white px-3 py-1.5 text-sm font-medium text-primary/72 hover:text-primary">
              <i className="fas fa-arrow-left mr-2" />
              На главную
            </Link>

            {isSelf && (
              <Link href="/profile" className="rounded-lg border-2 border-primary/16 bg-[#fff8e8] px-3 py-1.5 text-sm font-semibold text-primary hover:bg-white">
                Редактировать профиль
              </Link>
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-primary/24 bg-primary text-2xl font-semibold text-white">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="page-title text-2xl font-bold sm:text-4xl">{user.name || 'Пользователь'}</h1>
                <p className="mt-1 text-sm text-primary/66">{user.email}</p>
                <p className="mt-1 text-xs text-primary/52">ID: {user.id}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border-2 border-primary/16 bg-white px-3 py-2 text-sm text-primary/74">
                <p className="text-xs uppercase tracking-[0.08em] text-primary/58">Роль</p>
                <p className="mt-1 font-semibold text-primary">{user.role}</p>
              </div>
              <div className="rounded-lg border-2 border-primary/16 bg-white px-3 py-2 text-sm text-primary/74">
                <p className="text-xs uppercase tracking-[0.08em] text-primary/58">С нами с</p>
                <p className="mt-1 font-semibold text-primary">{user.createdAt.toLocaleDateString('ru-RU')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <article className="liquid-section p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-primary">О пользователе</h2>
              <p className="mt-3 text-sm leading-7 text-primary/74 sm:text-base">
                {user.bio
                  ? user.bio
                  : user.department || user.group
                    ? `Участник университета. ${user.department ? `Кафедра: ${user.department}. ` : ''}${user.group ? `Группа: ${user.group}.` : ''}`
                    : 'Профиль пока без описания.'}
              </p>
            </article>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="liquid-card p-5">
                <h3 className="text-base font-semibold text-primary">Созданные события</h3>
                {createdEvents.length === 0 ? (
                  <p className="mt-3 text-sm text-primary/62">Нет созданных событий.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {createdEvents.map((event) => (
                      <li key={event.id} className="flex items-center justify-between gap-3">
                        <Link href={`/events/${event.id}`} className="line-clamp-1 text-sm font-medium text-primary hover:underline">
                          {event.title}
                        </Link>
                        <span className="text-xs text-primary/56">{new Date(event.date).toLocaleDateString('ru-RU')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="liquid-card p-5">
                <h3 className="text-base font-semibold text-primary">Участие в событиях</h3>
                {participatedEvents.length === 0 ? (
                  <p className="mt-3 text-sm text-primary/62">Нет мероприятий с участием.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {participatedEvents.map((event) => (
                      <li key={event.id} className="flex items-center justify-between gap-3">
                        <Link href={`/events/${event.id}`} className="line-clamp-1 text-sm font-medium text-primary hover:underline">
                          {event.title}
                        </Link>
                        <span className="text-xs text-primary/56">{new Date(event.date).toLocaleDateString('ru-RU')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </div>

          <aside className="space-y-4">
            <article className="liquid-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary/58">Учебные данные</h3>
              <div className="mt-4 space-y-3 text-sm text-primary/74">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-primary/56">Кафедра</p>
                  <p className="mt-1 font-semibold text-primary">{user.department || 'Не указано'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-primary/56">Группа</p>
                  <p className="mt-1 font-semibold text-primary">{user.group || 'Не указано'}</p>
                </div>
              </div>
            </article>

            <article className="liquid-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary/58">Активность</h3>
              <div className="mt-4 space-y-3 text-sm text-primary/74">
                <div className="flex items-center justify-between">
                  <span>Создано событий</span>
                  <span className="font-semibold text-primary">{createdCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Участий в событиях</span>
                  <span className="font-semibold text-primary">{participatedCount}</span>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </div>
  )
}
