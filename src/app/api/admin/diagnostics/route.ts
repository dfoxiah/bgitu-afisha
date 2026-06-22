/**
 * File responsibility:
 * Admin-only diagnostics endpoint for checking application health from the admin panel.
 *
 * Main logic:
 * - Validate admin access.
 * - Probe database, counters, required data, import history and integrations.
 * - Return safe operational facts without exposing secrets.
 *
 * Integrations:
 * - src/app/admin/page.tsx diagnostics tab
 * - src/features/admin/client/admin-api.ts
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ImportStatus, ParticipantStatus, Role } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from "@/lib/profile-completion"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { getAdminDashboardMetrics } from "@/server/admin/admin-metrics-service"
import { errorJson } from "@/server/shared/http-response"
import type { AdminDiagnosticsCheck } from "@/features/admin/types"

export const dynamic = "force-dynamic"

const ok = (value: boolean) => (value ? "configured" : "missing")

const runCheck = async (
  id: string,
  label: string,
  task: () => Promise<Pick<AdminDiagnosticsCheck, "status" | "detail" | "recommendation">>
): Promise<AdminDiagnosticsCheck> => {
  const startedAt = Date.now()
  try {
    const result = await task()
    return {
      id,
      label,
      status: result.status,
      detail: result.detail,
      recommendation: result.recommendation,
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      id,
      label,
      status: "error",
      detail: error instanceof Error ? error.message : "Неизвестная ошибка",
      recommendation: "Проверьте логи сервера и доступность зависимостей.",
      durationMs: Date.now() - startedAt,
    }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  let metricsSnapshot = null
  const [dbCheck, metricsCheck] = await Promise.all([
    runCheck("database", "База данных", async () => {
      await prisma.$queryRaw`SELECT 1`
      return {
        status: "ok",
        detail: "Соединение установлено, простой запрос выполнен.",
      }
    }),
    runCheck("metrics", "Агрегация статистики", async () => {
      const metrics = await getAdminDashboardMetrics({})
      metricsSnapshot = {
        totalEvents: metrics.eventStats.totalEvents,
        upcomingEvents: metrics.eventStats.upcomingEvents,
        completedEvents: metrics.eventStats.completedEvents,
        registrations: metrics.periodSummary.registrations,
        pendingApprovals: metrics.eventStats.pendingApprovals,
        actionsLast7Days: metrics.siteTraffic.actionsLast7Days,
      }
      return {
        status: "ok",
        detail: `Собрано: ${metrics.eventStats.totalEvents} событий, ${metrics.periodSummary.registrations} регистраций.`,
      }
    }),
  ])

  const profileCompleteWhere = {
    profileCompletedAt: { not: null },
    privacyConsentVersion: PRIVACY_POLICY_VERSION,
    termsConsentVersion: TERMS_VERSION,
  }

  const [
    users,
    students,
    teachers,
    editors,
    moderators,
    admins,
    profilesComplete,
    profilesIncomplete,
    usersMissingName,
    studentsMissingGroup,
    usersMissingDepartment,
    events,
    publicEvents,
    privateEvents,
    activeEvents,
    completedEvents,
    news,
    reports,
    draftReports,
    participants,
    pendingParticipants,
    confirmedParticipants,
    notifications,
    unreadNotifications,
    activeSessions,
    auditLogs,
    importJobsTotal,
    importJobsWithErrors,
    latestImportJobs,
    latestAudit,
    latestExportAudit,
    eventsMissingContact,
    eventsWithoutModerators,
    rolesWithoutCompletedProfiles,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.STUDENT } }),
    prisma.user.count({ where: { role: Role.TEACHER } }),
    prisma.user.count({ where: { role: Role.EDITOR } }),
    prisma.user.count({ where: { role: Role.MODERATOR } }),
    prisma.user.count({ where: { role: Role.ADMIN } }),
    prisma.user.count({ where: profileCompleteWhere }),
    prisma.user.count({ where: { NOT: profileCompleteWhere } }),
    prisma.user.count({ where: { OR: [{ name: null }, { name: "" }] } }),
    prisma.user.count({ where: { role: Role.STUDENT, OR: [{ group: null }, { group: "" }] } }),
    prisma.user.count({ where: { OR: [{ department: null }, { department: "" }] } }),
    prisma.event.count(),
    prisma.event.count({ where: { isPublic: true, removedFromCalendar: false } }),
    prisma.event.count({ where: { isPublic: false, removedFromCalendar: false } }),
    prisma.event.count({ where: { isPast: false, removedFromCalendar: false } }),
    prisma.event.count({ where: { isPast: true, removedFromCalendar: false } }),
    prisma.event.count({ where: { isNews: true } }),
    prisma.eventReport.count(),
    prisma.eventReport.count({ where: { status: "DRAFT" } }),
    prisma.eventParticipant.count(),
    prisma.eventParticipant.count({ where: { status: ParticipantStatus.PENDING } }),
    prisma.eventParticipant.count({ where: { status: ParticipantStatus.CONFIRMED } }),
    prisma.notification.count(),
    prisma.notification.count({ where: { read: false } }),
    prisma.session.count({ where: { expires: { gt: new Date() } } }),
    prisma.auditLog.count(),
    prisma.importJob.count(),
    prisma.importJob.count({ where: { status: ImportStatus.COMPLETED_WITH_ERRORS } }),
    prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        action: true,
        entityType: true,
        createdAt: true,
        actor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.auditLog.findFirst({
      where: { action: { contains: "EXPORT" } },
      orderBy: { createdAt: "desc" },
      select: { action: true, entityType: true, createdAt: true },
    }),
    prisma.event.count({ where: { removedFromCalendar: false, OR: [{ contact: "" }, { responsible: "" }] } }),
    prisma.event.count({ where: { removedFromCalendar: false, isPast: false, moderators: { none: {} } } }),
    prisma.user.groupBy({
      by: ["role"],
      where: { role: { in: [Role.EDITOR, Role.MODERATOR, Role.TEACHER] }, NOT: profileCompleteWhere },
      _count: { _all: true },
    }),
  ])

  const integrationStatus = {
    maxOAuth: ok(
      Boolean(
        process.env.MAX_CLIENT_ID &&
          process.env.MAX_CLIENT_SECRET &&
          process.env.MAX_AUTHORIZATION_URL &&
          process.env.MAX_TOKEN_URL &&
          process.env.MAX_USERINFO_URL
      )
    ),
    vkOAuth: ok(Boolean(process.env.VK_CLIENT_ID && process.env.VK_CLIENT_SECRET)),
    vkMessages: ok(Boolean(process.env.VK_GROUP_TOKEN)),
    telegramBot: ok(Boolean(process.env.TELEGRAM_BOT_TOKEN)),
    yandexOAuth: ok(Boolean(process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET)),
    email: ok(Boolean(process.env.EMAIL_NOTIFICATION_WEBHOOK_URL)),
  }

  const hasConfiguredOAuthProvider =
    integrationStatus.vkOAuth === "configured" ||
    integrationStatus.maxOAuth === "configured" ||
    integrationStatus.yandexOAuth === "configured"

  const hasExternalChannel =
    integrationStatus.vkMessages === "configured" ||
    integrationStatus.telegramBot === "configured" ||
    integrationStatus.email === "configured"

  const integrationsRecommendation = [
    !hasConfiguredOAuthProvider
      ? "Заполните хотя бы один OAuth-провайдер: VK, MAX или Яндекс."
      : null,
    !hasExternalChannel
      ? "Для внешних уведомлений заполните VK_GROUP_TOKEN, TELEGRAM_BOT_TOKEN или EMAIL_NOTIFICATION_WEBHOOK_URL."
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")

  const dataCheck: AdminDiagnosticsCheck = {
    id: "required-data",
    label: "Обязательные данные",
    status:
      users === 0 || events === 0 || profilesIncomplete > 0 || usersMissingDepartment > 0
        ? "warning"
        : "ok",
    detail:
      users === 0 || events === 0
        ? "В базе мало данных: часть аналитики будет пустой."
        : `Заполненных профилей: ${profilesComplete}, неполных: ${profilesIncomplete}, без подразделения: ${usersMissingDepartment}.`,
    recommendation:
      profilesIncomplete > 0
        ? "Откройте раздел пользователей и попросите владельцев аккаунтов заполнить профиль и согласия."
        : undefined,
    durationMs: 0,
  }

  const accessCheck: AdminDiagnosticsCheck = {
    id: "access",
    label: "Права доступа",
    status: rolesWithoutCompletedProfiles.length > 0 ? "warning" : "ok",
    detail:
      rolesWithoutCompletedProfiles.length > 0
        ? `Есть пользователи с рабочими ролями и неполным профилем: ${rolesWithoutCompletedProfiles
            .map((row) => `${row.role}: ${row._count._all}`)
            .join(", ")}.`
        : "Критичных несоответствий ролей и профилей не найдено.",
    recommendation:
      rolesWithoutCompletedProfiles.length > 0
        ? "Проверьте редакторов, модераторов и руководителей: им нужны актуальные профиль и согласия."
        : undefined,
    durationMs: 0,
  }

  const importCheck: AdminDiagnosticsCheck = {
    id: "imports",
    label: "Импорт/экспорт",
    status: importJobsWithErrors > 0 ? "warning" : "ok",
    detail:
      importJobsTotal === 0
        ? "История импортов пока пуста."
        : `Импортов всего: ${importJobsTotal}, с ошибками: ${importJobsWithErrors}. Последний экспорт: ${
            latestExportAudit ? latestExportAudit.createdAt.toISOString() : "нет записей"
          }.`,
    recommendation:
      importJobsWithErrors > 0
        ? "Откройте историю импорта и исправьте строки, указанные в отчёте ошибок."
        : undefined,
    durationMs: 0,
  }

  const integrationsCheck: AdminDiagnosticsCheck = {
    id: "integrations",
    label: "Внешние интеграции",
    status:
      !hasConfiguredOAuthProvider ||
      !hasExternalChannel
        ? "warning"
        : "ok",
    detail: `VK OAuth: ${integrationStatus.vkOAuth}, MAX OAuth: ${integrationStatus.maxOAuth}, Яндекс OAuth: ${integrationStatus.yandexOAuth}, сообщения VK: ${integrationStatus.vkMessages}, Telegram: ${integrationStatus.telegramBot}, email: ${integrationStatus.email}.`,
    recommendation: integrationsRecommendation || undefined,
    durationMs: 0,
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown",
      appVersion:
        process.env.NEXT_PUBLIC_APP_VERSION ||
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
        "local",
      uptimeSeconds: typeof process.uptime === "function" ? Math.round(process.uptime()) : null,
      checks: [dbCheck, metricsCheck, dataCheck, accessCheck, importCheck, integrationsCheck],
      counts: {
        users,
        students,
        teachers,
        editors,
        moderators,
        admins,
        profilesComplete,
        profilesIncomplete,
        usersMissingName,
        studentsMissingGroup,
        usersMissingDepartment,
        events,
        publicEvents,
        privateEvents,
        activeEvents,
        completedEvents,
        news,
        reports,
        draftReports,
        participants,
        pendingParticipants,
        confirmedParticipants,
        notifications,
        unreadNotifications,
        activeSessions,
        auditLogs,
        importJobsTotal,
        importJobsWithErrors,
        eventsMissingContact,
        eventsWithoutModerators,
      },
      integrationStatus,
      latestImportJobs: latestImportJobs.map((job) => ({
        id: job.id,
        type: job.type,
        mode: job.mode,
        status: job.status,
        inputRows: job.inputRows,
        created: job.created,
        updated: job.updated,
        skipped: job.skipped,
        errors: job.errors,
        warnings: job.warnings,
        createdAt: job.createdAt.toISOString(),
        actor: job.actor?.name || job.actor?.email || null,
      })),
      metricsSnapshot,
      latestAudit: latestAudit
        ? {
            action: latestAudit.action,
            entityType: latestAudit.entityType,
            createdAt: latestAudit.createdAt.toISOString(),
            actor: latestAudit.actor?.name || latestAudit.actor?.email || null,
          }
        : null,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  )
}
