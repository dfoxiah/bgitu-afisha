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
import { ReactNode, useEffect } from 'react'
import ReactDOM from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md' 
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscape)
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  }

  return ReactDOM.createPortal(
    <div 
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm opacity-0 invisible transition-all duration-300 sm:p-4"
      style={{ opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden' }}
      onClick={onClose}
    >
      <div 
        className={`modal relative w-full max-w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/70 bg-white/85 shadow-2xl backdrop-blur-xl ${sizeClasses[size]} animate-scaleIn sm:max-w-none`}
        style={{ transform: isOpen ? 'scale(1)' : 'scale(0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header flex items-start justify-between gap-3 border-b border-white/70 px-4 py-3 sm:items-center sm:px-6 sm:py-4">
          {title && <h3 className="text-lg font-semibold text-primary sm:text-xl">{title}</h3>}
          <button 
            className="modal-close text-2xl text-gray-500 hover:text-gray-700 transition-colors"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>
        <div className="modal-body p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
