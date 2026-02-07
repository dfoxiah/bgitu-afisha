// src/components/dev/DebuggerInitializer.tsx
'use client'

import { useEffect } from 'react'
import { debuggerInstance } from '@/lib/debugger'
import DebuggerPanel from './DebuggerPanel'

export default function DebuggerInitializer() {
  useEffect(() => {
    // Только в development режиме
    if (process.env.NODE_ENV === 'development') {
      // Включаем дебаггер с ограниченными категориями
      debuggerInstance.setConfig({
        enabled: false,
        logLevel: 'error',
        categories: ['all'], // Исправлено
        showTimestamps: true,
        showComponentName: true,
        showStackTraces: false
      })
      
      // Глобальные обработчики ошибок
      const originalError = console.error
      console.error = (...args) => {
        debuggerInstance.error('global', 'Console', 'Global error', args) // Исправлено: 'global'
        originalError.apply(console, args)
      }

      window.addEventListener('error', (event) => {
        debuggerInstance.error('global', 'Window', 'Uncaught error', { // Исправлено: 'global'
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        })
      })

      window.addEventListener('unhandledrejection', (event) => {
        debuggerInstance.error('global', 'Window', 'Unhandled promise rejection', { // Исправлено: 'global'
          reason: event.reason
        })
      })

      // Глобальная функция для управления дебаггером
      ;(window as any).__DEBUGGER = {
        toggle: () => debuggerInstance.toggle(),
        enable: () => {
          debuggerInstance.enable()
          debuggerInstance.setConfig({ categories: ['all'] })
        },
        disable: () => debuggerInstance.disable(),
        logs: () => debuggerInstance.getLogs(),
        config: () => debuggerInstance.getConfig(),
        setConfig: (config: any) => debuggerInstance.setConfig(config)
      }

      console.log('%c⚠️ Developer Debugger Available (disabled by default)', 
        'color: #FF9800; font-weight: bold; font-size: 14px;')
      console.log('%cEnable with: window.__DEBUGGER.enable()', 
        'color: #2196F3; font-style: italic;')
    }

    return () => {
      // Cleanup
      if ((window as any).__DEBUGGER) {
        delete (window as any).__DEBUGGER
      }
    }
  }, [])

  // Показываем панель только в development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return <DebuggerPanel />
}