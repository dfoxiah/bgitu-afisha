/**
 * File responsibility:
 * Shared presentational template for legal pages.
 *
 * Main logic:
 * - Render legal sections in a high-readability and expressive design
 * - Provide quick navigation and summary cards
 *
 * Integrations:
 * - src/app/legal/privacy/page.tsx
 * - src/app/legal/terms/page.tsx
 */

import Link from "next/link"

export type LegalFact = {
  title: string
  text: string
}

export type LegalSection = {
  id: string
  title: string
  intro: string
  points: string[]
  highlight?: string
}

type LegalDocumentPageProps = {
  badge: string
  title: string
  lead: string
  updatedAt: string
  quickFacts: LegalFact[]
  sections: LegalSection[]
  contactText?: string
}

export default function LegalDocumentPage({
  badge,
  title,
  lead,
  updatedAt,
  quickFacts,
  sections,
  contactText,
}: LegalDocumentPageProps) {
  return (
    <main className="relative isolate overflow-hidden px-4 py-8 md:px-[5%] md:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-80 bg-[linear-gradient(125deg,rgba(219,239,255,0.72),rgba(255,255,255,0)_62%)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(190,240,245,0.22))]" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 md:gap-6">
        <section className="relative overflow-hidden rounded-[1.3rem] border border-white/80 bg-white/[0.72] p-4 shadow-[0_16px_34px_rgba(31,73,131,0.16)] backdrop-blur-2xl md:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-primary" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(62,148,226,0.12))]" />

          <div className="relative flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
              <span className="rounded-full border border-primary/25 bg-white/75 px-3 py-1">{badge}</span>
              <span className="rounded-full border border-primary/25 bg-white/75 px-3 py-1">Обновлено: {updatedAt}</span>
            </div>

            <div className="max-w-[76ch]">
              <h1 className="text-2xl leading-tight text-primary md:text-3xl">{title}</h1>
              <p className="mt-3 text-base leading-7 text-slate-700 md:text-lg">{lead}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {quickFacts.map((fact) => (
            <article
              key={fact.title}
              className="rounded-2xl border border-white/80 bg-white/[0.72] p-4 shadow-[0_12px_24px_rgba(32,88,148,0.13)] backdrop-blur-xl md:p-5"
            >
              <h2 className="text-base font-semibold text-primary">{fact.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-700">{fact.text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[1.2rem] border border-white/80 bg-white/[0.72] p-4 shadow-[0_14px_28px_rgba(32,88,148,0.13)] backdrop-blur-xl md:p-5">
          <h2 className="text-lg font-semibold text-primary">Быстрая навигация</h2>
          <nav aria-label="Навигация по документу" className="mt-4 flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:border-primary/40 hover:text-primary"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </section>

        <section className="space-y-4">
          {sections.map((section, index) => (
            <article
              id={section.id}
              key={section.id}
              className="scroll-mt-24 rounded-[1.15rem] border border-white/80 bg-white/75 p-4 shadow-[0_12px_24px_rgba(31,73,131,0.13)] backdrop-blur-xl md:p-5"
              aria-labelledby={`${section.id}-title`}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-white shadow-md">
                  {index + 1}
                </span>

                <div className="min-w-0 max-w-[76ch]">
                  <h2 id={`${section.id}-title`} className="text-lg leading-tight text-slate-900">
                    {section.title}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-slate-700">{section.intro}</p>

                  <ul className="mt-4 space-y-2 text-slate-700">
                    {section.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 leading-7">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  {section.highlight ? (
                    <p className="mt-4 rounded-2xl border border-accent/35 bg-accent/12 px-4 py-3 text-sm font-medium text-primary">
                      {section.highlight}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[1.15rem] border border-white/80 bg-white/75 p-4 shadow-[0_12px_24px_rgba(31,73,131,0.13)] backdrop-blur-xl md:p-5">
          <h2 className="text-lg font-semibold text-primary">Связанные документы</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">{contactText || "Если у вас есть вопросы по документам, обратитесь в администрацию БГИТУ."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/legal/terms"
              className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:border-primary/40 hover:text-primary"
            >
              Пользовательское соглашение
            </Link>
            <Link
              href="/legal/privacy"
              className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:border-primary/40 hover:text-primary"
            >
              Политика конфиденциальности
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
