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
  { href: "/afisha", label: "Публичная афиша" },
  { href: "/login", label: "Войти" },
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
    <footer className="footer-sky mt-10 px-4 py-4 md:px-[5%]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-white shadow-sm">
            БГ
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-primary">БГИТУ Афиша</span>
            <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/56">
              Единое пространство событий
            </span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm text-primary/72">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 transition-colors hover:bg-primary/6 hover:text-primary">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2 text-xs text-primary/62">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-xl px-2.5 py-2 transition-colors hover:bg-primary/6 hover:text-primary">
              {link.label}
            </Link>
          ))}
          <span className="hidden h-5 w-px bg-primary/12 sm:block" />
          {socialLinks.map((item) => (
            <a key={item.label} href={item.href} aria-label={item.label} className="footer-icon">
              <i className={`${item.iconClass} text-base`} />
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-3 max-w-7xl text-xs text-primary/54 md:flex md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Брянский государственный инженерно-технологический университет</p>
        <p>Все права защищены</p>
      </div>
    </footer>
  )
}
