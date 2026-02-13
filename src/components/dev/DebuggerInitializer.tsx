/**
 * File responsibility:
 * Development-only bootstrap for debugger instrumentation and global controls.
 *
 * Main logic:
 * - Register global error handlers and pipe them to debugger
 * - Expose `window.__DEBUGGER` helper API in development
 * - Mount visual debug panel only in development mode
 *
 * Integrations:
 * - src/lib/debugger.ts
 * - src/components/dev/DebuggerPanel.tsx
 */
'use client'

import { useEffect } from 'react'
import { debuggerInstance, type DebugConfig } from '@/lib/debugger'
import DebuggerPanel from './DebuggerPanel'

type DebuggerGlobalApi = {
  toggle: () => void
  enable: () => void
  disable: () => void
  logs: () => ReturnType<typeof debuggerInstance.getLogs>
  config: () => ReturnType<typeof debuggerInstance.getConfig>
  setConfig: (config: Partial<DebugConfig>) => void
}

declare global {
  interface Window {
    __DEBUGGER?: DebuggerGlobalApi
  }
}

export default function DebuggerInitializer() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      debuggerInstance.setConfig({
        enabled: false,
        logLevel: 'error',
        categories: ['all'],
        showTimestamps: true,
        showComponentName: true,
        showStackTraces: false,
      })

      const originalError = console.error
      console.error = (...args: unknown[]) => {
        debuggerInstance.error('global', 'Console', 'Global error', args)
        originalError.apply(console, args)
      }

      const errorHandler = (event: ErrorEvent) => {
        debuggerInstance.error('global', 'Window', 'Uncaught error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        })
      }

      const rejectionHandler = (event: PromiseRejectionEvent) => {
        debuggerInstance.error('global', 'Window', 'Unhandled promise rejection', {
          reason: event.reason,
        })
      }

      window.addEventListener('error', errorHandler)
      window.addEventListener('unhandledrejection', rejectionHandler)

      window.__DEBUGGER = {
        toggle: () => debuggerInstance.toggle(),
        enable: () => {
          debuggerInstance.enable()
          debuggerInstance.setConfig({ categories: ['all'] })
        },
        disable: () => debuggerInstance.disable(),
        logs: () => debuggerInstance.getLogs(),
        config: () => debuggerInstance.getConfig(),
        setConfig: (config: Partial<DebugConfig>) => debuggerInstance.setConfig(config),
      }

      console.log(
        '%cDeveloper Debugger Available (disabled by default)',
        'color: #FF9800; font-weight: bold; font-size: 14px;'
      )
      console.log('%cEnable with: window.__DEBUGGER?.enable()', 'color: #2196F3; font-style: italic;')

      return () => {
        console.error = originalError
        window.removeEventListener('error', errorHandler)
        window.removeEventListener('unhandledrejection', rejectionHandler)

        if (window.__DEBUGGER) {
          delete window.__DEBUGGER
        }
      }
    }

    return undefined
  }, [])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return <DebuggerPanel />
}
