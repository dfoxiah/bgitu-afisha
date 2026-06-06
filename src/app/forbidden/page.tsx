/**
 * File responsibility:
 * Human-readable 403 page for authenticated users without required permissions.
 */

import Link from "next/link"

export default function ForbiddenPage() {
  return (
    <div className="status-screen">
      <div className="status-card space-y-4">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
          <i className="fas fa-lock" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-semibold text-primary">Недостаточно прав</h1>
        <p className="text-sm leading-7 text-slate-600">
          Этот раздел доступен только пользователям с соответствующими правами. Если доступ нужен по роли,
          обратитесь к администратору.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" className="btn btn-primary px-4 py-2 text-sm">
            В личный кабинет
          </Link>
          <Link href="/afisha" className="btn btn-secondary px-4 py-2 text-sm">
            Публичная афиша
          </Link>
        </div>
      </div>
    </div>
  )
}
