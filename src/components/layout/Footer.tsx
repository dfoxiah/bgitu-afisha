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

type FooterLink = {
  href: string
  label: string
}

const quickLinks: FooterLink[] = [
  { href: "/", label: "Главная" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "События" },
  { href: "/news", label: "Медиа" },
  { href: "/calendar", label: "Календарь" },
]

const legalLinks: FooterLink[] = [
  { href: "/legal/terms", label: "Пользовательское соглашение" },
  { href: "/legal/privacy", label: "Политика конфиденциальности" },
]

const socialLinks = [
  { href: "#", label: "ВКонтакте", iconClass: "fab fa-vk" },
  { href: "#", label: "Telegram", iconClass: "fab fa-telegram" },
  { href: "#", label: "YouTube", iconClass: "fab fa-youtube" },
]

export default function Footer() {
  return (
    <footer className="footer-sky mt-12 px-4 pb-8 pt-8 md:px-[5%] md:pb-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="footer-glass overflow-hidden p-4 md:p-5">
          <div className="grid gap-5 md:grid-cols-[1.35fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/64">Campus Platform</p>
              <h2 className="mt-2 text-2xl leading-tight text-primary md:text-3xl">Единая афиша и рабочее пространство БГИТУ</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-primary/72 md:text-base">
                Календарь, новости, события и управление публикациями в едином интерфейсе для студентов, преподавателей и администрации.
              </p>
            </div>

            <Link href="/events" className="btn btn-primary px-6 py-3 text-sm">
              Перейти к событиям
            </Link>
          </div>
        </section>

        <section className="footer-glass p-4 md:p-5">
          <div className="grid gap-5 md:grid-cols-[1.35fr_1fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/16 bg-white/80 px-3 py-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
                  БГ
                </span>
                <div>
                  <p className="text-sm font-semibold text-primary">БГИТУ Афиша</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-primary/58">Официальный сервис</p>
                </div>
              </div>

              <p className="mt-4 max-w-md text-sm leading-7 text-primary/72">
                Платформа объединяет образовательные, культурные, научные и волонтерские активности университета.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Навигация</h3>
              <ul className="mt-3 space-y-2 text-sm text-primary/74">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Документы и связь</h3>
              <ul className="mt-3 space-y-2 text-sm text-primary/74">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-2">
                {socialLinks.map((item) => (
                  <a key={item.label} href={item.href} aria-label={item.label} className="footer-icon">
                    <i className={`${item.iconClass} text-base`} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-primary/12 pt-4 text-xs text-primary/62 md:flex md:items-center md:justify-between md:text-sm">
            <p>© {new Date().getFullYear()} Брянский государственный инженерно-технологический университет</p>
            <p>Все права защищены</p>
          </div>
        </section>
      </div>
    </footer>
  )
}
