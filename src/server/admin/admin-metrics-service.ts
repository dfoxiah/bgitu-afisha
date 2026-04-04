/**
 * File responsibility:
 * Admin metrics and analytics service for dashboard widgets and XLSX exports.
 *
 * Main logic:
 * - Aggregate monthly/weekly popularity and activity statistics
 * - Build top active students/teachers rankings
 * - Generate event attendance workbook for Excel export
 *
 * Integrations:
 * - src/app/api/admin/metrics/route.ts
 * - src/app/api/admin/events/[id]/export/route.ts
 */

import { EventCategory, ParticipantStatus, Role } from "@prisma/client"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { ServiceError } from "@/server/shared/service-error"

type TopEventMetric = {
  id: string
  title: string
  date: string
  responsible: string
  confirmedParticipants: number
}

type SiteTrafficPoint = {
  date: string
  actions: number
  uniqueUsers: number
  signIns: number
}

type ActiveUserMetric = {
  userId: string
  name: string
  email: string
  role: Role
  auditActions: number
  registrations: number
  confirmedParticipations: number
  createdEvents: number
  moderatedEvents: number
  activityScore: number
}

type PeriodSummaryMetric = {
  from: string
  to: string
  days: number
  totalEvents: number
  upcomingEvents: number
  completedEvents: number
  registrations: number
  confirmed: number
  pending: number
  attendanceRatePercent: number
}

type EventAttendanceMetric = {
  eventId: string
  title: string
  date: string
  confirmed: number
  pending: number
  total: number
  maxParticipants: number
  fillRatePercent: number
}

type StudentAttendanceMetric = {
  userId: string
  name: string
  email: string
  group: string
  department: string
  confirmed: number
  pending: number
  total: number
}

type GroupAttendanceMetric = {
  group: string
  confirmed: number
  pending: number
  total: number
  uniqueStudents: number
}

type DepartmentAttendanceMetric = {
  department: string
  confirmed: number
  pending: number
  total: number
  uniqueStudents: number
}

type RoleAttendanceMetric = {
  role: Role
  confirmed: number
  pending: number
  total: number
}

export type AdminDashboardMetricsResult = {
  generatedAt: string
  periods: {
    weekStart: string
    weekEnd: string
    monthStart: string
    monthEnd: string
  }
  popularEvents: {
    week: TopEventMetric | null
    month: TopEventMetric | null
  }
  siteTraffic: {
    actionsLast7Days: number
    signInsLast7Days: number
    uniqueUsersLast7Days: number
    dailyActivity: SiteTrafficPoint[]
  }
  eventStats: {
    totalEvents: number
    upcomingEvents: number
    completedEvents: number
    newsMaterials: number
    registrationsThisMonth: number
    confirmedThisMonth: number
    pendingApprovals: number
    registrationConversionPercent: number
  }
  periodSummary: PeriodSummaryMetric
  attendanceStats: {
    byEvent: EventAttendanceMetric[]
    byStudent: StudentAttendanceMetric[]
    byGroup: GroupAttendanceMetric[]
    byDepartment: DepartmentAttendanceMetric[]
    byRole: RoleAttendanceMetric[]
  }
  topActive: {
    students: ActiveUserMetric[]
    teachers: ActiveUserMetric[]
  }
  additional: {
    upcomingWithoutModerators: number
    eventsMissingContact: number
  }
}

type EventExcelExportResult = {
  fileName: string
  buffer: Buffer
}

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0)

const endOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999)

const addDays = (value: Date, amount: number) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate() + amount, value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds())

const startOfWeek = (value: Date) => {
  const dayStart = startOfDay(value)
  // ISO week starts on Monday.
  const isoDay = (dayStart.getDay() + 6) % 7
  return addDays(dayStart, -isoDay)
}

const toDateKey = (value: Date) => value.toISOString().slice(0, 10)

const safePercent = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

const toCountMap = <T extends string | null>(
  rows: Array<{ key: T; count: number }>
) => {
  const map = new Map<string, number>()
  rows.forEach((row) => {
    if (!row.key) return
    map.set(row.key, row.count)
  })
  return map
}

const parseTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return 0
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return 0
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return 0
  return hh * 60 + mm
}

const toEventDateTime = (date: Date, time?: string | null) => {
  const result = new Date(date)
  const minutes = parseTimeToMinutes(time)
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return result
}

const toPeriodBounds = (params: { from?: Date | null; to?: Date | null; now: Date }) => {
  const { from, to, now } = params
  const fallbackFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const fallbackTo = endOfDay(now)

  const fromDate = startOfDay(from || fallbackFrom)
  const toDate = endOfDay(to || fallbackTo)
  const days = Math.max(
    1,
    Math.ceil((toDate.getTime() - fromDate.getTime() + 1) / (24 * 60 * 60 * 1000))
  )

  return { from: fromDate, to: toDate, days }
}

const buildAttendanceStats = async (params: { from: Date; to: Date }) => {
  const events = await prisma.event.findMany({
    where: {
      removedFromCalendar: false,
      isNews: false,
      category: { not: EventCategory.NEWS },
      date: { gte: params.from, lte: params.to },
    },
    select: {
      id: true,
      title: true,
      date: true,
      time: true,
      maxParticipants: true,
      eventParticipants: {
        select: {
          status: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              group: true,
              department: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  })

  const byStudentMap = new Map<
    string,
    {
      userId: string
      name: string
      email: string
      group: string
      department: string
      confirmed: number
      pending: number
    }
  >()

  const byGroupMap = new Map<
    string,
    { group: string; confirmed: number; pending: number; studentIds: Set<string> }
  >()
  const byDepartmentMap = new Map<
    string,
    { department: string; confirmed: number; pending: number; studentIds: Set<string> }
  >()
  const byRoleMap = new Map<Role, { role: Role; confirmed: number; pending: number }>()

  const byEvent: EventAttendanceMetric[] = events
    .map((event) => {
      const confirmed = event.eventParticipants.filter(
        (row) => row.status === ParticipantStatus.CONFIRMED
      ).length
      const pending = event.eventParticipants.filter(
        (row) => row.status === ParticipantStatus.PENDING
      ).length
      const total = confirmed + pending
      const maxParticipants = event.maxParticipants || 0

      event.eventParticipants.forEach((row) => {
        const roleKey = row.user.role
        const roleBucket = byRoleMap.get(roleKey) || {
          role: roleKey,
          confirmed: 0,
          pending: 0,
        }
        if (row.status === ParticipantStatus.CONFIRMED) roleBucket.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) roleBucket.pending += 1
        byRoleMap.set(roleKey, roleBucket)

        if (row.user.role !== Role.STUDENT) return

        const student = byStudentMap.get(row.user.id) || {
          userId: row.user.id,
          name: row.user.name || row.user.email,
          email: row.user.email,
          group: row.user.group || "Не указана",
          department: row.user.department || "Не указан",
          confirmed: 0,
          pending: 0,
        }
        if (row.status === ParticipantStatus.CONFIRMED) student.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) student.pending += 1
        byStudentMap.set(row.user.id, student)

        const groupKey = row.user.group || "Не указана"
        const groupBucket = byGroupMap.get(groupKey) || {
          group: groupKey,
          confirmed: 0,
          pending: 0,
          studentIds: new Set<string>(),
        }
        if (row.status === ParticipantStatus.CONFIRMED) groupBucket.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) groupBucket.pending += 1
        groupBucket.studentIds.add(row.user.id)
        byGroupMap.set(groupKey, groupBucket)

        const departmentKey = row.user.department || "Не указан"
        const departmentBucket = byDepartmentMap.get(departmentKey) || {
          department: departmentKey,
          confirmed: 0,
          pending: 0,
          studentIds: new Set<string>(),
        }
        if (row.status === ParticipantStatus.CONFIRMED) departmentBucket.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) departmentBucket.pending += 1
        departmentBucket.studentIds.add(row.user.id)
        byDepartmentMap.set(departmentKey, departmentBucket)
      })

      return {
        eventId: event.id,
        title: event.title,
        date: toEventDateTime(event.date, event.time).toISOString(),
        confirmed,
        pending,
        total,
        maxParticipants,
        fillRatePercent:
          maxParticipants > 0 ? safePercent(confirmed, maxParticipants) : confirmed > 0 ? 100 : 0,
      } satisfies EventAttendanceMetric
    })
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      if (right.total !== left.total) return right.total - left.total
      return new Date(left.date).getTime() - new Date(right.date).getTime()
    })
    .slice(0, 25)

  const byStudent = Array.from(byStudentMap.values())
    .map((student) => ({
      ...student,
      total: student.confirmed + student.pending,
    }))
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      return right.total - left.total
    })
    .slice(0, 30)

  const byGroup = Array.from(byGroupMap.values())
    .map((group) => ({
      group: group.group,
      confirmed: group.confirmed,
      pending: group.pending,
      total: group.confirmed + group.pending,
      uniqueStudents: group.studentIds.size,
    }))
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      return right.total - left.total
    })
    .slice(0, 20)

  const byDepartment = Array.from(byDepartmentMap.values())
    .map((department) => ({
      department: department.department,
      confirmed: department.confirmed,
      pending: department.pending,
      total: department.confirmed + department.pending,
      uniqueStudents: department.studentIds.size,
    }))
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      return right.total - left.total
    })
    .slice(0, 20)

  const byRole = Array.from(byRoleMap.values())
    .map((roleItem) => ({
      role: roleItem.role,
      confirmed: roleItem.confirmed,
      pending: roleItem.pending,
      total: roleItem.confirmed + roleItem.pending,
    }))
    .sort((left, right) => right.total - left.total)

  const registrations = byRole.reduce((sum, row) => sum + row.total, 0)
  const confirmed = byRole.reduce((sum, row) => sum + row.confirmed, 0)
  const pending = byRole.reduce((sum, row) => sum + row.pending, 0)

  return {
    byEvent,
    byStudent,
    byGroup,
    byDepartment,
    byRole,
    totals: {
      registrations,
      confirmed,
      pending,
      attendanceRatePercent: safePercent(confirmed, registrations),
    },
  }
}

