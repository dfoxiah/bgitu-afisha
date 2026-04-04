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
import DebuggerInitializer from '@/components/dev/DebuggerInitializer'

type LayoutShellProps = {
  children: React.ReactNode
}

export default function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname()
  const hideChrome = pathname === '/login' || pathname === '/register'

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute -left-56 -top-28 h-[34rem] w-[34rem] rounded-full bg-primary/14 blur-3xl" />
        <div className="absolute right-[-12rem] top-24 h-[34rem] w-[34rem] rounded-full bg-accent/14 blur-3xl" />
        <div className="absolute bottom-[-14rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-secondary/18 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(31,52,86,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(31,52,86,0.04)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {!hideChrome && <Header />}
        <main id="main-content" className="relative z-0 flex-grow" tabIndex={-1}>
          {children}
        </main>
        {!hideChrome && <Footer />}
        <ToastProvider />
        <DebuggerInitializer />
      </div>
    </div>
  )
}
