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
      createdAt: true
    }
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
        location: true,
        category: true,
        isPast: true
      }
    }),
    prisma.event.findMany({
      where: { eventParticipants: { some: { userId: user.id } } },
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        category: true,
        isPast: true
      }
    }),
    prisma.event.count({ where: { creatorId: user.id } }),
    prisma.event.count({ where: { eventParticipants: { some: { userId: user.id } } } })
  ])

  const isSelf = session.user?.id === user.id

  return (
    <div className="min-h-screen px-4 md:px-5% py-8">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-primary"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            На главную
          </Link>
          {isSelf && (
            <Link
              href="/profile"
              className="text-sm text-accent hover:text-primary"
            >
              Редактировать профиль
            </Link>
          )}
        </div>

        <div className="liquid-section overflow-hidden">
          <div className="p-8 border-b border-white/70 bg-gradient-to-r from-primary/5 via-accent/5 to-white">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-2xl font-semibold shadow-lg">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {user.name || 'Пользователь'}
                </h1>
                <p className="text-gray-600">{user.email}</p>
                <p className="text-xs text-gray-400 mt-2">
                  ID: {user.id}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-white/70 border border-white/70 shadow">
              <div className="text-xs uppercase text-gray-500">Роль</div>
              <div className="text-lg font-semibold text-gray-800 mt-1">
                {user.role}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-white/70 shadow">
              <div className="text-xs uppercase text-gray-500">Кафедра</div>
              <div className="text-lg font-semibold text-gray-800 mt-1">
                {user.department || 'Не указано'}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-white/70 shadow">
              <div className="text-xs uppercase text-gray-500">Группа</div>
              <div className="text-lg font-semibold text-gray-800 mt-1">
                {user.group || 'Не указано'}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-white/70 shadow">
              <div className="text-xs uppercase text-gray-500">Дата регистрации</div>
              <div className="text-lg font-semibold text-gray-800 mt-1">
                {user.createdAt.toLocaleDateString('ru-RU')}
              </div>
            </div>
          </div>

          <div className="px-8 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-2xl bg-white/70 border border-white/70 shadow">
                <div className="text-xs uppercase text-gray-500">О себе</div>
                <p className="mt-3 text-gray-700 leading-relaxed">
                  {user.bio
                    ? user.bio
                    : user.department || user.group
                      ? `Участник университета. ${user.department ? `Кафедра: ${user.department}. ` : ''}${user.group ? `Группа: ${user.group}.` : ''}`
                      : 'Профиль пока без описания.'}
                </p>
              </div>
              <div className="p-6 rounded-2xl bg-white/70 border border-white/70 shadow">
                <div className="text-xs uppercase text-gray-500">Активность</div>
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Создано событий</span>
                    <span className="font-semibold">{createdCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Участие в событиях</span>
                    <span className="font-semibold">{participatedCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 pb-10 border-t border-white/70">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-8">
              <div className="p-6 rounded-2xl bg-white/70 border border-white/70 shadow">
                <div className="text-lg font-semibold text-gray-900 mb-4">Созданные события</div>
                {createdEvents.length === 0 ? (
                  <div className="text-sm text-gray-500">Нет созданных событий.</div>
                ) : (
                  <ul className="space-y-3">
                    {createdEvents.map(event => (
                      <li key={event.id} className="flex items-center justify-between">
                        <Link
                          href={`/events/${event.id}`}
                          className="text-accent hover:text-primary hover:underline underline-offset-4"
                        >
                          {event.title}
                        </Link>
                        <span className="text-xs text-gray-500">
                          {new Date(event.date).toLocaleDateString('ru-RU')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-6 rounded-2xl bg-white/70 border border-white/70 shadow">
                <div className="text-lg font-semibold text-gray-900 mb-4">Участие</div>
                {participatedEvents.length === 0 ? (
                  <div className="text-sm text-gray-500">Нет мероприятий с участием.</div>
                ) : (
                  <ul className="space-y-3">
                    {participatedEvents.map(event => (
                      <li key={event.id} className="flex items-center justify-between">
                        <Link
                          href={`/events/${event.id}`}
                          className="text-accent hover:text-primary hover:underline underline-offset-4"
                        >
                          {event.title}
                        </Link>
                        <span className="text-xs text-gray-500">
                          {new Date(event.date).toLocaleDateString('ru-RU')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