const buildTopEventMetric = async (start: Date, end: Date) => {
  const grouped = await prisma.eventParticipant.groupBy({
    by: ["eventId"],
    where: {
      status: ParticipantStatus.CONFIRMED,
      event: {
        date: { gte: start, lte: end },
        removedFromCalendar: false,
        isNews: false,
        category: { not: EventCategory.NEWS },
      },
    },
    _count: { _all: true },
  })

  const top = grouped
    .sort((left, right) => right._count._all - left._count._all)
    .at(0)

  if (!top) return null

  const event = await prisma.event.findUnique({
    where: { id: top.eventId },
    select: {
      id: true,
      title: true,
      date: true,
      responsible: true,
    },
  })

  if (!event) return null

  return {
    id: event.id,
    title: event.title,
    date: event.date.toISOString(),
    responsible: event.responsible,
    confirmedParticipants: top._count._all,
  } satisfies TopEventMetric
}

const buildSiteTrafficMetrics = async (now: Date) => {
  const rangeStart = startOfDay(addDays(now, -13))
  const last7Start = startOfDay(addDays(now, -6))

  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: rangeStart, lte: endOfDay(now) },
    },
    select: {
      createdAt: true,
      actorId: true,
      action: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const activity = new Map<
    string,
    { actions: number; signIns: number; actorIds: Set<string> }
  >()

  for (let i = 0; i < 14; i += 1) {
    const day = addDays(rangeStart, i)
    activity.set(toDateKey(day), {
      actions: 0,
      signIns: 0,
      actorIds: new Set<string>(),
    })
  }

  logs.forEach((log) => {
    const key = toDateKey(log.createdAt)
    const row = activity.get(key)
    if (!row) return
    row.actions += 1
    if (log.action === "AUTH_SIGN_IN") {
      row.signIns += 1
    }
    if (log.actorId) {
      row.actorIds.add(log.actorId)
    }
  })

  const dailyActivity = Array.from(activity.entries()).map(([date, row]) => ({
    date,
    actions: row.actions,
    uniqueUsers: row.actorIds.size,
    signIns: row.signIns,
  }))

  const logsLast7 = logs.filter((log) => log.createdAt >= last7Start)
  const uniqueUsersLast7Days = new Set(
    logsLast7.map((log) => log.actorId).filter((actorId): actorId is string => Boolean(actorId))
  ).size

  return {
    actionsLast7Days: logsLast7.length,
    signInsLast7Days: logsLast7.filter((log) => log.action === "AUTH_SIGN_IN").length,
    uniqueUsersLast7Days,
    dailyActivity,
  }
}

