"use client"

/**
 * File responsibility:
 * Global error boundary UI for App Router.
 */

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Button from "@/components/ui/Button"
import PageState from "@/components/ui/PageState"

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const reloadTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    console.error("Unhandled app error:", error)
  }, [error])

  useEffect(
    () => () => {
      if (reloadTimeoutRef.current) {
        window.clearTimeout(reloadTimeoutRef.current)
      }
    },
    []
  )

  const handleRetry = () => {
    setIsRetrying(true)
    reset()
    router.refresh()

    if (reloadTimeoutRef.current) {
      window.clearTimeout(reloadTimeoutRef.current)
    }
    reloadTimeoutRef.current = window.setTimeout(() => {
      window.location.reload()
    }, 1200)
  }

  return (
    <PageState
      title="Что-то пошло не так"
      subtitle="Произошла ошибка загрузки страницы. Попробуйте повторить действие."
      iconClass="fas fa-triangle-exclamation"
      actions={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={handleRetry} loading={isRetrying}>
            Попробовать снова
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign("/dashboard")}>
            На главную страницу
          </Button>
        </div>
      }
    />
  )
}
