/**
 * File responsibility:
 * Common page shell combining header/footer and main content slot.
 *
 * Main logic:
 * - Compose consistent app layout wrapper.
 * - Provide shared structure for route pages.
 *
 * Integrations:
 * - Header/Footer components
 * - Root layout composition
 */
'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ToastProvider from '@/components/ui/ToastProvider'

type LayoutShellProps = {
  children: React.ReactNode
}

export default function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname()
  const hideChrome = pathname === '/login' || pathname === '/register'

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0 bg-[linear-gradient(128deg,rgba(218,238,255,0.72),rgba(248,252,255,0.44)_42%,rgba(219,248,249,0.64))]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0))]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(123,211,225,0.16))]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {!hideChrome && <Header />}
        <main id="main-content" className="relative z-0 flex-grow" tabIndex={-1}>
          {children}
        </main>
        {!hideChrome && <Footer />}
        <ToastProvider />
      </div>
    </div>
  )
}
