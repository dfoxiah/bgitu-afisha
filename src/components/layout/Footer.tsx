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

export default function Footer() {
  return (
    <footer className="footer-sky mt-10 py-12 text-slate-700">
      <div className="container mx-auto px-4">
        <div className="footer-glass p-6 md:p-8">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="text-center lg:text-left">
              <h3 className="mb-2 text-2xl font-semibold text-primary">БГИТУ Афиша</h3>
              <p className="text-slate-600">Агрегатор мероприятий университета</p>
            </div>

            <div className="text-center text-sm text-slate-500">
              <p>
                © {new Date().getFullYear()} Брянский государственный инженерно-технологический
                университет
              </p>
              <p className="mt-2">Все права защищены</p>
              <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs">
                <Link href="/legal/terms" className="hover:text-primary">
                  Пользовательское соглашение
                </Link>
                <Link href="/legal/privacy" className="hover:text-primary">
                  Политика конфиденциальности
                </Link>
              </div>
            </div>

            <div className="flex space-x-4">
              <a href="#" className="footer-icon pressable" aria-label="ВКонтакте">
                <i className="fab fa-vk text-xl"></i>
              </a>
              <a href="#" className="footer-icon pressable" aria-label="Telegram">
                <i className="fab fa-telegram text-xl"></i>
              </a>
              <a href="#" className="footer-icon pressable" aria-label="YouTube">
                <i className="fab fa-youtube text-xl"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
