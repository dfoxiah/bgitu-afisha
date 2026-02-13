/**
 * File responsibility:
 * Floating development panel to inspect and configure runtime debugger logs.
 *
 * Main logic:
 * - Subscribe to `debugger:log` events
 * - Update debugger configuration from UI controls
 * - Render last log entries with severity highlighting
 *
 * Integrations:
 * - src/lib/debugger.ts
 * - src/components/dev/DebuggerInitializer.tsx
 */
'use client'

import { useEffect, useState, type MouseEvent } from 'react'
import { debuggerInstance, type DebugConfig, type LogCategory, type LogEntry, type LogLevel } from '@/lib/debugger'

const CATEGORIES: LogCategory[] = [
  'auth',
  'events',
  'api',
  'ui',
  'db',
  'profile',
  'validation',
  'storage',
  'component',
  'performance',
  'context',
  'notifications',
  'global',
  'all',
]

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

const isLogLevel = (value: string): value is LogLevel => LOG_LEVELS.includes(value as LogLevel)

const resolveLogTime = (timestamp: Date | string) => {
  if (timestamp instanceof Date) return timestamp
  return new Date(timestamp)
}

export default function DebuggerPanel() {
  const [isVisible, setIsVisible] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [config, setConfig] = useState<DebugConfig>(debuggerInstance.getConfig())

  useEffect(() => {
    const handleLog = (event: Event) => {
      const customEvent = event as CustomEvent<LogEntry>
      if (!customEvent.detail) return
      setLogs((prev) => [...prev, customEvent.detail])
    }

    window.addEventListener('debugger:log', handleLog as EventListener)
    return () => window.removeEventListener('debugger:log', handleLog as EventListener)
  }, [])

  const toggleVisibility = (event?: MouseEvent) => {
    setIsVisible((prev) => !prev)
    debuggerInstance.trackClick('DebuggerPanel', 'toggle', event)
  }

  const updateConfig = (updates: Partial<DebugConfig>) => {
    debuggerInstance.setConfig(updates)
    setConfig(debuggerInstance.getConfig())
  }

  const clearLogs = (event?: MouseEvent) => {
    debuggerInstance.clearLogs()
    setLogs([])
    debuggerInstance.trackClick('DebuggerPanel', 'clearLogs', event)
  }

  const copyLogs = (event?: MouseEvent) => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2))
    debuggerInstance.info('ui', 'DebuggerPanel', 'Logs copied to clipboard')
    debuggerInstance.trackClick('DebuggerPanel', 'copyLogs', event)
  }

  const handleLogLevelChange = (value: string) => {
    if (!isLogLevel(value)) return
    updateConfig({ logLevel: value })
  }

  const handleCategoryToggle = (category: LogCategory, checked: boolean) => {
    if (category === 'all') {
      updateConfig({ categories: checked ? ['all'] : [] })
      return
    }

    const categoriesWithoutAll = config.categories.filter((item) => item !== 'all')
    const nextCategories = checked
      ? Array.from(new Set([...categoriesWithoutAll, category]))
      : categoriesWithoutAll.filter((item) => item !== category)

    updateConfig({ categories: nextCategories.length > 0 ? nextCategories : ['all'] })
  }

  if (!isVisible) {
    return (
      <button
        onClick={(event) => toggleVisibility(event)}
        className="fixed bottom-3 right-3 z-50 p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors sm:bottom-4 sm:right-4"
        title="Developer Debugger"
      >
        DBG
      </button>
    )
  }

  return (
    <div className="fixed inset-x-2 bottom-2 z-50 max-h-[86vh] overflow-hidden rounded-lg border border-gray-700 bg-gray-900 text-gray-100 shadow-xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96">
      <div className="flex items-start justify-between gap-2 border-b border-gray-700 p-3 sm:items-center sm:p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-1 rounded bg-gray-800">DBG</span>
          <h3 className="font-bold text-sm sm:text-base">Developer Debugger</h3>
          <span className={`px-2 py-1 text-xs rounded-full ${config.enabled ? 'bg-green-600' : 'bg-red-600'}`}>
            {config.enabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={(event) => toggleVisibility(event)}
            className="p-1 hover:bg-gray-700 rounded"
            title="Minimize"
          >
            _
          </button>
          <button
            onClick={(event) => {
              debuggerInstance.toggle()
              setConfig(debuggerInstance.getConfig())
              debuggerInstance.trackClick('DebuggerPanel', 'toggleDebugger', event)
            }}
            className="p-1 hover:bg-gray-700 rounded"
            title="Toggle Debugger"
          >
            {config.enabled ? 'STOP' : 'START'}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">Level:</label>
            <select
              value={config.logLevel}
              onChange={(event) => handleLogLevelChange(event.target.value)}
              className="bg-gray-800 text-sm rounded px-2 py-1"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Categories:</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={config.categories.includes(category) || config.categories.includes('all')}
                    onChange={(event) => handleCategoryToggle(category, event.target.checked)}
                  />
                  {category}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.showTimestamps}
                onChange={(event) => updateConfig({ showTimestamps: event.target.checked })}
              />
              Show timestamps
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.showComponentName}
                onChange={(event) => updateConfig({ showComponentName: event.target.checked })}
              />
              Show component names
            </label>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={(event) => clearLogs(event)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm"
          >
            Clear Logs
          </button>
          <button
            onClick={(event) => copyLogs(event)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm"
          >
            Copy Logs
          </button>
        </div>

        <div className="bg-black rounded p-3 max-h-48 overflow-y-auto sm:max-h-64">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center text-sm">No logs yet...</div>
          ) : (
            logs.slice(-20).map((log, index) => {
              const timestamp = resolveLogTime(log.timestamp)

              return (
                <div
                  key={`${log.component}-${log.message}-${index}`}
                  className={`text-xs font-mono mb-2 p-2 rounded border-l-4 ${
                    log.level === 'error'
                      ? 'border-red-500 bg-red-900/20'
                      : log.level === 'warn'
                        ? 'border-yellow-500 bg-yellow-900/20'
                        : log.level === 'info'
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-gray-500 bg-gray-800'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-bold">{log.component}</span>
                    <span className="text-gray-400">{timestamp.toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1">{log.message}</div>
                  {log.data !== undefined && (
                    <pre className="mt-1 text-gray-400 overflow-x-auto">{JSON.stringify(log.data, null, 2)}</pre>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="mt-4 text-xs text-gray-400">
          Logs: {logs.length} | Filter: {config.categories.join(', ')} | Level: {config.logLevel}
        </div>
      </div>
    </div>
  )
}
