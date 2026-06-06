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
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-2.5 backdrop-blur-[2px] sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal modal-shell relative my-auto w-full max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-[0_24px_72px_rgba(16,24,40,0.32)] ${sizeClasses[size]} animate-scaleIn`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative z-[2] sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          {title ? <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h3> : <span />}
          <button
            className="modal-close inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>

        <div className="modal-body max-h-[calc(92vh-58px)] overflow-y-auto p-3 sm:p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
