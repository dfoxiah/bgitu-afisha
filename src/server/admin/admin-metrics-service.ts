/**
 * File responsibility:
 * Admin metrics and analytics service for dashboard widgets and XLSX exports.
 *
 * Main logic:
 * - Aggregate monthly/weekly popularity and activity statistics
 * - Build top active students and content staff rankings
 * - Generate event attendance workbook for Excel export
 *
 * Integrations:
 * - src/app/api/admin/metrics/route.ts
 * - src/app/api/admin/events/[id]/export/route.ts
 */

import { EventCategory, ParticipantStatus, Role } from "@prisma/client"
import { ROLE_LABELS } from "@/lib/roles"
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
  activeParticipants: number
  uniqueStudents: number
  activeStudents: number
  activeStudentsRatePercent: number
  averageFillRatePercent: number
  averageConfirmationRatePercent: number
  reportedActiveEntries: number
  matchedActiveEntries: number
  unmatchedActiveEntries: number
  activeMatchingQualityPercent: number
  averageRegistrationsPerEvent: number
  averageConfirmedPerEvent: number
  averageActiveStudentsPerEvent: number
}

type EventAttendanceMetric = {
  eventId: string
  title: string
  date: string
  confirmed: number
  pending: number
  registrations: number
  total: number
  maxParticipants: number
  fillRatePercent: number
  confirmedRatePercent: number
  confirmedStudents: number
  activeParticipants: number
  activeStudents: number
  activeStudentsRatePercent: number
  reportedActiveCount: number
  matchedActiveEntries: number
  activeMatchRatePercent: number
  activeUnmatched: number
}

type StudentAttendanceMetric = {
  userId: string
  name: string
  email: string
  group: string
  department: string
  confirmed: number
  pending: number
  active: number
  total: number
  confirmationRatePercent: number
  activityRatePercent: number
}

type GroupAttendanceMetric = {
  group: string
  confirmed: number
  pending: number
  active: number
  total: number
  uniqueStudents: number
  confirmationRatePercent: number
  activityRatePercent: number
}

type DepartmentAttendanceMetric = {
  department: string
  confirmed: number
  pending: number
  active: number
  total: number
  uniqueStudents: number
  confirmationRatePercent: number
  activityRatePercent: number
}

type RoleAttendanceMetric = {
  role: Role
  confirmed: number
  pending: number
  active: number
  total: number
  confirmationRatePercent: number
  activityRatePercent: number
}

type AttendanceSummaryMetric = {
  registrations: number
  confirmed: number
  pending: number
  attendanceRatePercent: number
  activeParticipants: number
  uniqueStudents: number
  activeStudents: number
  activeStudentsRatePercent: number
  averageFillRatePercent: number
  averageConfirmationRatePercent: number
  reportedActiveEntries: number
  matchedActiveEntries: number
  unmatchedActiveEntries: number
  activeMatchingQualityPercent: number
  averageRegistrationsPerEvent: number
  averageConfirmedPerEvent: number
  averageActiveStudentsPerEvent: number
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
    summary: AttendanceSummaryMetric
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
  const match = value.trim().match(/(\d{1,2}):(\d{2})/)
  if (!match) return 0
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return 0
  return hh * 60 + mm
}

const normalizeActiveParticipantKey = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()

