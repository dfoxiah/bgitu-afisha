'use client'

import { useEffect, useRef } from 'react'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const REDIRECT_FALLBACK_MS = 1500

export default function HomePage() {
  const { status } = useSession()
  const router = useRouter()
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
      return
    }

    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (!fallbackTimerRef.current) {
      fallbackTimerRef.current = setTimeout(async () => {
        const freshSession = await getSession()
        router.replace(freshSession ? '/dashboard' : '/login')
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-light-gray">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-4 border-t-4 border-accent"></div>
        <p className="text-lg text-gray-600">Загрузка приложения...</p>
        <p className="text-sm text-gray-500">Пожалуйста, подождите</p>
      </div>
    </div>
  )
}
