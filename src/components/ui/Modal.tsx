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
      className="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 opacity-0 invisible transition-all duration-300"
      style={{ opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden' }}
      onClick={onClose}
    >
      <div 
        className={`modal bg-white/85 backdrop-blur-xl rounded-2xl w-[90%] max-h-[90vh] overflow-y-auto relative border border-white/70 shadow-2xl ${sizeClasses[size]} animate-scaleIn`}
        style={{ transform: isOpen ? 'scale(1)' : 'scale(0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header px-6 py-4 border-b border-white/70 flex justify-between items-center">
          {title && <h3 className="text-xl font-semibold text-primary">{title}</h3>}
          <button 
            className="modal-close text-2xl text-gray-500 hover:text-gray-700 transition-colors"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>
        <div className="modal-body p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
