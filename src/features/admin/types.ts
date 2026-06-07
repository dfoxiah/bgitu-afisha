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

import type { Role, EventCategory, ImportStatus, ImportType } from "@prisma/client"

export type AdminUser = {
  id: string
  name: string | null
  email: string
  role: Role
  department: string | null
  group: string | null
  admissionYear: number | null
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
  admissionYear?: number | null
  acceptPrivacy?: boolean
  acceptTerms?: boolean
}

export type AdminUserUpdateInput = {
  name?: string
  email?: string
  password?: string
  role?: Role
  department?: string | null
  group?: string | null
  admissionYear?: number | null
  groupChangeCount?: number
  bio?: string | null
  privacyConsentAt?: string | null
  termsConsentAt?: string | null
}

export type AdminStructureField = "department" | "group"

export type AdminStructureRoleFilter = "ALL" | Role

export type AdminStructureValue = {
  value: string
  total: number
  byRole: Record<Role, number>
}

export type AdminStructureSnapshot = {
  departments: AdminStructureValue[]
  groups: AdminStructureValue[]
}

export type AdminStructureUpdateInput = {
  field: AdminStructureField
  fromValue: string
  toValue?: string | null
  role?: AdminStructureRoleFilter
  resetGroupChangeCount?: boolean
}

export type AdminStructureUpdateResult = {
  success: true
  field: AdminStructureField
  fromValue: string
  toValue: string | null
  role: AdminStructureRoleFilter
  affectedUsers: number
  resetGroupChangeCountApplied: boolean
}

export type AdminGroupPromotionResult = {
  success: true
  dryRun: boolean
  isAfterSummer: boolean
  promotedGroups: Array<{
    from: string
    to: string
    users: number
  }>
  skippedGroups: string[]
  affectedUsers: number
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

export type AdminNewsTemplate = {
  id: string
  name: string
  description: string | null
  body: string
  variables: string[]
  createdById: string | null
  createdBy?: {
    id: string
    name: string | null
    email: string
  } | null
  createdAt: string
  updatedAt: string
}

export type AdminNewsTemplateInput = {
  name: string
  description?: string | null
  body: string
  variables?: string[]
}

export type AdminNewsDraftResult = {
  id: string
  title: string
  description: string
  sourceEventId: string
  templateId: string
  link: string
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

export type AdminImportJob = {
  id: string
  type: ImportType
  mode: AdminImportMode | string
  status: ImportStatus
  inputRows: number
  created: number
  updated: number
  skipped: number
  errors: string[]
  warnings: string[]
  createdAt: string
  actor: string | null
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

export type AdminEventAttendanceMetric = {
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

export type AdminStudentAttendanceMetric = {
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

export type AdminGroupAttendanceMetric = {
  group: string
  confirmed: number
  pending: number
  active: number
  total: number
  uniqueStudents: number
  confirmationRatePercent: number
  activityRatePercent: number
}

export type AdminDepartmentAttendanceMetric = {
  department: string
  confirmed: number
  pending: number
  active: number
  total: number
  uniqueStudents: number
  confirmationRatePercent: number
  activityRatePercent: number
}

export type AdminRoleAttendanceMetric = {
  role: Role
  confirmed: number
  pending: number
  active: number
  total: number
  confirmationRatePercent: number
  activityRatePercent: number
}

export type AdminAttendanceSummaryMetric = {
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
    summary: AdminAttendanceSummaryMetric
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

export type AdminDiagnosticsCheck = {
  id: string
  label: string
  status: "ok" | "warning" | "error"
  detail: string
  recommendation?: string
  durationMs: number
}

export type AdminDiagnostics = {
  generatedAt: string
  environment: string
  appVersion: string
  uptimeSeconds: number | null
  checks: AdminDiagnosticsCheck[]
  counts: {
    users: number
    students: number
    teachers: number
    editors: number
    moderators: number
    admins: number
    profilesComplete: number
    profilesIncomplete: number
    usersMissingName: number
    studentsMissingGroup: number
    usersMissingDepartment: number
    events: number
    publicEvents: number
    privateEvents: number
    activeEvents: number
    completedEvents: number
    news: number
    reports: number
    draftReports: number
    participants: number
    pendingParticipants: number
    confirmedParticipants: number
    notifications: number
    unreadNotifications: number
    activeSessions: number
    auditLogs: number
    importJobsTotal: number
    importJobsWithErrors: number
    eventsMissingContact: number
    eventsWithoutModerators: number
  }
  integrationStatus: {
    maxOAuth: string
    vkMessages: string
    yandexOAuth: string
    email: string
  }
  latestImportJobs: AdminImportJob[]
  metricsSnapshot: {
    totalEvents: number
    upcomingEvents: number
    completedEvents: number
    registrations: number
    pendingApprovals: number
    actionsLast7Days: number
  } | null
  latestAudit: {
    action: string
    entityType: string
    createdAt: string
    actor: string | null
  } | null
}
