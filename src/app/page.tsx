/**
 * File responsibility:
 * Public entry page of the application.
 *
 * Main logic:
 * - Render landing/start experience.
 * - Provide navigation to authentication and dashboard flows.
 *
 * Integrations:
 * - App Router home route
 * - Layout and shared UI components
 */
"use client"

import { useEffect, useRef } from "react"
import { getSession, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import PageState from "@/components/ui/PageState"

const REDIRECT_FALLBACK_MS = 1500

export default function HomePage() {
  const { status } = useSession()
  const router = useRouter()
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
      return
    }

    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }

    if (!fallbackTimerRef.current) {
      fallbackTimerRef.current = setTimeout(async () => {
        const freshSession = await getSession()
        router.replace(freshSession ? "/dashboard" : "/login")
      }, REDIRECT_FALLBACK_MS)
    }

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
  }, [status, router])

  return (
    <PageState
      title="Загрузка приложения..."
      subtitle="Пожалуйста, подождите"
      spinning
    />
  )
}
