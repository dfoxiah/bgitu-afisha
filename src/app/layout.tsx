/**
 * File responsibility:
 * Root app layout with global providers and baseline styles.
 *
 * Main logic:
 * - Wrap all pages with common shell/providers.
 * - Attach global metadata and fonts/styles.
 *
 * Integrations:
 * - Next.js App Router root layout
 * - Session/theme/toast providers
 */
import type { Metadata } from 'next'
import { Manrope, Unbounded } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import '@/styles/globals.css'
import { AppProvider } from '@/contexts/AppContext'
import SessionProvider from '@/components/providers/SessionProvider'
import LayoutShell from '@/components/layout/LayoutShell'

const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-body' })
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'БГИТУ Афиша - Мероприятия университета',
  description: 'Агрегатор мероприятий Брянского государственного инженерно-технологического университета',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${manrope.variable} ${unbounded.variable} bg-light-gray`}>
        <SessionProvider session={session}>
          <AppProvider>
            <LayoutShell>{children}</LayoutShell>
          </AppProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
