/**
 * File responsibility:
 * Client session provider wrapper for NextAuth in App Router.
 *
 * Main logic:
 * - Expose authenticated session context to client tree.
 * - Centralize provider instantiation.
 *
 * Integrations:
 * - next-auth/react SessionProvider
 * - src/app/layout.tsx
 */
// src/components/providers/SessionProvider.tsx
'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'

export default function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session?: Session | null
}) {
  return (
    <NextAuthSessionProvider
      session={session}
      refetchOnWindowFocus={false}
      refetchInterval={0}
    >
      {children}
    </NextAuthSessionProvider>
  )
}
