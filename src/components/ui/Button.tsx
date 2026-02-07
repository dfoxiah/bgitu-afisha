// src/components/ui/Button.tsx (обновленный)
import { ButtonHTMLAttributes, ReactNode } from 'react'
import classNames from 'classnames'
import { debuggerInstance } from '@/lib/debugger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'success' | 'danger'
  icon?: string
  badge?: number
  fullWidth?: boolean
  loading?: boolean
  debugContext?: string // Новое свойство для контекста дебаггинга
}

export default function Button({
  children,
  variant = 'primary',
  icon,
  badge,
  fullWidth = false,
  loading = false,
  disabled,
  className,
  onClick,
  debugContext = 'Button',
  ...props
}: ButtonProps) {
  const baseClasses = 'btn px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 inline-flex items-center justify-center gap-2'
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-primary to-secondary text-white shadow-custom hover:shadow-custom-hover hover:-translate-y-0.5',
    secondary: 'bg-light border border-border text-primary hover:bg-blue-50 hover:border-accent',
    success: 'bg-success text-white hover:bg-success/90',
    danger: 'bg-danger text-white hover:bg-danger/90'
  }

  const classes = classNames(
    baseClasses,
    variantClasses[variant],
    {
      'w-full': fullWidth,
      'opacity-50 cursor-not-allowed': disabled || loading,
      'btn-icon': icon && !children
    },
    className
  )

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (process.env.NODE_ENV === 'development') {
      debuggerInstance.trackClick(
        debugContext,
        typeof children === 'string' ? children : 'Button',
        e
      )
      
      debuggerInstance.debug('ui', debugContext, 'Button clicked', {
        variant,
        disabled,
        loading,
        badge,
        coordinates: { x: e.clientX, y: e.clientY }
      })
    }
    
    if (onClick) {
      onClick(e)
    }
  }

  return (
    <button 
      className={classes} 
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseEnter={() => {
        if (process.env.NODE_ENV === 'development') {
          debuggerInstance.debug('ui', debugContext, 'Button hover start')
        }
      }}
      onMouseLeave={() => {
        if (process.env.NODE_ENV === 'development') {
          debuggerInstance.debug('ui', debugContext, 'Button hover end')
        }
      }}
      {...props}
    >
      {loading ? (
        <>
          <i className="fas fa-spinner fa-spin"></i>
          Загрузка...
        </>
      ) : (
        <>
          {icon && <i className={`fas fa-${icon}`}></i>}
          {children && <span>{children}</span>}
          {badge && badge > 0 && (
            <span className="btn-badge bg-danger text-white text-xs px-2 py-0.5 rounded-full">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </>
      )}
    </button>
  )
}