"use client"

/**
 * File responsibility:
 * Global error boundary UI for App Router.
 */

import { useEffect } from "react"
import Button from "@/components/ui/Button"
import PageState from "@/components/ui/PageState"

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Unhandled app error:", error)
  }, [error])

  return (
    <PageState
      title="Что-то пошло не так"
      subtitle="Произошла ошибка загрузки страницы. Попробуйте повторить действие."
      iconClass="fas fa-triangle-exclamation"
      actions={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={reset}>
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
