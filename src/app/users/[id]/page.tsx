/**
 * File responsibility:
 * User profile page with privacy-aware attendance view.
 *
 * Main logic:
 * - Enforce profile access policy by role and context
 * - Show attendance history for student with bounded scope
 * - Avoid exposing sensitive data in teacher-context view
 *
 * Integrations:
 * - src/server/events/student-attendance-history-service.ts
 * - Prisma User/Event models
 */

import { ParticipantStatus, Role } from "@prisma/client"
import { getServerSession } from "next-auth"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CategoryDisplayMap } from "@/types"
import { getStudentAttendanceHistoryForViewer } from "@/server/events/student-attendance-history-service"

type UserProfilePageProps = {
  params: Promise<{
    id: string
  }>
}

type CompactEvent = {
  id: string
  title: string
  date: Date
}

const statusLabelByCode: Record<ParticipantStatus, string> = {
  [ParticipantStatus.CONFIRMED]: "Подтверждено",
  [ParticipantStatus.PENDING]: "Ожидает подтверждения",
}

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value)

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session.user.role) {
    redirect("/login")
  }

  const viewer = {
    id: session.user.id,
    role: session.user.role as Role,
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

  const isSelf = viewer.id === user.id
  const isAdminViewer = viewer.role === Role.ADMIN
  const isTeacherViewer = viewer.role === Role.TEACHER
  const isTeacherContextView = !isSelf && isTeacherViewer && user.role === Role.STUDENT

  if (!isSelf && !isAdminViewer && !isTeacherContextView) {
    notFound()
  }

  const attendanceHistory =
    user.role === Role.STUDENT
      ? await getStudentAttendanceHistoryForViewer({
          viewer,
          student: {
            id: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
          },
        })
      : null

  if (isTeacherContextView && !attendanceHistory) {
    notFound()
  }

  const canSeeExtendedActivity = !isTeacherContextView
  const canViewSensitiveContact = isSelf || isAdminViewer

  let createdEvents: CompactEvent[] = []
  let participatedEvents: CompactEvent[] = []
  let createdCount = 0
  let participatedCount = 0

  if (canSeeExtendedActivity) {
    const [created, participated, createdTotal, participatedTotal] = await Promise.all([
      prisma.event.findMany({
        where: { creatorId: user.id },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          date: true,
        },
      }),
      prisma.event.findMany({
        where: { eventParticipants: { some: { userId: user.id } } },
        orderBy: { date: "desc" },
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

    createdEvents = created
    participatedEvents = participated
    createdCount = createdTotal
    participatedCount = participatedTotal
  }

  return (
    <div className="page-shell min-h-screen px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="page-hero p-4 sm:p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border-2 border-primary/16 bg-white px-3 py-1.5 text-sm font-medium text-primary/72 hover:text-primary"
            >
              <i className="fas fa-arrow-left mr-2" />
              На главную
            </Link>

            {isSelf && (
              <Link
                href="/profile"
                className="rounded-lg border-2 border-primary/16 bg-[#fff8e8] px-3 py-1.5 text-sm font-semibold text-primary hover:bg-white"
              >
                Редактировать профиль
              </Link>
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-primary/24 bg-primary text-2xl font-semibold text-white">
                {user.name?.charAt(0) || "U"}
              </div>
              <div>
                <h1 className="page-title text-2xl font-bold sm:text-4xl">{user.name || "Пользователь"}</h1>
                <p className="mt-1 text-sm text-primary/66">
                  {canViewSensitiveContact ? user.email : "Контакт скрыт политикой приватности"}
                </p>
                {canViewSensitiveContact && <p className="mt-1 text-xs text-primary/52">ID: {user.id}</p>}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border-2 border-primary/16 bg-white px-3 py-2 text-sm text-primary/74">
                <p className="text-xs uppercase tracking-[0.08em] text-primary/58">Роль</p>
                <p className="mt-1 font-semibold text-primary">{user.role}</p>
              </div>
              <div className="rounded-lg border-2 border-primary/16 bg-white px-3 py-2 text-sm text-primary/74">
                <p className="text-xs uppercase tracking-[0.08em] text-primary/58">С нами с</p>
                <p className="mt-1 font-semibold text-primary">{user.createdAt.toLocaleDateString("ru-RU")}</p>
              </div>
            </div>
          </div>
        </section>

        {isTeacherContextView && attendanceHistory && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <p className="font-semibold">Режим ограниченного доступа к истории посещений</p>
            <p className="mt-1 text-amber-900/85">
              Показаны только прошедшие мероприятия за {attendanceHistory.period.days} дней, где вы являетесь
              создателем или модератором.
            </p>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <article className="liquid-section p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-primary">О пользователе</h2>
              <p className="mt-3 text-sm leading-7 text-primary/74 sm:text-base">
                {user.bio
                  ? user.bio
                  : user.department || user.group
                    ? `Участник университета. ${user.department ? `Кафедра: ${user.department}. ` : ""}${user.group ? `Группа: ${user.group}.` : ""}`
                    : "Профиль пока без описания."}
              </p>
            </article>

            {attendanceHistory && (
              <article className="liquid-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-primary">История посещений студента</h3>
                  <span className="rounded-full border border-primary/20 bg-white px-3 py-1 text-xs text-primary/68">
                    {formatDate(attendanceHistory.period.from)} - {formatDate(attendanceHistory.period.to)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-primary/12 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-primary/56">Всего мероприятий</p>
                    <p className="mt-1 text-xl font-semibold text-primary">{attendanceHistory.summary.total}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-emerald-700/80">Подтверждено</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-700">{attendanceHistory.summary.confirmed}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-blue-700/80">Активных участий</p>
                    <p className="mt-1 text-xl font-semibold text-blue-700">{attendanceHistory.summary.active}</p>
                  </div>
                  <div className="rounded-lg border border-primary/12 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-primary/56">Коэфф. участия</p>
                    <p className="mt-1 text-xl font-semibold text-primary">{attendanceHistory.summary.activityRatePercent}%</p>
                  </div>
                </div>

                {attendanceHistory.items.length === 0 ? (
                  <p className="mt-4 text-sm text-primary/62">В выбранном периоде записей нет.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-primary/12">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead className="bg-primary/5 text-left text-primary/64">
                        <tr>
                          <th className="px-3 py-2">Дата</th>
                          <th className="px-3 py-2">Мероприятие</th>
                          <th className="px-3 py-2">Категория</th>
                          <th className="px-3 py-2">Статус</th>
                          <th className="px-3 py-2">Активность</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceHistory.items.map((item) => (
                          <tr key={`${item.eventId}:${item.date.toISOString()}`} className="border-t border-primary/10">
                            <td className="px-3 py-2">
                              {item.date.toLocaleDateString("ru-RU")} {item.time || ""}
                            </td>
                            <td className="px-3 py-2">
                              <Link href={`/events/${item.eventId}`} className="font-medium text-primary hover:underline">
                                {item.title}
                              </Link>
                            </td>
                            <td className="px-3 py-2">{CategoryDisplayMap[item.category]}</td>
                            <td className="px-3 py-2">{statusLabelByCode[item.status]}</td>
                            <td className="px-3 py-2">
                              {item.isActive ? (
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                  Активный
                                </span>
                              ) : (
                                <span className="text-primary/58">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            )}

            {canSeeExtendedActivity && (
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
                          <span className="text-xs text-primary/56">{new Date(event.date).toLocaleDateString("ru-RU")}</span>
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
                          <span className="text-xs text-primary/56">{new Date(event.date).toLocaleDateString("ru-RU")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <article className="liquid-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary/58">Учебные данные</h3>
              <div className="mt-4 space-y-3 text-sm text-primary/74">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-primary/56">Кафедра</p>
                  <p className="mt-1 font-semibold text-primary">{user.department || "Не указано"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-primary/56">Группа</p>
                  <p className="mt-1 font-semibold text-primary">{user.group || "Не указано"}</p>
                </div>
              </div>
            </article>

            <article className="liquid-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-primary/58">Активность</h3>
              <div className="mt-4 space-y-3 text-sm text-primary/74">
                {attendanceHistory ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Подтверждено</span>
                      <span className="font-semibold text-primary">{attendanceHistory.summary.confirmed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Ожидает подтверждения</span>
                      <span className="font-semibold text-primary">{attendanceHistory.summary.pending}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Активные участия</span>
                      <span className="font-semibold text-primary">{attendanceHistory.summary.active}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Подтверждение заявок</span>
                      <span className="font-semibold text-primary">{attendanceHistory.summary.confirmationRatePercent}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Создано событий</span>
                      <span className="font-semibold text-primary">{createdCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Участий в событиях</span>
                      <span className="font-semibold text-primary">{participatedCount}</span>
                    </div>
                  </>
                )}
              </div>
            </article>
          </aside>
        </section>
      </div>
    </div>
  )
}
