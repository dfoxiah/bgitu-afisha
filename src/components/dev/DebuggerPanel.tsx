// src/components/dev/DebuggerPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { debuggerInstance } from '@/lib/debugger'

export default function DebuggerPanel() {
  const [isVisible, setIsVisible] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [config, setConfig] = useState(debuggerInstance.getConfig())

  useEffect(() => {
    const handleLog = (event: CustomEvent) => {
      setLogs(prev => [...prev, event.detail])
    }

    window.addEventListener('debugger:log' as any, handleLog)
    return () => window.removeEventListener('debugger:log' as any, handleLog)
  }, [])

  const toggleVisibility = (event?: React.MouseEvent) => {
    setIsVisible(!isVisible)
    debuggerInstance.trackClick('DebuggerPanel', 'toggle', event)
  }

  const updateConfig = (updates: Partial<typeof config>) => {
    debuggerInstance.setConfig(updates)
    setConfig(debuggerInstance.getConfig())
  }

  const clearLogs = (event?: React.MouseEvent) => {
    debuggerInstance.clearLogs()
    setLogs([])
    debuggerInstance.trackClick('DebuggerPanel', 'clearLogs', event)
  }

  const copyLogs = (event?: React.MouseEvent) => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2))
    debuggerInstance.info('ui', 'DebuggerPanel', 'Logs copied to clipboard')
    debuggerInstance.trackClick('DebuggerPanel', 'copyLogs', event)
  }

  if (!isVisible) {
    return (
      <button
        onClick={(e) => toggleVisibility(e)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors"
        title="Developer Debugger"
      >
        🐛
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-gray-900 text-gray-100 rounded-lg shadow-xl border border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐛</span>
          <h3 className="font-bold">Developer Debugger</h3>
          <span className={`px-2 py-1 text-xs rounded-full ${config.enabled ? 'bg-green-600' : 'bg-red-600'}`}>
            {config.enabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => toggleVisibility(e)}
            className="p-1 hover:bg-gray-700 rounded"
            title="Minimize"
          >
            ⬇
          </button>
          <button
            onClick={(e) => {
              debuggerInstance.toggle()
              debuggerInstance.trackClick('DebuggerPanel', 'toggleDebugger', e)
            }}
            className="p-1 hover:bg-gray-700 rounded"
            title="Toggle Debugger"
          >
            {config.enabled ? '🔴' : '🟢'}
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">Level:</label>
            <select
              value={config.logLevel}
              onChange={(e) => updateConfig({ logLevel: e.target.value as any })}
              className="bg-gray-800 text-sm rounded px-2 py-1"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Categories:</label>
            <div className="flex flex-wrap gap-2">
              {['auth', 'events', 'api', 'ui', 'db', 'profile', 'validation', 'storage', 'component', 'performance', 'context', 'notifications', 'global', 'all'].map(cat => (
                <label key={cat} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={config.categories.includes(cat as any) || config.categories.includes('all')}
                    onChange={(e) => {
                      const newCategories = e.target.checked
                        ? [...config.categories, cat]
                        : config.categories.filter(c => c !== cat)
                        updateConfig({ categories: newCategories as any })
                    }}
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.showTimestamps}
                onChange={(e) => updateConfig({ showTimestamps: e.target.checked })}
              />
              Show timestamps
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.showComponentName}
                onChange={(e) => updateConfig({ showComponentName: e.target.checked })}
              />
              Show component names
            </label>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={(e) => clearLogs(e)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm"
          >
            Clear Logs
          </button>
          <button
            onClick={(e) => copyLogs(e)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm"
          >
            Copy Logs
          </button>
        </div>

        <div className="bg-black rounded p-3 max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center text-sm">No logs yet...</div>
          ) : (
            logs.slice(-20).map((log, index) => (
              <div
                key={index}
                className={`text-xs font-mono mb-2 p-2 rounded border-l-4 ${
                  log.level === 'error' ? 'border-red-500 bg-red-900/20' :
                  log.level === 'warn' ? 'border-yellow-500 bg-yellow-900/20' :
                  log.level === 'info' ? 'border-blue-500 bg-blue-900/20' :
                  'border-gray-500 bg-gray-800'
                }`}
              >
                <div className="flex justify-between">
                  <span className="font-bold">{log.component}</span>
                  <span className="text-gray-400">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1">{log.message}</div>
                {log.data && (
                  <pre className="mt-1 text-gray-400 overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 text-xs text-gray-400">
          Logs: {logs.length} | Filter: {config.categories.join(', ')} | Level: {config.logLevel}
        </div>
      </div>
    </div>
  )
}