const buildActiveUsersByRole = async (
  role: "STUDENT" | "TEACHER",
  monthStart: Date,
  now: Date,
  limit: number
) => {
  const users = await prisma.user.findMany({
    where: { role },
    select: { id: true, name: true, email: true, role: true },
  })

  if (users.length === 0) return [] as ActiveUserMetric[]

  const userIds = users.map((user) => user.id)

  const [auditRows, registrationRows, confirmedRows, createdRows, moderatedRows] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ["actorId"],
      where: {
        actorId: { in: userIds },
        createdAt: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.eventParticipant.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        createdAt: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.eventParticipant.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        status: ParticipantStatus.CONFIRMED,
        updatedAt: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["creatorId"],
      where: {
        creatorId: { in: userIds },
        createdAt: { gte: monthStart, lte: now },
      },
      _count: { _all: true },
    }),
    prisma.eventModerator.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        event: {
          date: { gte: monthStart, lte: now },
        },
      },
      _count: { _all: true },
    }),
  ])

  const auditMap = toCountMap(auditRows.map((row) => ({ key: row.actorId, count: row._count._all })))
  const registrationMap = toCountMap(registrationRows.map((row) => ({ key: row.userId, count: row._count._all })))
  const confirmedMap = toCountMap(confirmedRows.map((row) => ({ key: row.userId, count: row._count._all })))
  const createdMap = toCountMap(createdRows.map((row) => ({ key: row.creatorId, count: row._count._all })))
  const moderatedMap = toCountMap(moderatedRows.map((row) => ({ key: row.userId, count: row._count._all })))

  const metrics = users.map((user) => {
    const auditActions = auditMap.get(user.id) || 0
    const registrations = registrationMap.get(user.id) || 0
    const confirmedParticipations = confirmedMap.get(user.id) || 0
    const createdEvents = createdMap.get(user.id) || 0
    const moderatedEvents = moderatedMap.get(user.id) || 0
    const activityScore =
      auditActions +
      registrations * 2 +
      confirmedParticipations * 3 +
      createdEvents * 4 +
      moderatedEvents * 2

    return {
      userId: user.id,
      name: user.name || user.email,
      email: user.email,
      role: user.role,
      auditActions,
      registrations,
      confirmedParticipations,
      createdEvents,
      moderatedEvents,
      activityScore,
    } satisfies ActiveUserMetric
  })

  return metrics
    .sort((left, right) => {
      if (right.activityScore !== left.activityScore) {
        return right.activityScore - left.activityScore
      }
      return right.confirmedParticipations - left.confirmedParticipations
    })
    .slice(0, limit)
}

