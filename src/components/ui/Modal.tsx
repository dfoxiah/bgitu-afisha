/**
 * File responsibility:
 * Reusable modal dialog container component.
 *
 * Main logic:
 * - Render overlay, focus area and close behavior.
 * - Provide slot-based modal content API.
 *
 * Integrations:
 * - Forms/details modals across features
 * - Client event handlers
 */
import { ReactNode, useEffect } from "react"
import ReactDOM from "react-dom"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
}

export default function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    if (isOpen) {
      document.body.style.overflow = "hidden"
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.body.style.overflow = "unset"
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: "max-w-[36rem]",
    md: "max-w-[50rem]",
    lg: "max-w-[60rem]",
    xl: "max-w-[70rem]",
  }

  return ReactDOM.createPortal(
    <div
      className="modal-overlay fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/62 p-2.5 backdrop-blur-md sm:items-center sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal modal-shell relative my-4 w-full max-h-[88vh] overflow-hidden rounded-[1.75rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,255,0.94))] shadow-[0_34px_90px_rgba(16,24,40,0.38)] ${sizeClasses[size]} animate-scaleIn sm:my-0`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/16 via-accent/10 to-secondary/18" />

        <div className="relative z-[2] sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200/75 bg-white/88 px-5 py-4 backdrop-blur sm:items-center sm:px-7 sm:py-5">
          {title ? <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h3> : <span />}
          <button
            className="modal-close inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/85 bg-white/86 text-xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>

        <div className="modal-body max-h-[calc(88vh-80px)] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
