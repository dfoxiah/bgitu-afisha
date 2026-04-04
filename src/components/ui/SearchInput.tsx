/**
 * File responsibility:
 * Shared search input control for list filtering.
 *
 * Main logic:
 * - Handle controlled search value updates.
 * - Emit normalized query changes to parent modules.
 *
 * Integrations:
 * - Dashboard/events/news filters
 * - AppContext search state
 */
'use client'

import { useState, useEffect, useRef } from 'react'

interface SearchInputProps {
  placeholder?: string
  onSearch: (query: string) => void
  delay?: number
  className?: string
  inputClassName?: string
}

export default function SearchInput({
  placeholder = 'Поиск...',
  onSearch,
  delay = 300,
  className,
  inputClassName,
}: SearchInputProps) {
  const [query, setQuery] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      onSearch(query)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [query, onSearch, delay])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      onSearch(query)
    }
  }

  return (
    <div className={`search-container relative ${className || ''}`}>
      <i className="fas fa-search search-icon absolute left-4 top-1/2 -translate-y-1/2 text-primary/38"></i>
      <input
        type="text"
        className={`search-box liquid-input w-full py-3 pl-12 pr-4 transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 ${
          inputClassName || ''
        }`}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
      />
    </div>
  )
}
