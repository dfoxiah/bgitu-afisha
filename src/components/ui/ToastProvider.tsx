/**
 * File responsibility:
 * Global toast renderer subscribing to toast helper events.
 *
 * Main logic:
 * - Listen for show/hide toast events.
 * - Render queued notifications with severity styles.
 *
 * Integrations:
 * - src/lib/toast.ts
 * - Root layout provider chain
 */
// src/components/ui/ToastProvider.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { toastEventName, ToastPayload, ToastType } from '@/lib/toast'

interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration: number
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail
      if (!detail?.message) return

      const id = createId()
      const duration = detail.duration ?? 3200
      const type = detail.type ?? 'info'

      setToasts(prev => [...prev, { id, message: detail.message, type, duration }])

      const timer = window.setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id))
        delete timersRef.current[id]
      }, duration)

      timersRef.current[id] = timer
    }

    window.addEventListener(toastEventName, handleToast)
    return () => {
      window.removeEventListener(toastEventName, handleToast)
      Object.values(timersRef.current).forEach(timer => window.clearTimeout(timer))
      timersRef.current = {}
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-icon" aria-hidden="true">
            <i className={`fas fa-${
              toast.type === 'success' ? 'check-circle' :
              toast.type === 'error' ? 'exclamation-circle' : 'info-circle'
            }`}></i>
          </div>
          <div className="toast-message">{toast.message}</div>
          <button
            type="button"
            className="toast-close"
            aria-label="Закрыть уведомление"
            onClick={() => setToasts(prev => prev.filter(item => item.id !== toast.id))}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
