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
}

const quickLinks: FooterLink[] = [
  { href: "/", label: "Главная" },
  { href: "/afisha", label: "Публичная афиша" },
  { href: "/login", label: "Войти" },
]

const legalLinks: FooterLink[] = [
  { href: "/legal/terms", label: "Пользовательское соглашение" },
  { href: "/legal/privacy", label: "Политика конфиденциальности" },
]

export default function Footer() {
  const botUsername = getTelegramBotUsername()
  const telegramLink = botUsername ? `https://t.me/${botUsername}` : null

  return (
    <footer className="footer-sky mt-10 px-4 py-4 md:px-[5%]">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[1.8rem] border border-white/60 bg-white/72 shadow-[0_22px_52px_rgba(18,39,76,0.1)] backdrop-blur-xl">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.9fr] lg:gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-[0_16px_28px_rgba(36,88,198,0.24)]">
                БГ
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-primary">БГИТУ Афиша</span>
                <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/56">
                  Единое пространство событий кампуса
                </span>
              </span>
            </Link>

            <p className="max-w-xl text-sm leading-6 text-primary/66">
              Публичная афиша, вход в личный кабинет, уведомления и быстрый доступ к кампусным событиям в одном аккуратном интерфейсе.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="liquid-chip px-3 py-1.5 text-xs">Публичная афиша</span>
              <span className="liquid-chip px-3 py-1.5 text-xs">Telegram-уведомления</span>
              <span className="liquid-chip px-3 py-1.5 text-xs">Яндекс OAuth</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">Навигация</p>
            <nav className="mt-3 flex flex-col gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-primary/10 bg-white/55 px-4 py-3 text-sm font-medium text-primary/76 transition-all hover:-translate-y-0.5 hover:border-primary/24 hover:bg-white hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">Документы</p>
              <div className="mt-3 flex flex-col gap-2">
                {legalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-2xl border border-primary/10 bg-white/55 px-4 py-3 text-sm font-medium text-primary/76 transition-all hover:-translate-y-0.5 hover:border-primary/24 hover:bg-white hover:text-primary"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-primary/10 bg-gradient-to-br from-primary/[0.07] via-white to-accent/[0.08] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/48">Быстрый вход</p>
              <p className="mt-2 text-sm leading-6 text-primary/68">
                Самый быстрый сценарий — открыть Telegram-бота и подтвердить вход по персональной ссылке.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {telegramLink && botUsername ? (
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#229ED9] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(34,158,217,0.26)] transition hover:bg-[#1d8fc5]"
                  >
                    <i className="fab fa-telegram text-base" aria-hidden="true" />
                    @{botUsername}
                  </a>
                ) : null}
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-primary/12 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/24 hover:bg-primary/5"
                >
                  <i className="fas fa-right-to-bracket text-sm" aria-hidden="true" />
                  Страница входа
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-primary/10 px-5 py-4 text-xs text-primary/54 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Брянский государственный инженерно-технологический университет</p>
          <p>Публичная афиша, личный кабинет и уведомления кампуса</p>
        </div>
      </div>
    </footer>
  )
}
