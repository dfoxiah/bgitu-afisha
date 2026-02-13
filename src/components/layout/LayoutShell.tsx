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
    <div className="min-h-screen flex flex-col">
      {!hideChrome && <Header />}
      <main className={`flex-grow relative z-0 ${hideChrome ? '' : 'pt-20 sm:pt-24'}`}>
        {children}
      </main>
      {!hideChrome && <Footer />}
      <ToastProvider />
      <DebuggerInitializer />
    </div>
  )
}
