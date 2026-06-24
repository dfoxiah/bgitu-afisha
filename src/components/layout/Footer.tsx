"use client"

/**
 * File responsibility:
 * Global footer with project/legal/social links.
 *
 * Main logic:
 * - Render institution info and legal navigation
 * - Provide quick links for authenticated and public scenarios
 *
 * Integrations:
 * - src/app/layout.tsx
 */

import Link from "next/link"
import { useSession } from "next-auth/react"

type FooterLink = {
  href: string
  label: string
  icon: string
  description: string
}

const publicPrimaryLinks: FooterLink[] = [
  {
    href: "/afisha",
    label: "Публичная афиша",
    icon: "calendar-days",
    description: "Открытая витрина мероприятий кампуса.",
  },
  {
    href: "/calendar",
    label: "Календарь",
    icon: "table-cells-large",
    description: "Быстрый просмотр дат и форматов событий.",
  },
  {
    href: "/login",
    label: "Личный кабинет",
    icon: "right-to-bracket",
    description: "Вход в систему и персональные сценарии.",
  },
]

const authenticatedPrimaryLinks: FooterLink[] = [
  {
    href: "/dashboard",
    label: "Главная",
    icon: "house",
    description: "Рабочий экран с событиями и подборками.",
  },
  {
    href: "/notifications",
    label: "Уведомления",
    icon: "bell",
    description: "Новые оповещения и быстрые действия.",
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: "user",
    description: "Настройки аккаунта и персональных параметров.",
  },
]

const legalLinks: FooterLink[] = [
  {
    href: "/legal/terms",
    label: "Пользовательское соглашение",
    icon: "file-contract",
    description: "Правила использования платформы.",
  },
  {
    href: "/legal/privacy",
    label: "Политика конфиденциальности",
    icon: "file-shield",
    description: "Обработка данных и пользовательские согласия.",
  },
]

const renderLinkList = (links: FooterLink[]) =>
  links.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className="group flex items-start justify-between gap-3 rounded-2xl px-3 py-2.5 transition-all hover:bg-white/72"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary">
          <i className={`fas fa-${link.icon} text-[12px] text-primary/68`} aria-hidden="true" />
          <span>{link.label}</span>
        </span>
        <span className="mt-1 block text-xs leading-5 text-primary/56">{link.description}</span>
      </span>
      <i
        className="fas fa-chevron-right mt-1 text-[10px] text-primary/36 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  ))

export default function Footer() {
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"
  const primaryLinks = isAuthenticated ? authenticatedPrimaryLinks : publicPrimaryLinks
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer-sky mt-10 border-t border-primary/12 bg-white/84 shadow-[0_-10px_28px_rgba(17,39,74,0.08)] backdrop-blur-xl">
      <div className="border-b border-primary/10 bg-gradient-to-r from-primary/7 via-white to-accent/7">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary/60 sm:px-6 sm:py-2 sm:text-[11px]">
          <span className="hidden sm:inline">БГИТУ • Афиша кампуса</span>
          <span className="liquid-chip justify-self-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] sm:px-3 sm:text-[11px]">
            Брянск Кампус 2026
          </span>
          <span className="hidden justify-self-end sm:inline">Публичная афиша и полезные ссылки</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        <div className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1.25fr)_240px_240px_300px] lg:gap-4 lg:py-6">
          <section className="lg:border-r lg:border-primary/10 lg:pr-6">
            <Link href="/" className="group flex min-w-0 items-center gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-[0_16px_28px_rgba(36,88,198,0.24)]">
                БГ
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-primary sm:text-lg">
                  БГИТУ Афиша
                </span>
                <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/56">
                  Единое пространство событий кампуса
                </span>
              </span>
            </Link>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-primary/68">
              Афиша объединяет события, новости, личный кабинет и рабочие сценарии в одном
              аккуратном интерфейсе без лишней перегрузки.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="liquid-chip px-3 py-1.5 text-xs">События</span>
              <span className="liquid-chip px-3 py-1.5 text-xs">Новости</span>
              <span className="liquid-chip px-3 py-1.5 text-xs">Уведомления</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-primary/10 bg-white/56 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/48">
                  Для студентов и сотрудников
                </div>
                <div className="mt-2 text-sm leading-6 text-primary/70">
                  Просмотр афиши, быстрый вход и единая точка доступа к кампусной активности.
                </div>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-white/56 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/48">
                  Для редакторов и админов
                </div>
                <div className="mt-2 text-sm leading-6 text-primary/70">
                  Управление контентом, сценарии ролей и контроль пользовательских потоков.
                </div>
              </div>
            </div>
          </section>

          <section className="lg:border-r lg:border-primary/10 lg:pr-4">
            <div className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">
              Основные разделы
            </div>
            <div className="mt-2">{renderLinkList(primaryLinks)}</div>
          </section>

          <section className="lg:border-r lg:border-primary/10 lg:pr-4">
            <div className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">
              Документы
            </div>
            <div className="mt-2">{renderLinkList(legalLinks)}</div>
          </section>

          <section className="space-y-3">
            <div className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">
              Быстрый доступ
            </div>

            <div className="rounded-[1.6rem] border border-primary/12 bg-gradient-to-br from-primary/[0.08] via-white to-accent/[0.08] p-4 shadow-[0_16px_32px_rgba(18,39,76,0.08)]">
              <div className="text-sm font-semibold text-primary">
                {isAuthenticated ? "Профиль и уведомления" : "Вход и старт"}
              </div>
              <p className="mt-2 text-sm leading-6 text-primary/68">
                {isAuthenticated
                  ? "Откройте профиль и уведомления, чтобы быстро продолжить работу в системе."
                  : "Войдите в систему или откройте публичную афишу без лишних промежуточных шагов."}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  href={isAuthenticated ? "/profile" : "/login"}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/14 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/28 hover:bg-primary/5"
                >
                  <i
                    className={`fas ${
                      isAuthenticated ? "fa-user-gear" : "fa-right-to-bracket"
                    } text-sm`}
                    aria-hidden="true"
                  />
                  {isAuthenticated ? "Открыть профиль" : "Перейти ко входу"}
                </Link>

                <Link
                  href={isAuthenticated ? "/notifications" : "/afisha"}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(36,88,198,0.24)] transition hover:opacity-95"
                >
                  <i
                    className={`fas ${
                      isAuthenticated ? "fa-bell" : "fa-calendar-days"
                    } text-sm`}
                    aria-hidden="true"
                  />
                  {isAuthenticated ? "Открыть уведомления" : "Открыть афишу"}
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/10 bg-white/56 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/48">
                Что внутри
              </div>
              <div className="mt-2 space-y-2 text-sm text-primary/68">
                <div className="flex items-start gap-2">
                  <i className="fas fa-check-circle mt-0.5 text-[12px] text-emerald-500" aria-hidden="true" />
                  <span>Публичная витрина для анонсов, отчётов и кампусных подборок.</span>
                </div>
                <div className="flex items-start gap-2">
                  <i className="fas fa-check-circle mt-0.5 text-[12px] text-emerald-500" aria-hidden="true" />
                  <span>Личный кабинет с уведомлениями, ролями и рабочими сценариями.</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-primary/10 py-4 text-xs text-primary/56 md:flex-row md:items-center md:justify-between">
          <p>© {currentYear} Брянский государственный инженерно-технологический университет</p>
          <p>Публичная афиша, личный кабинет, уведомления и кампусные сценарии</p>
        </div>
      </div>
    </footer>
  )
}
