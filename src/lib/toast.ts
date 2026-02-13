/**
 * File responsibility:
 * Client-side toast event helper for lightweight notifications.
 *
 * Main logic:
 * - Emit typed toast events with message/severity.
 * - Provide shared utility used by UI actions and forms.
 *
 * Integrations:
 * - src/components/ui/ToastProvider.tsx
 * - Client pages/components
 */
export type ToastType = 'success' | 'error' | 'info'

export interface ToastPayload {
  message: string
  type?: ToastType
  duration?: number
}

export const toastEventName = 'toast:show'

export const showToast = (message: string, type: ToastType = 'info', duration = 3200) => {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent<ToastPayload>(toastEventName, {
    detail: { message, type, duration }
  }))
}

export const toast = {
  success: (message: string, duration?: number) => showToast(message, 'success', duration),
  error: (message: string, duration?: number) => showToast(message, 'error', duration),
  info: (message: string, duration?: number) => showToast(message, 'info', duration),
}
