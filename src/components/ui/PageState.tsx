/**
 * File responsibility:
 * Shared full-screen state blocks for loading/empty/guard scenarios.
 *
 * Main logic:
 * - Render a consistent visual shell for technical states.
 *
 * Integrations:
 * - Route pages with auth/data loading guards.
 */

import type { ReactNode } from "react"

type PageStateProps = {
  title: string
  subtitle?: string
  iconClass?: string
  spinning?: boolean
  actions?: ReactNode
}

export default function PageState({
  title,
  subtitle,
  iconClass = "fas fa-circle-info",
  spinning = false,
  actions,
}: PageStateProps) {
  return (
    <div className="status-screen">
      <div className="status-card">
        {spinning ? (
          <div className="status-spinner" aria-hidden="true" />
        ) : (
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-primary">
            <i className={iconClass} />
          </div>
        )}

        <h2 className="mt-5 text-2xl font-semibold text-primary">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm leading-7 text-slate-600">{subtitle}</p> : null}
        {actions ? <div className="mt-6">{actions}</div> : null}
      </div>
    </div>
  )
}
