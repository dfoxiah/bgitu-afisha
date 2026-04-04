/**
 * File responsibility:
 * Reusable styled button component with variants and icon support.
 *
 * Main logic:
 * - Normalize button props and styles.
 * - Provide consistent interactive behavior across app.
 *
 * Integrations:
 * - Most page/form components
 * - Tailwind utility styles
 */
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
  debugContext?: string
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
  const baseClasses =
    'btn inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300'

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    success: 'btn-success',
    danger: 'btn-danger',
  }

  const classes = classNames(
    baseClasses,
    variantClasses[variant],
    {
      'w-full': fullWidth,
      'cursor-not-allowed opacity-50': disabled || loading,
      'btn-icon': icon && !children,
    },
    className
  )

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (process.env.NODE_ENV === 'development') {
      debuggerInstance.trackClick(debugContext, typeof children === 'string' ? children : 'Button', e)

      debuggerInstance.debug('ui', debugContext, 'Button clicked', {
        variant,
        disabled,
        loading,
        badge,
        coordinates: { x: e.clientX, y: e.clientY },
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
          {badge && badge > 0 && <span className="btn-badge rounded-full bg-danger px-2 py-0.5 text-xs text-white">{badge > 9 ? '9+' : badge}</span>}
        </>
      )}
    </button>
  )
}
