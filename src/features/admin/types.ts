/**
 * File responsibility:
 * Shared admin panel client-side types.
 *
 * Main logic:
 * - Define DTO-like shapes used by admin API adapters and page UI
 * - Keep admin feature type contracts centralized
 *
 * Integrations:
 * - src/features/admin/client/admin-api.ts
 * - src/app/admin/page.tsx
 */

import type { Role, EventCategory } from "@prisma/client"

export type AdminUser = {
  id: string
  name: string | null
  email: string
  role: Role
  department: string | null
  group: string | null
  groupChangeCount: number
  bio: string | null
  privacyConsentAt?: string | null
  termsConsentAt?: string | null
  createdAt: string
  updatedAt?: string
}

export type AdminUserCreateInput = {
  name: string
  email: string
  password: string
  role: Role
  department?: string
  group?: string
}

export type AdminUserUpdateInput = {
  name?: string
  email?: string
  password?: string
  role?: Role
  department?: string | null
  group?: string | null
  groupChangeCount?: number
  bio?: string | null
}

export type AdminEventModerator = {
  id: string
  name: string | null
  email: string
}

export type AdminEvent = {
  id: string
  title: string
  category: EventCategory
  date: string
  time: string
  duration?: string
  location: string
  description?: string
  maxParticipants: number
  currentParticipants?: number
  confirmedParticipants?: number
  pendingParticipants?: number
  isPast: boolean
  isNews?: boolean
  removedFromCalendar?: boolean
  images?: string[]
  responsible?: string
  contact?: string
  creator: { id: string; name: string | null; email: string }
  moderators: AdminEventModerator[]
}

export type AdminEventReport = {
  id?: string
  summary: string
  reportDate: string
  images: string[]
  tasks?: string[]
  comment?: string | null
}

export type AdminEventDetails = AdminEvent & {
  participants?: Array<{
    id: string
    name: string | null
    email: string
    role: Role
  }>
  pendingParticipants?: Array<{
    id: string
    name: string | null
    email: string
    role: Role
  }>
  report?: AdminEventReport | null
}

export type AdminEventUpdateInput = {
  title?: string
  category?: EventCategory
  date?: string
  time?: string
  duration?: string
  location?: string
  description?: string
  maxParticipants?: number
  isNews?: boolean
  removedFromCalendar?: boolean
  images?: string[]
  responsible?: string
  responsibleId?: string
  contact?: string
  moderators?: string[]
  report?: {
    summary?: string
    reportDate?: string
    images?: string[]
    tasks?: string[]
    comment?: string | null
  }
}

export type AdminNewsCreateInput = {
  title: string
  content: string
  date: string
  images: string[]
  tasks?: string[]
  reportComment?: string
  createReport?: boolean
}

export type AdminAuditLog = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: string
  actor?: {
    id: string
    name: string | null
    email: string | null
    role?: string | null
  } | null
  metadata?: Record<string, unknown> | null
}

export type AdminImportMode = "upsert" | "create"

export type AdminImportResult = {
  created: number
  updated: number
  skipped: number
  errors: string[]
  warnings: string[]
}

export type AdminPopularEventMetric = {
  id: string
  title: string
  date: string
  responsible: string
  confirmedParticipants: number
}

export type AdminSiteTrafficPoint = {
  date: string
  actions: number
  uniqueUsers: number
  signIns: number
}

export type AdminActiveUserMetric = {
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

export type AdminPeriodSummaryMetric = {
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

export type AdminEventAttendanceMetric = {
  eventId: string
  title: string
  date: string
  confirmed: number
  pending: number
  total: number
  maxParticipants: number
  fillRatePercent: number
}

export type AdminStudentAttendanceMetric = {
  userId: string
  name: string
  email: string
  group: string
  department: string
  confirmed: number
  pending: number
  total: number
}

export type AdminGroupAttendanceMetric = {
  group: string
  confirmed: number
  pending: number
  total: number
  uniqueStudents: number
}

export type AdminDepartmentAttendanceMetric = {
  department: string
  confirmed: number
  pending: number
  total: number
  uniqueStudents: number
}

export type AdminRoleAttendanceMetric = {
  role: Role
  confirmed: number
  pending: number
  total: number
}

export type AdminDashboardMetrics = {
  generatedAt: string
  periods: {
    weekStart: string
    weekEnd: string
    monthStart: string
    monthEnd: string
  }
  popularEvents: {
    week: AdminPopularEventMetric | null
    month: AdminPopularEventMetric | null
  }
  siteTraffic: {
    actionsLast7Days: number
    signInsLast7Days: number
    uniqueUsersLast7Days: number
    dailyActivity: AdminSiteTrafficPoint[]
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
  periodSummary: AdminPeriodSummaryMetric
  attendanceStats: {
    byEvent: AdminEventAttendanceMetric[]
    byStudent: AdminStudentAttendanceMetric[]
    byGroup: AdminGroupAttendanceMetric[]
    byDepartment: AdminDepartmentAttendanceMetric[]
    byRole: AdminRoleAttendanceMetric[]
  }
  topActive: {
    students: AdminActiveUserMetric[]
    teachers: AdminActiveUserMetric[]
  }
  additional: {
    upcomingWithoutModerators: number
    eventsMissingContact: number
  }
}
