/**
 * File responsibility:
 * Global 404 page for missing routes.
 */

import Link from "next/link"

export default function NotFound() {
  return (
    <div className="status-screen">
      <div className="status-card space-y-4">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-primary">
          <i className="fas fa-compass" />
        </div>

        <h1 className="text-2xl font-semibold text-primary">Страница не найдена</h1>
        <p className="text-sm leading-7 text-slate-600">
          Такой страницы нет или она была перемещена. Вернитесь в ленту событий.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" className="btn btn-primary px-4 py-2 text-sm">
            К событиям
          </Link>
          <Link href="/" className="btn btn-secondary px-4 py-2 text-sm">
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