const averagePercent = (values: number[]) => {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, value) => acc + value, 0)
  return Math.round((sum / values.length) * 10) / 10
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
      report: {
        select: {
          activeParticipants: true,
        },
      },
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
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
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
      active: number
    }
  >()

  const byGroupMap = new Map<
    string,
    {
      group: string
      confirmed: number
      pending: number
      active: number
      studentIds: Set<string>
    }
  >()
  const byDepartmentMap = new Map<
    string,
    {
      department: string
      confirmed: number
      pending: number
      active: number
      studentIds: Set<string>
    }
  >()
  const byRoleMap = new Map<Role, { role: Role; confirmed: number; pending: number; active: number }>()
  const uniqueStudentIds = new Set<string>()
  const activeStudentIds = new Set<string>()
  let reportedActiveEntriesTotal = 0
  let matchedActiveEntriesTotal = 0
  let unmatchedActiveEntriesTotal = 0

  const allEventMetrics: EventAttendanceMetric[] = events
    .map((event) => {
      const confirmedRows = event.eventParticipants.filter(
        (row) => row.status === ParticipantStatus.CONFIRMED
      )
      const pendingRows = event.eventParticipants.filter(
        (row) => row.status === ParticipantStatus.PENDING
      )
      const confirmed = confirmedRows.length
      const pending = pendingRows.length
      const registrations = confirmed + pending
      const total = registrations
      const confirmedStudents = confirmedRows.filter((row) => row.user.role === Role.STUDENT).length
      const maxParticipants = event.maxParticipants || 0

      const participantRows = event.eventParticipants.map((row) => {
        const keys = new Set<string>([normalizeActiveParticipantKey(row.user.email)])
        if (row.user.name) {
          keys.add(normalizeActiveParticipantKey(row.user.name))
        }

        return {
          ...row,
          keys,
        }
      })

      const activeParticipantIds = new Set<string>()
      const activeStudentIdsInEvent = new Set<string>()
      let reportedActiveCount = 0
      let matchedActiveEntries = 0
      let activeUnmatched = 0

      for (const rawName of event.report?.activeParticipants || []) {
        const key = normalizeActiveParticipantKey(rawName)
        if (!key) continue
        reportedActiveCount += 1

        const matched = participantRows.find((row) => row.keys.has(key))
        if (!matched) {
          activeUnmatched += 1
          continue
        }

        matchedActiveEntries += 1
        activeParticipantIds.add(matched.user.id)
        if (matched.user.role === Role.STUDENT) {
          activeStudentIdsInEvent.add(matched.user.id)
        }
      }

      event.eventParticipants.forEach((row) => {
        const isActive = activeParticipantIds.has(row.user.id)
        const roleKey = row.user.role
        const roleBucket = byRoleMap.get(roleKey) || {
          role: roleKey,
          confirmed: 0,
          pending: 0,
          active: 0,
        }
        if (row.status === ParticipantStatus.CONFIRMED) roleBucket.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) roleBucket.pending += 1
        if (isActive) roleBucket.active += 1
        byRoleMap.set(roleKey, roleBucket)

        if (row.user.role !== Role.STUDENT) return

        uniqueStudentIds.add(row.user.id)
        if (isActive) activeStudentIds.add(row.user.id)

        const student = byStudentMap.get(row.user.id) || {
          userId: row.user.id,
          name: row.user.name || row.user.email,
          email: row.user.email,
          group: row.user.group || 'Не указана',
          department: row.user.department || 'Не указан',
          confirmed: 0,
          pending: 0,
          active: 0,
        }
        if (row.status === ParticipantStatus.CONFIRMED) student.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) student.pending += 1
        if (isActive) student.active += 1
        byStudentMap.set(row.user.id, student)

        const groupKey = row.user.group || 'Не указана'
        const groupBucket = byGroupMap.get(groupKey) || {
          group: groupKey,
          confirmed: 0,
          pending: 0,
          active: 0,
          studentIds: new Set<string>(),
        }
        if (row.status === ParticipantStatus.CONFIRMED) groupBucket.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) groupBucket.pending += 1
        if (isActive) groupBucket.active += 1
        groupBucket.studentIds.add(row.user.id)
        byGroupMap.set(groupKey, groupBucket)

        const departmentKey = row.user.department || 'Не указан'
        const departmentBucket = byDepartmentMap.get(departmentKey) || {
          department: departmentKey,
          confirmed: 0,
          pending: 0,
          active: 0,
          studentIds: new Set<string>(),
        }
        if (row.status === ParticipantStatus.CONFIRMED) departmentBucket.confirmed += 1
        if (row.status === ParticipantStatus.PENDING) departmentBucket.pending += 1
        if (isActive) departmentBucket.active += 1
        departmentBucket.studentIds.add(row.user.id)
        byDepartmentMap.set(departmentKey, departmentBucket)
      })

      const fillRatePercent =
        maxParticipants > 0 ? safePercent(confirmed, maxParticipants) : confirmed > 0 ? 100 : 0
      const confirmedRatePercent = safePercent(confirmed, registrations)
      const activeParticipants = activeParticipantIds.size
      const activeStudents = activeStudentIdsInEvent.size
      const activeStudentsRatePercent = safePercent(activeStudents, confirmedStudents)
      const activeMatchRatePercent = safePercent(matchedActiveEntries, reportedActiveCount)

      reportedActiveEntriesTotal += reportedActiveCount
      matchedActiveEntriesTotal += matchedActiveEntries
      unmatchedActiveEntriesTotal += activeUnmatched

      return {
        eventId: event.id,
        title: event.title,
        date: toEventDateTime(event.date, event.time).toISOString(),
        confirmed,
        pending,
        registrations,
        total,
        maxParticipants,
        fillRatePercent,
        confirmedRatePercent,
        confirmedStudents,
        activeParticipants,
        activeStudents,
        activeStudentsRatePercent,
        reportedActiveCount,
        matchedActiveEntries,
        activeMatchRatePercent,
        activeUnmatched,
      } satisfies EventAttendanceMetric
    })
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      if (right.activeStudents !== left.activeStudents) return right.activeStudents - left.activeStudents
      if (right.total !== left.total) return right.total - left.total
      return new Date(left.date).getTime() - new Date(right.date).getTime()
    })
  const byEvent = allEventMetrics.slice(0, 25)

  const byStudent = Array.from(byStudentMap.values())
    .map((student) => ({
      ...student,
      total: student.confirmed + student.pending,
      confirmationRatePercent: safePercent(student.confirmed, student.confirmed + student.pending),
      activityRatePercent: safePercent(student.active, student.confirmed),
    }))
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      if (right.active !== left.active) return right.active - left.active
      return right.total - left.total
    })
    .slice(0, 30)

  const byGroup = Array.from(byGroupMap.values())
    .map((group) => ({
      group: group.group,
      confirmed: group.confirmed,
      pending: group.pending,
      active: group.active,
      total: group.confirmed + group.pending,
      uniqueStudents: group.studentIds.size,
      confirmationRatePercent: safePercent(group.confirmed, group.confirmed + group.pending),
      activityRatePercent: safePercent(group.active, group.confirmed),
    }))
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      if (right.active !== left.active) return right.active - left.active
      return right.total - left.total
    })
    .slice(0, 20)

  const byDepartment = Array.from(byDepartmentMap.values())
    .map((department) => ({
      department: department.department,
      confirmed: department.confirmed,
      pending: department.pending,
      active: department.active,
      total: department.confirmed + department.pending,
      uniqueStudents: department.studentIds.size,
      confirmationRatePercent: safePercent(
        department.confirmed,
        department.confirmed + department.pending
      ),
      activityRatePercent: safePercent(department.active, department.confirmed),
    }))
    .sort((left, right) => {
      if (right.confirmed !== left.confirmed) return right.confirmed - left.confirmed
      if (right.active !== left.active) return right.active - left.active
      return right.total - left.total
    })
    .slice(0, 20)

  const byRole = Array.from(byRoleMap.values())
    .map((roleItem) => ({
      role: roleItem.role,
      confirmed: roleItem.confirmed,
      pending: roleItem.pending,
      active: roleItem.active,
      total: roleItem.confirmed + roleItem.pending,
      confirmationRatePercent: safePercent(roleItem.confirmed, roleItem.confirmed + roleItem.pending),
      activityRatePercent: safePercent(roleItem.active, roleItem.confirmed),
    }))
    .sort((left, right) => right.total - left.total)

  const registrations = byRole.reduce((sum, row) => sum + row.total, 0)
  const confirmed = byRole.reduce((sum, row) => sum + row.confirmed, 0)
  const pending = byRole.reduce((sum, row) => sum + row.pending, 0)
  const activeParticipants = byRole.reduce((sum, row) => sum + row.active, 0)
  const uniqueStudents = uniqueStudentIds.size
  const activeStudents = activeStudentIds.size
  const eventsCount = allEventMetrics.length
  const totalActiveStudentsInEvents = allEventMetrics.reduce(
    (sum, row) => sum + row.activeStudents,
    0
  )

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
      activeParticipants,
      uniqueStudents,
      activeStudents,
      activeStudentsRatePercent: safePercent(activeStudents, uniqueStudents),
      averageFillRatePercent: averagePercent(
        allEventMetrics.map((row) => row.fillRatePercent)
      ),
      averageConfirmationRatePercent: averagePercent(
        allEventMetrics.map((row) => row.confirmedRatePercent)
      ),
      reportedActiveEntries: reportedActiveEntriesTotal,
      matchedActiveEntries: matchedActiveEntriesTotal,
      unmatchedActiveEntries: unmatchedActiveEntriesTotal,
      activeMatchingQualityPercent: safePercent(
        matchedActiveEntriesTotal,
        reportedActiveEntriesTotal
      ),
      averageRegistrationsPerEvent: eventsCount > 0 ? Math.round((registrations / eventsCount) * 10) / 10 : 0,
      averageConfirmedPerEvent: eventsCount > 0 ? Math.round((confirmed / eventsCount) * 10) / 10 : 0,
      averageActiveStudentsPerEvent:
        eventsCount > 0 ? Math.round((totalActiveStudentsInEvents / eventsCount) * 10) / 10 : 0,
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
  roles: Role[],
  monthStart: Date,
  now: Date,
  limit: number
) => {
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
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
    buildActiveUsersByRole([Role.STUDENT], monthStart, now, 5),
    buildActiveUsersByRole([Role.TEACHER, Role.EDITOR], monthStart, now, 5),
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
      activeParticipants: attendanceStats.totals.activeParticipants,
      uniqueStudents: attendanceStats.totals.uniqueStudents,
      activeStudents: attendanceStats.totals.activeStudents,
      activeStudentsRatePercent: attendanceStats.totals.activeStudentsRatePercent,
      averageFillRatePercent: attendanceStats.totals.averageFillRatePercent,
      averageConfirmationRatePercent: attendanceStats.totals.averageConfirmationRatePercent,
      reportedActiveEntries: attendanceStats.totals.reportedActiveEntries,
      matchedActiveEntries: attendanceStats.totals.matchedActiveEntries,
      unmatchedActiveEntries: attendanceStats.totals.unmatchedActiveEntries,
      activeMatchingQualityPercent: attendanceStats.totals.activeMatchingQualityPercent,
      averageRegistrationsPerEvent: attendanceStats.totals.averageRegistrationsPerEvent,
      averageConfirmedPerEvent: attendanceStats.totals.averageConfirmedPerEvent,
      averageActiveStudentsPerEvent: attendanceStats.totals.averageActiveStudentsPerEvent,
    },
    attendanceStats: {
      summary: attendanceStats.totals,
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

  const confirmedRows = event.eventParticipants.filter(
    (participant) => participant.status === ParticipantStatus.CONFIRMED
  )
  const pendingRows = event.eventParticipants.filter(
    (participant) => participant.status === ParticipantStatus.PENDING
  )
  const confirmed = confirmedRows.length
  const pending = pendingRows.length
  const registrations = confirmed + pending
  const confirmedStudents = confirmedRows.filter((participant) => participant.user.role === Role.STUDENT).length
  const allStudents = event.eventParticipants.filter(
    (participant) => participant.user.role === Role.STUDENT
  ).length
  const fillRatePercent =
    event.maxParticipants > 0 ? safePercent(confirmed, event.maxParticipants) : confirmed > 0 ? 100 : 0
  const confirmationRatePercent = safePercent(confirmed, registrations)
  const roleLabelMap: Record<Role, string> = ROLE_LABELS
  const statusLabelMap: Record<ParticipantStatus, string> = {
    [ParticipantStatus.CONFIRMED]: "Подтверждено",
    [ParticipantStatus.PENDING]: "Ожидает подтверждения",
  }
  const categoryLabelMap: Record<EventCategory, string> = {
    [EventCategory.CONCERT]: "Концерт",
    [EventCategory.INTERNAL_ACTIVITY]: "Внутривузовская активность",
    [EventCategory.PUBLIC_EVENT]: "Общественное мероприятие",
    [EventCategory.COMPETITION]: "Соревнование",
    [EventCategory.LECTURE]: "Лекция",
    [EventCategory.MASTERCLASS]: "Мастер-класс",
    [EventCategory.VOLUNTEER]: "Волонтерская активность",
    [EventCategory.NEWS]: "Новость",
  }
  const toYesNo = (value: boolean) => (value ? "Да" : "Нет")
  const qualityLevel = (value: number) => {
    if (value >= 90) return "Отлично"
    if (value >= 75) return "Хорошо"
    if (value >= 50) return "Средне"
    return "Требует внимания"
  }

  const overviewRows = [
    { Показатель: "ID мероприятия", Значение: event.id },
    { Показатель: "Название", Значение: event.title },
    { Показатель: "Категория", Значение: categoryLabelMap[event.category] || event.category },
    { Показатель: "Дата проведения", Значение: formatDateTime(event.date) },
    { Показатель: "Время", Значение: event.time },
    { Показатель: "Длительность", Значение: event.duration },
    { Показатель: "Локация", Значение: event.location },
    { Показатель: "Руководитель", Значение: event.responsible },
    { Показатель: "Контакт", Значение: event.contact },
    { Показатель: "Создатель", Значение: event.creator.name || event.creator.email },
    { Показатель: "Максимум участников", Значение: event.maxParticipants },
    { Показатель: "Текущий счетчик участников", Значение: event.currentParticipants },
    { Показатель: "Подтверждено", Значение: confirmed },
    { Показатель: "Ожидают подтверждения", Значение: pending },
    { Показатель: "Всего регистраций", Значение: registrations },
    { Показатель: "Конверсия подтверждения, %", Значение: confirmationRatePercent },
    { Показатель: "Заполнение мест, %", Значение: fillRatePercent },
    { Показатель: "Прошедшее мероприятие", Значение: toYesNo(event.isPast) },
    { Показатель: "Новостной материал", Значение: toYesNo(event.isNews) },
  ]

  const participantByKey = new Map<
    string,
    (typeof event.eventParticipants)[number]
  >()
  event.eventParticipants.forEach((participant) => {
    participantByKey.set(normalizeActiveParticipantKey(participant.user.email), participant)
    if (participant.user.name) {
      participantByKey.set(normalizeActiveParticipantKey(participant.user.name), participant)
    }
  })

  const activeParticipantsSet = new Set<string>()
  const activeStudentsSet = new Set<string>()
  const activeParticipantRows = (event.report?.activeParticipants || []).map((name, index) => {
    const key = normalizeActiveParticipantKey(name)
    const matched = key ? participantByKey.get(key) : null

    if (matched) {
      activeParticipantsSet.add(matched.user.id)
      if (matched.user.role === Role.STUDENT) {
        activeStudentsSet.add(matched.user.id)
      }
    }

    return {
      "№": index + 1,
      "ФИО из отчета": name,
      "Сопоставлено": toYesNo(Boolean(matched)),
      "ФИО в системе": matched?.user.name || "",
      "Эл. почта в системе": matched?.user.email || "",
      "Роль": matched ? roleLabelMap[matched.user.role] : "",
      "Группа": matched?.user.group || "",
      "Факультет/кафедра": matched?.user.department || "",
    }
  })

  const activeParticipants = activeParticipantsSet.size
  const activeStudents = activeStudentsSet.size
  const activeStudentsRatePercent = safePercent(activeStudents, confirmedStudents)
  const activeUnmatched = activeParticipantRows.filter((row) => row["Сопоставлено"] === "Нет").length
  const reportedActiveCount = activeParticipantRows.length
  const matchedActiveEntries = activeParticipantRows.filter((row) => row["Сопоставлено"] === "Да").length
  const activeMatchRatePercent = safePercent(matchedActiveEntries, reportedActiveCount)
  const activePendingParticipants = event.eventParticipants.filter(
    (participant) =>
      participant.status === ParticipantStatus.PENDING && activeParticipantsSet.has(participant.user.id)
  ).length
  const activeFromConfirmedPercent = safePercent(activeParticipants, confirmed)
  const pendingFromRegistrationsPercent = safePercent(pending, registrations)
  const studentSharePercent = safePercent(allStudents, registrations)
  const firstRegistrationAt = event.eventParticipants.at(0)?.createdAt || null
  const lastRegistrationAt = event.eventParticipants.at(-1)?.createdAt || null
  const lastParticipantUpdateAt = event.eventParticipants.reduce<Date | null>(
    (latest, participant) => {
      if (!latest) return participant.updatedAt
      return participant.updatedAt > latest ? participant.updatedAt : latest
    },
    null
  )
  const registrationWindowDays =
    firstRegistrationAt && lastRegistrationAt
      ? Math.max(
          1,
          Math.ceil(
            (lastRegistrationAt.getTime() - firstRegistrationAt.getTime() + 1) /
              (24 * 60 * 60 * 1000)
          )
        )
      : 0
  const avgRegistrationsPerDay =
    registrationWindowDays > 0
      ? Math.round((registrations / registrationWindowDays) * 100) / 100
      : 0

  overviewRows.push(
    {
      Показатель: "Первая регистрация",
      Значение: firstRegistrationAt ? formatDateTime(firstRegistrationAt) : "Нет регистраций",
    },
    {
      Показатель: "Последняя регистрация",
      Значение: lastRegistrationAt ? formatDateTime(lastRegistrationAt) : "Нет регистраций",
    },
    {
      Показатель: "Последнее изменение статуса",
      Значение: lastParticipantUpdateAt ? formatDateTime(lastParticipantUpdateAt) : "Нет данных",
    },
    {
      Показатель: "Окно регистрации, дней",
      Значение: registrationWindowDays || 0,
    },
    {
      Показатель: "Среднее регистраций в день",
      Значение: avgRegistrationsPerDay,
    }
  )

  const attendeesRows = event.eventParticipants.map((participant) => ({
    "Статус заявки": statusLabelMap[participant.status],
    "ФИО": participant.user.name || "",
    "Эл. почта": participant.user.email,
    "Роль": roleLabelMap[participant.user.role],
    "Факультет/кафедра": participant.user.department || "",
    "Группа": participant.user.group || "",
    "Дата регистрации": formatDateTime(participant.createdAt),
    "Дата обновления статуса": formatDateTime(participant.updatedAt),
    "Отмечен активным в отчете": toYesNo(activeParticipantsSet.has(participant.user.id)),
  }))

  const activeStudentsRows = event.eventParticipants
    .filter((participant) => participant.user.role === Role.STUDENT && activeStudentsSet.has(participant.user.id))
    .map((participant, index) => ({
      "№": index + 1,
      "ФИО": participant.user.name || "",
      "Эл. почта": participant.user.email,
      "Группа": participant.user.group || "",
      "Факультет/кафедра": participant.user.department || "",
      "Статус заявки": statusLabelMap[participant.status],
    }))

  const studentsMatrixRows = event.eventParticipants
    .filter((participant) => participant.user.role === Role.STUDENT)
    .map((participant, index) => ({
      "№": index + 1,
      "ФИО": participant.user.name || "",
      "Эл. почта": participant.user.email,
      "Группа": participant.user.group || "",
      "Факультет/кафедра": participant.user.department || "",
      "Статус заявки": statusLabelMap[participant.status],
      "Подтверждено": toYesNo(participant.status === ParticipantStatus.CONFIRMED),
      "Ожидает подтверждения": toYesNo(participant.status === ParticipantStatus.PENDING),
      "Активен по отчету": toYesNo(activeParticipantsSet.has(participant.user.id)),
    }))

  const moderatorsRows = event.moderators.map((row) => ({
    "ФИО": row.user.name || "",
    "Эл. почта": row.user.email,
    "Роль": roleLabelMap[row.user.role],
  }))

  const groupMap = new Map<
    string,
    { group: string; confirmed: number; pending: number; active: number; studentIds: Set<string> }
  >()
  const departmentMap = new Map<
    string,
    {
      department: string
      confirmed: number
      pending: number
      active: number
      studentIds: Set<string>
    }
  >()
  const roleMap = new Map<Role, { role: Role; confirmed: number; pending: number; active: number }>()
  const timelineMap = new Map<string, { date: string; registrations: number; confirmed: number; pending: number }>()

  event.eventParticipants.forEach((participant) => {
    const isActive = activeParticipantsSet.has(participant.user.id)
    const roleKey = participant.user.role
    const roleBucket = roleMap.get(roleKey) || { role: roleKey, confirmed: 0, pending: 0, active: 0 }
    if (participant.status === ParticipantStatus.CONFIRMED) roleBucket.confirmed += 1
    if (participant.status === ParticipantStatus.PENDING) roleBucket.pending += 1
    if (isActive) roleBucket.active += 1
    roleMap.set(roleKey, roleBucket)

    const timelineKey = toDateKey(participant.createdAt)
    const timelineBucket = timelineMap.get(timelineKey) || {
      date: timelineKey,
      registrations: 0,
      confirmed: 0,
      pending: 0,
    }
    timelineBucket.registrations += 1
    if (participant.status === ParticipantStatus.CONFIRMED) timelineBucket.confirmed += 1
    if (participant.status === ParticipantStatus.PENDING) timelineBucket.pending += 1
    timelineMap.set(timelineKey, timelineBucket)

    if (participant.user.role !== Role.STUDENT) return

    const groupKey = participant.user.group || "Не указана"
    const groupBucket = groupMap.get(groupKey) || {
      group: groupKey,
      confirmed: 0,
      pending: 0,
      active: 0,
      studentIds: new Set<string>(),
    }
    if (participant.status === ParticipantStatus.CONFIRMED) groupBucket.confirmed += 1
    if (participant.status === ParticipantStatus.PENDING) groupBucket.pending += 1
    if (isActive) groupBucket.active += 1
    groupBucket.studentIds.add(participant.user.id)
    groupMap.set(groupKey, groupBucket)

    const departmentKey = participant.user.department || "Не указан"
    const departmentBucket = departmentMap.get(departmentKey) || {
      department: departmentKey,
      confirmed: 0,
      pending: 0,
      active: 0,
      studentIds: new Set<string>(),
    }
    if (participant.status === ParticipantStatus.CONFIRMED) departmentBucket.confirmed += 1
    if (participant.status === ParticipantStatus.PENDING) departmentBucket.pending += 1
    if (isActive) departmentBucket.active += 1
    departmentBucket.studentIds.add(participant.user.id)
    departmentMap.set(departmentKey, departmentBucket)
  })

  const groupRows = Array.from(groupMap.values())
    .map((row) => ({
      "Группа": row.group,
      "Подтверждено": row.confirmed,
      "Ожидают подтверждения": row.pending,
      "Регистраций": row.confirmed + row.pending,
      "Активные студенты": row.active,
      "Уникальные студенты": row.studentIds.size,
      "Конверсия подтверждения, %": safePercent(row.confirmed, row.confirmed + row.pending),
      "Активность среди подтвержденных, %": safePercent(row.active, row.confirmed),
      "Доля от студенческих регистраций, %": safePercent(row.confirmed + row.pending, allStudents),
    }))
    .sort((left, right) => {
      if (right["Подтверждено"] !== left["Подтверждено"]) return right["Подтверждено"] - left["Подтверждено"]
      return right["Регистраций"] - left["Регистраций"]
    })

  const departmentRows = Array.from(departmentMap.values())
    .map((row) => ({
      "Факультет/кафедра": row.department,
      "Подтверждено": row.confirmed,
      "Ожидают подтверждения": row.pending,
      "Регистраций": row.confirmed + row.pending,
      "Активные студенты": row.active,
      "Уникальные студенты": row.studentIds.size,
      "Конверсия подтверждения, %": safePercent(row.confirmed, row.confirmed + row.pending),
      "Активность среди подтвержденных, %": safePercent(row.active, row.confirmed),
      "Доля от студенческих регистраций, %": safePercent(row.confirmed + row.pending, allStudents),
    }))
    .sort((left, right) => {
      if (right["Подтверждено"] !== left["Подтверждено"]) return right["Подтверждено"] - left["Подтверждено"]
      return right["Регистраций"] - left["Регистраций"]
    })

  const roleRows = Array.from(roleMap.values())
    .map((row) => ({
      "Роль": roleLabelMap[row.role],
      "Подтверждено": row.confirmed,
      "Ожидают подтверждения": row.pending,
      "Регистраций": row.confirmed + row.pending,
      "Активных участников": row.active,
      "Конверсия подтверждения, %": safePercent(row.confirmed, row.confirmed + row.pending),
      "Активность среди подтвержденных, %": safePercent(row.active, row.confirmed),
      "Доля от всех регистраций, %": safePercent(row.confirmed + row.pending, registrations),
    }))
    .sort((left, right) => right["Регистраций"] - left["Регистраций"])

  let cumulativeRegistrations = 0
  let cumulativeConfirmed = 0
  let cumulativePending = 0
  const timelineRows = Array.from(timelineMap.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => {
      cumulativeRegistrations += row.registrations
      cumulativeConfirmed += row.confirmed
      cumulativePending += row.pending
      return {
        "Дата": row.date,
        "Регистраций за день": row.registrations,
        "Подтверждено за день": row.confirmed,
        "Ожидают за день": row.pending,
        "Конверсия подтверждения за день, %": safePercent(row.confirmed, row.registrations),
        "Накопительно регистраций": cumulativeRegistrations,
        "Накопительно подтверждено": cumulativeConfirmed,
        "Накопительно ожидают": cumulativePending,
        "Накопительная конверсия, %": safePercent(cumulativeConfirmed, cumulativeRegistrations),
      }
    })

  const kpiRows = [
    { "Показатель": "Всего регистраций", "Значение": registrations, "Интерпретация": "Общее число заявок" },
    { "Показатель": "Подтверждено", "Значение": confirmed, "Интерпретация": "Заявки со статусом подтверждено" },
    { "Показатель": "Ожидают подтверждения", "Значение": pending, "Интерпретация": "Заявки в ожидании" },
    { "Показатель": "Конверсия подтверждения, %", "Значение": confirmationRatePercent, "Интерпретация": qualityLevel(confirmationRatePercent) },
    { "Показатель": "Заполнение мест, %", "Значение": fillRatePercent, "Интерпретация": qualityLevel(fillRatePercent) },
    { "Показатель": "Студенты среди всех регистраций, %", "Значение": studentSharePercent, "Интерпретация": "Доля студенческой аудитории" },
    { "Показатель": "Студентов (все статусы)", "Значение": allStudents, "Интерпретация": "Количество студентов в заявках" },
    { "Показатель": "Студентов (подтверждено)", "Значение": confirmedStudents, "Интерпретация": "Подтвержденные студенты" },
    { "Показатель": "Активные участники (сопоставлено)", "Значение": activeParticipants, "Интерпретация": "По данным отчета" },
    { "Показатель": "Активные записи в отчете", "Значение": reportedActiveCount, "Интерпретация": "Сколько имен указано в activeParticipants" },
    { "Показатель": "Сопоставленные active-записи", "Значение": matchedActiveEntries, "Интерпретация": "Совпали с участниками мероприятия" },
    { "Показатель": "Качество сопоставления active, %", "Значение": activeMatchRatePercent, "Интерпретация": qualityLevel(activeMatchRatePercent) },
    { "Показатель": "Активные студенты", "Значение": activeStudents, "Интерпретация": "Студенты с подтверждением и активностью" },
    { "Показатель": "Активные студенты / подтвержденные студенты, %", "Значение": activeStudentsRatePercent, "Интерпретация": qualityLevel(activeStudentsRatePercent) },
    { "Показатель": "Активные среди подтвержденных, %", "Значение": activeFromConfirmedPercent, "Интерпретация": "Доля активных участников среди подтвержденных" },
    { "Показатель": "Ожидают от всех регистраций, %", "Значение": pendingFromRegistrationsPercent, "Интерпретация": "Доля заявок в ожидании подтверждения" },
    { "Показатель": "Активных со статусом ожидания", "Значение": activePendingParticipants, "Интерпретация": "Нужна сверка статусов участников" },
    { "Показатель": "Несопоставленных имен из активности", "Значение": activeUnmatched, "Интерпретация": "Имена из отчета не найдены среди участников" },
  ]

  const funnelRows = [
    {
      "Этап": "Регистрации",
      "Количество": registrations,
      "Конверсия к предыдущему этапу, %": 100,
      "Доля от регистраций, %": 100,
    },
    {
      "Этап": "Подтверждено",
      "Количество": confirmed,
      "Конверсия к предыдущему этапу, %": safePercent(confirmed, registrations),
      "Доля от регистраций, %": safePercent(confirmed, registrations),
    },
    {
      "Этап": "Активные участники",
      "Количество": activeParticipants,
      "Конверсия к предыдущему этапу, %": safePercent(activeParticipants, confirmed),
      "Доля от регистраций, %": safePercent(activeParticipants, registrations),
    },
    {
      "Этап": "Активные студенты",
      "Количество": activeStudents,
      "Конверсия к предыдущему этапу, %": safePercent(activeStudents, activeParticipants),
      "Доля от регистраций, %": safePercent(activeStudents, registrations),
    },
  ]

  const qualityRows = [
    {
      "Проверка": "Active-записей в отчете",
      "Значение": reportedActiveCount,
      "Комментарий": "Сколько активных участников указано в отчете",
    },
    {
      "Проверка": "Сопоставленных active-записей",
      "Значение": matchedActiveEntries,
      "Комментарий": "Сколько активных удалось сопоставить с участниками",
    },
    {
      "Проверка": "Несопоставленных active-записей",
      "Значение": activeUnmatched,
      "Комментарий": "Сколько записей из отчета не удалось сопоставить",
    },
    {
      "Проверка": "Качество сопоставления, %",
      "Значение": activeMatchRatePercent,
      "Комментарий": "Доля совпадений active-записей отчета",
    },
    {
      "Проверка": "Активные студенты / подтвержденные студенты, %",
      "Значение": activeStudentsRatePercent,
      "Комментарий": "Доля активных студентов среди подтвержденных",
    },
    {
      "Проверка": "Конверсия подтверждения, %",
      "Значение": confirmationRatePercent,
      "Комментарий": "Доля confirmed среди всех регистраций",
    },
    {
      "Проверка": "Заполнение мест, %",
      "Значение": fillRatePercent,
      "Комментарий": "Доля занятых мест от лимита мероприятия",
    },
  ]

  const unmatchedActiveRows = activeParticipantRows
    .filter((row) => row["Сопоставлено"] === "Нет")
    .map((row, index) => ({
      "№": index + 1,
      "ФИО из отчета": row["ФИО из отчета"],
    }))

  const reportRows = event.report
    ? [
        { "Поле": "Сводка отчета", "Значение": event.report.summary },
        { "Поле": "Дата отчета", "Значение": formatDateTime(event.report.reportDate) },
        { "Поле": "Количество задач", "Значение": event.report.tasks.length },
        { "Поле": "Количество медиа", "Значение": event.report.images.length },
        { "Поле": "Количество active-участников", "Значение": event.report.activeParticipants.length },
        { "Поле": "Комментарий", "Значение": event.report.comment || "" },
      ]
    : [{ "Поле": "Отчет", "Значение": "Отчет не прикреплен" }]

  const reportTasksRows = event.report?.tasks?.length
    ? event.report.tasks.map((task, index) => ({
        "№": index + 1,
        "Задача": task,
      }))
    : [{ "Задача": "Нет задач в отчете" }]

  const reportMediaRows = event.report?.images?.length
    ? event.report.images.map((image, index) => ({
        "№": index + 1,
        "Медиа/ссылка": image,
      }))
    : [{ "Медиа/ссылка": "Нет медиа в отчете" }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(overviewRows),
    "Обзор"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(kpiRows),
    "KPI"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(funnelRows),
    "Воронка"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      attendeesRows.length ? attendeesRows : [{ "Статус заявки": "Нет участников" }]
    ),
    "Участники"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      activeParticipantRows.length
        ? activeParticipantRows
        : [{ "ФИО из отчета": "В отчете нет активных участников" }]
    ),
    "Активность отчета"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      activeStudentsRows.length
        ? activeStudentsRows
        : [{ "ФИО": "В отчете не найдены активные студенты" }]
    ),
    "Активные студенты"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      studentsMatrixRows.length
        ? studentsMatrixRows
        : [{ "ФИО": "В списке участников нет студентов" }]
    ),
    "Матрица студентов"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      groupRows.length ? groupRows : [{ "Группа": "Нет данных по группам" }]
    ),
    "По группам"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      departmentRows.length
        ? departmentRows
        : [{ "Факультет/кафедра": "Нет данных по факультетам/кафедрам" }]
    ),
    "По факультетам"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(roleRows.length ? roleRows : [{ "Роль": "Нет данных по ролям" }]),
    "По ролям"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      timelineRows.length
        ? timelineRows
        : [{ "Дата": "Нет данных по динамике регистраций" }]
    ),
    "Динамика регистрации"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(qualityRows),
    "Качество данных"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      unmatchedActiveRows.length
        ? unmatchedActiveRows
        : [{ "ФИО из отчета": "Нет несопоставленных active-записей" }]
    ),
    "Несопоставленные"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      moderatorsRows.length ? moderatorsRows : [{ "ФИО": "Модераторы не назначены" }]
    ),
    "Модераторы"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(reportRows),
    "Отчет сводка"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(reportTasksRows),
    "Отчет задачи"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(reportMediaRows),
    "Отчет медиа"
  )

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer
  const dateToken = toDateKey(new Date())
  const titleToken = sanitizeFileToken(event.title) || `event_${event.id.slice(0, 8)}`
  const fileName = `event_attendance_${titleToken}_${dateToken}.xlsx`

  return { fileName, buffer }
}