export const getAdminDashboardMetrics = async (
  params: { now?: Date; from?: Date | null; to?: Date | null } = {}
): Promise<AdminDashboardMetricsResult> => {
  const now = params.now || new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = endOfDay(addDays(weekStart, 6))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const monthEnd = endOfDay(now)
  const periodBounds = toPeriodBounds({ from: params.from, to: params.to, now })

  const [
    popularWeek,
    popularMonth,
    siteTraffic,
    totalEvents,
    upcomingEvents,
    completedEvents,
    newsMaterials,
    registrationsThisMonth,
    confirmedThisMonth,
    pendingApprovals,
    upcomingWithoutModerators,
    eventsMissingContact,
    topStudents,
    topTeachers,
    periodEventsTotal,
    periodEventsUpcoming,
    periodEventsCompleted,
    attendanceStats,
  ] = await Promise.all([
    buildTopEventMetric(weekStart, weekEnd),
    buildTopEventMetric(monthStart, monthEnd),
    buildSiteTrafficMetrics(now),
    prisma.event.count({
      where: {
        removedFromCalendar: false,
        isNews: false,
        category: { not: EventCategory.NEWS },
      },
    }),
    prisma.event.count({
      where: {
        removedFromCalendar: false,
        isNews: false,
        category: { not: EventCategory.NEWS },
        date: { gte: now },
      },
    }),
    prisma.event.count({
      where: {
        removedFromCalendar: false,
        isNews: false,
        category: { not: EventCategory.NEWS },
        OR: [{ isPast: true }, { date: { lt: now } }],
      },
    }),
    prisma.event.count({
      where: {
        OR: [{ isNews: true }, { category: EventCategory.NEWS }, { report: { isNot: null } }],
      },
    }),
    prisma.eventParticipant.count({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.eventParticipant.count({
      where: {
        status: ParticipantStatus.CONFIRMED,
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.eventParticipant.count({
      where: {
        status: ParticipantStatus.PENDING,
        event: {
          date: { gte: now },
        },
      },
    }),
    prisma.event.count({
      where: {
        date: { gte: now },
        isNews: false,
        category: { not: EventCategory.NEWS },
        moderators: { none: {} },
      },
    }),
    prisma.event.count({
      where: {
        OR: [{ contact: "" }, { responsible: "" }],
      },
    }),
    buildActiveUsersByRole(Role.STUDENT, monthStart, now, 5),
    buildActiveUsersByRole(Role.TEACHER, monthStart, now, 5),
    prisma.event.count({
      where: {
        removedFromCalendar: false,
        isNews: false,
        category: { not: EventCategory.NEWS },
        date: { gte: periodBounds.from, lte: periodBounds.to },
      },
    }),
    prisma.event.count({
      where: {
        removedFromCalendar: false,
        isNews: false,
        category: { not: EventCategory.NEWS },
        isPast: false,
        date: {
          gte: periodBounds.from > now ? periodBounds.from : now,
          lte: periodBounds.to,
        },
      },
    }),
    prisma.event.count({
      where: {
        removedFromCalendar: false,
        isNews: false,
        category: { not: EventCategory.NEWS },
        date: { gte: periodBounds.from, lte: periodBounds.to },
        OR: [{ isPast: true }, { date: { lt: now } }],
      },
    }),
    buildAttendanceStats({ from: periodBounds.from, to: periodBounds.to }),
  ])

  return {
    generatedAt: now.toISOString(),
    periods: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
    },
    popularEvents: {
      week: popularWeek,
      month: popularMonth,
    },
    siteTraffic,
    eventStats: {
      totalEvents,
      upcomingEvents,
      completedEvents,
      newsMaterials,
      registrationsThisMonth,
      confirmedThisMonth,
      pendingApprovals,
      registrationConversionPercent: safePercent(confirmedThisMonth, registrationsThisMonth),
    },
    periodSummary: {
      from: periodBounds.from.toISOString(),
      to: periodBounds.to.toISOString(),
      days: periodBounds.days,
      totalEvents: periodEventsTotal,
      upcomingEvents: periodEventsUpcoming,
      completedEvents: periodEventsCompleted,
      registrations: attendanceStats.totals.registrations,
      confirmed: attendanceStats.totals.confirmed,
      pending: attendanceStats.totals.pending,
      attendanceRatePercent: attendanceStats.totals.attendanceRatePercent,
    },
    attendanceStats: {
      byEvent: attendanceStats.byEvent,
      byStudent: attendanceStats.byStudent,
      byGroup: attendanceStats.byGroup,
      byDepartment: attendanceStats.byDepartment,
      byRole: attendanceStats.byRole,
    },
    topActive: {
      students: topStudents,
      teachers: topTeachers,
    },
    additional: {
      upcomingWithoutModerators,
      eventsMissingContact,
    },
  }
}

const sanitizeFileToken = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40)

const formatDateTime = (value: Date) =>
  value.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

export const buildEventAttendanceExcel = async (
  eventId: string
): Promise<EventExcelExportResult> => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: {
        select: { id: true, name: true, email: true, role: true },
      },
      moderators: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      eventParticipants: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              group: true,
            },
          },
        },
      },
      report: {
        select: {
          summary: true,
          reportDate: true,
          tasks: true,
          comment: true,
          activeParticipants: true,
          images: true,
        },
      },
    },
  })

  if (!event) {
    throw new ServiceError(404, "NOT_FOUND", "Мероприятие не найдено")
  }

  const confirmed = event.eventParticipants.filter(
    (participant) => participant.status === ParticipantStatus.CONFIRMED
  ).length
  const pending = event.eventParticipants.filter(
    (participant) => participant.status === ParticipantStatus.PENDING
  ).length

  const overviewRows = [
    { Metric: "Event ID", Value: event.id },
    { Metric: "Title", Value: event.title },
    { Metric: "Category", Value: event.category },
    { Metric: "Date", Value: formatDateTime(event.date) },
    { Metric: "Time", Value: event.time },
    { Metric: "Duration", Value: event.duration },
    { Metric: "Location", Value: event.location },
    { Metric: "Responsible", Value: event.responsible },
    { Metric: "Contact", Value: event.contact },
    { Metric: "Creator", Value: event.creator.name || event.creator.email },
    { Metric: "Max Participants", Value: event.maxParticipants },
    { Metric: "Current Participants", Value: event.currentParticipants },
    { Metric: "Confirmed Participants", Value: confirmed },
    { Metric: "Pending Participants", Value: pending },
    { Metric: "Is Past", Value: event.isPast ? "Yes" : "No" },
    { Metric: "Is News", Value: event.isNews ? "Yes" : "No" },
  ]

  const normalizeActiveParticipantKey = (value: string) => value.trim().toLowerCase()
  const activeParticipantKeys = new Set(
    (event.report?.activeParticipants || []).map(normalizeActiveParticipantKey)
  )

  const attendeesRows = event.eventParticipants.map((participant) => ({
    Status: participant.status,
    Name: participant.user.name || "",
    Email: participant.user.email,
    Role: participant.user.role,
    Department: participant.user.department || "",
    Group: participant.user.group || "",
    RegisteredAt: formatDateTime(participant.createdAt),
    UpdatedAt: formatDateTime(participant.updatedAt),
    ActiveInReport:
      activeParticipantKeys.has(
        normalizeActiveParticipantKey(participant.user.name || participant.user.email)
      )
        ? "Yes"
        : "No",
  }))

  const moderatorsRows = event.moderators.map((row) => ({
    Name: row.user.name || "",
    Email: row.user.email,
    Role: row.user.role,
  }))

  const reportRows = event.report
    ? [
        { Field: "Summary", Value: event.report.summary },
        { Field: "Report Date", Value: formatDateTime(event.report.reportDate) },
        { Field: "Tasks Count", Value: event.report.tasks.length },
        { Field: "Images Count", Value: event.report.images.length },
        { Field: "Active Participants Count", Value: event.report.activeParticipants.length },
        { Field: "Comment", Value: event.report.comment || "" },
      ]
    : [{ Field: "Report", Value: "No report attached" }]

  const activeParticipantsRows = (event.report?.activeParticipants || []).map((name, index) => ({
    No: index + 1,
    Name: name,
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(overviewRows),
    "Event Overview"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(attendeesRows.length ? attendeesRows : [{ Status: "No attendees" }]),
    "Attendees"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      activeParticipantsRows.length
        ? activeParticipantsRows
        : [{ Name: "No active participants in report" }]
    ),
    "Active Participants"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(moderatorsRows.length ? moderatorsRows : [{ Name: "No moderators" }]),
    "Moderators"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(reportRows),
    "Report"
  )

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer
  const dateToken = toDateKey(new Date())
  const titleToken = sanitizeFileToken(event.title) || `event_${event.id.slice(0, 8)}`
  const fileName = `event_attendance_${titleToken}_${dateToken}.xlsx`

  return { fileName, buffer }
}
