/**
 * File responsibility:
 * Global footer with project/legal/social links.
 *
 * Main logic:
 * - Render institution info and legal navigation
 * - Provide quick links to social channels
 *
 * Integrations:
 * - src/app/layout.tsx
 */

import Link from "next/link"
import { getTelegramBotUsername } from "@/lib/telegram"

type FooterLink = {
  href: string
  label: string
  icon: string
  description: string
}

const primaryLinks: FooterLink[] = [
  {
    href: "/afisha",
    label: "Публичная афиша",
    icon: "calendar-days",
    description: "Открыть открытую витрину мероприятий кампуса.",
  },
  {
    href: "/calendar",
    label: "Календарь",
    icon: "table-cells-large",
    description: "Быстро просмотреть даты, форматы и расписание.",
  },
  {
    href: "/login",
    label: "Личный кабинет",
    icon: "right-to-bracket",
    description: "Войти в систему, уведомления и рабочие сценарии.",
  },
]

const legalLinks: FooterLink[] = [
  {
    href: "/legal/terms",
    label: "Пользовательское соглашение",
    icon: "file-contract",
    description: "Правила использования платформы и взаимодействия.",
  },
  {
    href: "/legal/privacy",
    label: "Политика конфиденциальности",
    icon: "file-shield",
    description: "Как обрабатываются данные и пользовательские согласия.",
  },
]

export default function Footer() {
  const botUsername = getTelegramBotUsername()
  const telegramLink = botUsername ? `https://t.me/${botUsername}` : null
  const contactEmail = process.env.EMAIL_NOTIFICATION_FROM || "no-reply@bgitu.ru"
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
        <div className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)_360px] lg:gap-5 lg:py-6">
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
              Афиша объединяет публичную витрину, рабочие сценарии сотрудников, личный кабинет,
              Telegram-уведомления и быстрый доступ к ключевым событиям университета.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="liquid-chip px-3 py-1.5 text-xs">События и новости</span>
              <span className="liquid-chip px-3 py-1.5 text-xs">Telegram-уведомления</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.06] via-white to-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/50">
                  Для студентов и сотрудников
                </div>
                <div className="mt-2 text-sm leading-6 text-primary/72">
                  Быстрый вход, подписка на уведомления и единая точка доступа к кампусным
                  активностям.
                </div>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-accent/[0.07] via-white to-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/50">
                  Для админов и редакторов
                </div>
                <div className="mt-2 text-sm leading-6 text-primary/72">
                  Управление контентом, проверка ролей и живой контроль пользовательских сценариев.
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:pr-6">
            <div className="space-y-3 lg:border-r lg:border-primary/10 lg:pr-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">
                Основные разделы
              </div>
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group block rounded-2xl border border-primary/10 bg-white/66 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/24 hover:bg-white"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <i className={`fas fa-${link.icon} text-[12px] text-primary/70`} aria-hidden="true" />
                    <span>{link.label}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-primary/58">{link.description}</div>
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">
                Документы
              </div>
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group block rounded-2xl border border-primary/10 bg-white/66 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/24 hover:bg-white"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <i className={`fas fa-${link.icon} text-[12px] text-primary/70`} aria-hidden="true" />
                    <span>{link.label}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-primary/58">{link.description}</div>
                </Link>
              ))}

              <a
                href={`mailto:${contactEmail}`}
                className="group block rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.05] via-white to-accent/[0.06] px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/24"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <i className="fas fa-envelope text-[12px] text-primary/70" aria-hidden="true" />
                  <span>Контакт для уведомлений</span>
                </div>
                <div className="mt-1 break-all text-xs leading-5 text-primary/58">{contactEmail}</div>
              </a>
            </div>
          </section>

          <section>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">
              Быстрый доступ
            </div>

            <div className="mt-3 rounded-[1.6rem] border border-primary/12 bg-gradient-to-br from-primary/[0.08] via-white to-accent/[0.08] p-4 shadow-[0_16px_32px_rgba(18,39,76,0.08)]">
              <div className="text-sm font-semibold text-primary">Telegram и вход без лишних шагов</div>
              <p className="mt-2 text-sm leading-6 text-primary/68">
                Откройте Telegram-бота, получите ссылку входа и вернитесь в афишу уже с готовыми
                уведомлениями и персональным сценарием.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {telegramLink && botUsername ? (
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(34,158,217,0.26)] transition hover:bg-[#1d8fc5]"
                  >
                    <i className="fab fa-telegram text-base" aria-hidden="true" />
                    Открыть @{botUsername}
                  </a>
                ) : null}

                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/14 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/28 hover:bg-primary/5"
                >
                  <i className="fas fa-right-to-bracket text-sm" aria-hidden="true" />
                  Перейти ко входу
                </Link>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-primary/10 bg-white/66 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/50">
                Что внутри
              </div>
              <div className="mt-2 space-y-2 text-sm text-primary/70">
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
