/**
 * File responsibility:
 * Admin metrics dashboard tab with KPI cards, compact chart and export controls.
 *
 * Main logic:
 * - Render aggregated metrics received from admin API
 * - Calculate derivative KPIs for easier trend reading
 * - Visualize activity trend with a compact SVG line/area chart
 * - Trigger JSON/CSV/Excel exports
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/features/admin/client/admin-api.ts
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import Button from "@/components/ui/Button"
import type {
  AdminActiveUserMetric,
  AdminDashboardMetrics,
  AdminEvent,
  AdminSiteTrafficPoint,
} from "@/features/admin/types"

type AdminMetricsDashboardProps = {
  metrics: AdminDashboardMetrics | null
  isLoading: boolean
  exportEvents: AdminEvent[]
  exportingEventId: string | null
  onRefresh: () => void
  onExportEvent: (eventId: string) => void
}

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("ru-RU")
}

const formatDayLabel = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

const roundToOne = (value: number) => Math.round(value * 10) / 10

const percent = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0
  return roundToOne((numerator / denominator) * 100)
}

const deltaPercent = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? 100 : 0
  return roundToOne(((current - previous) / previous) * 100)
}

const sumBy = (points: AdminSiteTrafficPoint[], key: "actions" | "signIns" | "uniqueUsers") =>
  points.reduce((sum, point) => sum + point[key], 0)

const downloadTextFile = (fileName: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

const renderActivityRows = (users: AdminActiveUserMetric[], emptyLabel: string) => {
  if (users.length === 0) {
    return <div className="text-sm text-slate-500">{emptyLabel}</div>
  }

  const maxScore = Math.max(...users.map((user) => user.activityScore), 1)

  return (
    <div className="space-y-3">
      {users.map((user, index) => (
        <div key={user.userId} className="admin-activity-row">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {index + 1}. {user.name}
              </div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
            <div className="rounded-full bg-[#0f766e]/10 px-2.5 py-1 text-xs font-semibold text-[#0f766e]">
              {user.activityScore}
            </div>
          </div>

          <div className="admin-linear-meter mt-2 h-1.5 rounded-full bg-slate-200/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f97316] to-[#0ea5a4]"
              style={{ width: `${Math.max((user.activityScore / maxScore) * 100, 6)}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-0.5">Аудит: {user.auditActions}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5">Регистрации: {user.registrations}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5">
              Подтверждено: {user.confirmedParticipations}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminMetricsDashboard({
  metrics,
  isLoading,
  exportEvents,
  exportingEventId,
  onRefresh,
  onExportEvent,
}: AdminMetricsDashboardProps) {
  const [selectedEventId, setSelectedEventId] = useState("")

  useEffect(() => {
    if (!selectedEventId && exportEvents.length > 0) {
      setSelectedEventId(exportEvents[0].id)
    }
  }, [selectedEventId, exportEvents])

  const traffic = useMemo(() => {
    if (!metrics?.siteTraffic.dailyActivity) return []
    return [...metrics.siteTraffic.dailyActivity].sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
    )
  }, [metrics])

  const recentTraffic = useMemo(() => traffic.slice(-14), [traffic])

  const analytics = useMemo(() => {
    if (!metrics) {
      return {
        averageActionsPerDay: 0,
        actionsGrowth: 0,
        actionsGrowthLabel: "Нет данных",
        signInShare: 0,
        actionsPerUser: 0,
        approvalRate: 0,
        pendingShare: 0,
        moderationCoverage: 0,
        contactCoverage: 0,
        completionRate: 0,
        newsShare: 0,
      }
    }

    const last7 = traffic.slice(-7)
    const previous7 = traffic.slice(-14, -7)

    const actionsLast7 = metrics.siteTraffic.actionsLast7Days
    const actionsPrev7 = sumBy(previous7, "actions")
    const growth = deltaPercent(actionsLast7, actionsPrev7)

    const moderatedUpcoming = Math.max(
      metrics.eventStats.upcomingEvents - metrics.additional.upcomingWithoutModerators,
      0
    )

    return {
      averageActionsPerDay: last7.length > 0 ? roundToOne(actionsLast7 / last7.length) : 0,
      actionsGrowth: growth,
      actionsGrowthLabel:
        growth > 0
          ? `+${growth}% к прошлой неделе`
          : growth < 0
            ? `${growth}% к прошлой неделе`
            : "Без изменений",
      signInShare: percent(metrics.siteTraffic.signInsLast7Days, actionsLast7),
      actionsPerUser: metrics.siteTraffic.uniqueUsersLast7Days
        ? roundToOne(actionsLast7 / metrics.siteTraffic.uniqueUsersLast7Days)
        : 0,
      approvalRate: percent(
        metrics.eventStats.confirmedThisMonth,
        metrics.eventStats.registrationsThisMonth
      ),
      pendingShare: percent(
        metrics.eventStats.pendingApprovals,
        Math.max(metrics.eventStats.pendingApprovals, metrics.eventStats.registrationsThisMonth)
      ),
      moderationCoverage: percent(moderatedUpcoming, metrics.eventStats.upcomingEvents),
      contactCoverage: percent(
        Math.max(metrics.eventStats.totalEvents - metrics.additional.eventsMissingContact, 0),
        metrics.eventStats.totalEvents
      ),
      completionRate: percent(metrics.eventStats.completedEvents, metrics.eventStats.totalEvents),
      newsShare: percent(metrics.eventStats.newsMaterials, metrics.eventStats.totalEvents),
    }
  }, [metrics, traffic])

  const chart = useMemo(() => {
    if (recentTraffic.length === 0) {
      return {
        linePoints: "",
        areaPoints: "",
        labels: [] as string[],
      }
    }

    const width = 100
    const height = 44
    const maxActions = Math.max(1, ...recentTraffic.map((point) => point.actions))

    const points = recentTraffic.map((point, index) => {
      const x =
        recentTraffic.length === 1 ? width / 2 : (index / (recentTraffic.length - 1)) * width
      const y = height - (point.actions / maxActions) * (height - 4) - 2
      return { x, y }
    })

    return {
      linePoints: points.map((point) => `${point.x},${point.y}`).join(" "),
      areaPoints: `0,44 ${points.map((point) => `${point.x},${point.y}`).join(" ")} 100,44`,
      labels: recentTraffic.map((point) => formatDayLabel(point.date)),
    }
  }, [recentTraffic])

  const statusItems = useMemo(() => {
    if (!metrics) return []

    const items = [
      { label: "Будущие", value: metrics.eventStats.upcomingEvents, tone: "teal" as const },
      { label: "Завершенные", value: metrics.eventStats.completedEvents, tone: "orange" as const },
      { label: "Новости", value: metrics.eventStats.newsMaterials, tone: "cyan" as const },
      {
        label: "Pending-заявки",
        value: metrics.eventStats.pendingApprovals,
        tone: "red" as const,
      },
    ]

    const maxValue = Math.max(...items.map((item) => item.value), 1)
    return items.map((item) => ({
      ...item,
      width: Math.max((item.value / maxValue) * 100, 8),
    }))
  }, [metrics])

  const kpiCards = useMemo(() => {
    if (!metrics) return []

    return [
      {
        title: "Действия (7 дней)",
        value: metrics.siteTraffic.actionsLast7Days,
        note: `В среднем ${analytics.averageActionsPerDay} в день`,
      },
      {
        title: "Уникальные пользователи",
        value: metrics.siteTraffic.uniqueUsersLast7Days,
        note: `Действий на пользователя: ${analytics.actionsPerUser}`,
      },
      {
        title: "Авторизации",
        value: metrics.siteTraffic.signInsLast7Days,
        note: `Доля авторизаций: ${analytics.signInShare}%`,
      },
      {
        title: "Конверсия регистраций",
        value: `${metrics.eventStats.registrationConversionPercent}%`,
        note: `Факт подтверждений: ${analytics.approvalRate}%`,
      },
      {
        title: "Динамика активности",
        value: `${analytics.actionsGrowth > 0 ? "+" : ""}${analytics.actionsGrowth}%`,
        note: analytics.actionsGrowthLabel,
      },
    ]
  }, [analytics, metrics])

  const handleExportMetricsJson = () => {
    if (!metrics) return
    const token = new Date(metrics.generatedAt).toISOString().slice(0, 10)
    downloadTextFile(
      `admin_metrics_${token}.json`,
      `${JSON.stringify(metrics, null, 2)}\n`,
      "application/json;charset=utf-8"
    )
  }

  const handleExportTrafficCsv = () => {
    if (traffic.length === 0) return
    const lines = [
      "date,actions,sign_ins,unique_users",
      ...traffic.map((point) => `${point.date},${point.actions},${point.signIns},${point.uniqueUsers}`),
    ]

    const token = new Date().toISOString().slice(0, 10)
    downloadTextFile(`site_traffic_${token}.csv`, `\uFEFF${lines.join("\n")}`, "text/csv;charset=utf-8")
  }

  if (isLoading && !metrics) {
    return (
      <div className="admin-panel p-8 text-center">
        <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-[#0ea5a4] border-t-transparent" />
        <div className="text-sm text-slate-600">Загрузка метрик...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="admin-panel space-y-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900">Метрики недоступны</h3>
        <p className="text-sm text-slate-500">
          Не удалось загрузить аналитические данные. Повторите попытку.
        </p>
        <Button variant="secondary" onClick={onRefresh}>
          Обновить
        </Button>
      </div>
    )
  }

  return (
    <div className="admin-metrics space-y-6">
      <section className="admin-metrics-hero admin-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Панель метрик</h2>
            <p className="mt-1 text-xs text-slate-600">
              Обновлено: {new Date(metrics.generatedAt).toLocaleString("ru-RU")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
              <span className="admin-pill">
                Неделя: {formatDate(metrics.periods.weekStart)} - {formatDate(metrics.periods.weekEnd)}
              </span>
              <span className="admin-pill">
                Месяц: {formatDate(metrics.periods.monthStart)} - {formatDate(metrics.periods.monthEnd)}
              </span>
              <span className="admin-pill admin-pill-live">Live: данные каждые 15 сек</span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={onRefresh} loading={isLoading}>
              Обновить метрики
            </Button>
            <Button variant="secondary" onClick={handleExportMetricsJson}>
              Экспорт JSON
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <article key={card.title} className="admin-panel p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {card.title}
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="mt-1 text-xs text-slate-500">{card.note}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <article className="admin-panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Тренд активности (14 дней)</div>
              <div className="text-xs text-slate-500">
                Упрощенная диаграмма действий без перегруженных элементов
              </div>
            </div>
            <div className="admin-pill">Actions: {metrics.siteTraffic.actionsLast7Days}</div>
          </div>

          {recentTraffic.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-7 text-center text-sm text-slate-500">
              Нет данных для диаграммы.
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-white/80 bg-white/[0.82] p-4">
                <svg viewBox="0 0 100 44" className="h-44 w-full" preserveAspectRatio="none" role="img">
                  <defs>
                    <linearGradient id="adminArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="adminLine" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#0ea5a4" />
                    </linearGradient>
                  </defs>

                  {[8, 18, 28, 38].map((lineY) => (
                    <line
                      key={lineY}
                      x1="0"
                      y1={lineY}
                      x2="100"
                      y2={lineY}
                      stroke="rgba(148, 163, 184, 0.25)"
                      strokeDasharray="1 2"
                    />
                  ))}

                  <polyline fill="url(#adminArea)" points={chart.areaPoints} />
                  <polyline
                    fill="none"
                    stroke="url(#adminLine)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={chart.linePoints}
                  />
                </svg>

                <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[10px] text-slate-500 sm:grid-cols-14">
                  {chart.labels.map((label, index) => (
                    <span key={`${label}_${index}`} className={index % 2 === 0 ? "opacity-100" : "opacity-45"}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="admin-pill">Авторизации: {metrics.siteTraffic.signInsLast7Days}</span>
                <span className="admin-pill">Уникальные: {metrics.siteTraffic.uniqueUsersLast7Days}</span>
                <span className="admin-pill">Pending: {metrics.eventStats.pendingApprovals}</span>
              </div>
            </>
          )}
        </article>

        <div className="space-y-4">
          <article className="admin-panel p-5">
            <div className="text-sm font-semibold text-slate-900">Контрольные проценты</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {[
                {
                  label: "Конверсия регистраций",
                  value: metrics.eventStats.registrationConversionPercent,
                  color: "#f97316",
                },
                { label: "Покрытие модераторами", value: analytics.moderationCoverage, color: "#0ea5a4" },
                { label: "Полнота контактов", value: analytics.contactCoverage, color: "#14b8a6" },
                { label: "Доля pending", value: analytics.pendingShare, color: "#ef4444" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-900">{item.value}%</span>
                  </div>
                  <div
                    className="h-2 rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuenow={item.value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(Math.max(item.value, 4), 100)}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="admin-panel p-5">
            <div className="text-sm font-semibold text-slate-900">Состояние мероприятий</div>
            <div className="mt-3 space-y-3">
              {statusItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-900">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        item.tone === "teal"
                          ? "bg-teal-500"
                          : item.tone === "orange"
                            ? "bg-orange-500"
                            : item.tone === "cyan"
                              ? "bg-cyan-500"
                              : "bg-red-500"
                      }`}
                      style={{ width: `${item.width}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="admin-panel p-5">
          <div className="text-sm font-semibold text-slate-900">Популярные события</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-4">
              <div className="text-xs uppercase tracking-[0.06em] text-slate-500">Неделя</div>
              {metrics.popularEvents.week ? (
                <>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {metrics.popularEvents.week.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Участники: {metrics.popularEvents.week.confirmedParticipants}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDate(metrics.popularEvents.week.date)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-500">Нет лидера за период.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-4">
              <div className="text-xs uppercase tracking-[0.06em] text-slate-500">Месяц</div>
              {metrics.popularEvents.month ? (
                <>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {metrics.popularEvents.month.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Участники: {metrics.popularEvents.month.confirmedParticipants}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDate(metrics.popularEvents.month.date)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-500">Нет лидера за период.</div>
              )}
            </div>
          </div>
        </article>

        <article className="admin-panel p-5">
          <div className="text-sm font-semibold text-slate-900">Сводка качества данных</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-3 text-sm">
              <div className="text-slate-500">Без модератора</div>
              <div className="text-2xl font-bold text-slate-900">
                {metrics.additional.upcomingWithoutModerators}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-3 text-sm">
              <div className="text-slate-500">Без контактов</div>
              <div className="text-2xl font-bold text-slate-900">{metrics.additional.eventsMissingContact}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-3 text-sm">
              <div className="text-slate-500">Доля завершённых</div>
              <div className="text-2xl font-bold text-slate-900">{analytics.completionRate}%</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-3 text-sm">
              <div className="text-slate-500">Доля новостей</div>
              <div className="text-2xl font-bold text-slate-900">{analytics.newsShare}%</div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="admin-panel p-5">
          <div className="mb-3 text-sm font-semibold text-slate-900">Самые активные студенты</div>
          {renderActivityRows(metrics.topActive.students, "Нет данных по студентам.")}
        </article>

        <article className="admin-panel p-5">
          <div className="mb-3 text-sm font-semibold text-slate-900">Самые активные преподаватели</div>
          {renderActivityRows(metrics.topActive.teachers, "Нет данных по преподавателям.")}
        </article>
      </section>

      <section className="admin-panel space-y-4 p-5">
        <div className="text-sm font-semibold text-slate-900">Экспорт данных</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-4">
            <div className="text-sm font-semibold text-slate-900">Метрики JSON</div>
            <p className="mt-1 text-xs text-slate-500">Полная структура метрик для BI и архивов.</p>
            <Button className="mt-3 w-full" variant="secondary" onClick={handleExportMetricsJson}>
              Скачать JSON
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-4">
            <div className="text-sm font-semibold text-slate-900">Трафик CSV</div>
            <p className="mt-1 text-xs text-slate-500">Ежедневная активность по дням: actions/sign-ins/unique.</p>
            <Button className="mt-3 w-full" variant="secondary" onClick={handleExportTrafficCsv}>
              Скачать CSV
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/[0.85] p-4 md:col-span-2 xl:col-span-1">
            <div className="text-sm font-semibold text-slate-900">Excel по мероприятию</div>
            <p className="mt-1 text-xs text-slate-500">Участники, статусы, модераторы и контактные данные.</p>
            <div className="mt-3 flex flex-col gap-2">
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
              >
                {exportEvents.length === 0 ? (
                  <option value="">Нет мероприятий для выгрузки</option>
                ) : (
                  exportEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} ({formatDate(event.date)})
                    </option>
                  ))
                )}
              </select>

              <Button
                className="w-full"
                variant="primary"
                disabled={!selectedEventId || Boolean(exportingEventId)}
                loading={Boolean(exportingEventId)}
                onClick={() => selectedEventId && onExportEvent(selectedEventId)}
              >
                Скачать Excel
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

