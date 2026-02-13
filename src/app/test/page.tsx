/**
 * File responsibility:
 * Internal test page used for local diagnostics and manual checks.
 *
 * Main logic:
 * - Render testing widgets/scenarios.
 * - Support quick manual verification during development.
 *
 * Integrations:
 * - Dev-only components/helpers
 * - App Router /test route
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default function TestPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Тестовая страница</h1>
      <p>Эта страница доступна без авторизации для тестирования</p>
      <div className="mt-4 space-y-2">
        <Link href="/login" className="block text-blue-500 hover:underline">Перейти на логин</Link>
        <Link href="/dashboard" className="block text-blue-500 hover:underline">Перейти на дашборд</Link>
        <Link href="/api/events" className="block text-blue-500 hover:underline">Тест API events</Link>
        <Link href="/api/events/empty" className="block text-blue-500 hover:underline">Тест API empty</Link>
      </div>
    </div>
  )
}
