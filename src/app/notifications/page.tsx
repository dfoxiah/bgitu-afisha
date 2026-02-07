'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAppContext } from '@/contexts/AppContext'
import Button from '@/components/ui/Button'

const typeLabels: Record<string, string> = {
  NEW: 'Новое событие',
  CHANGE: 'Изменение',
  COMPLETE: 'Завершение',
  EVENT: 'Событие',
  SYSTEM: 'Системное'
}

const typeIcons: Record<string, string> = {
  NEW: 'calendar-plus',
  CHANGE: 'edit',
  COMPLETE: 'check-circle',
  EVENT: 'bell',
  SYSTEM: 'info-circle'
}

export default function NotificationsPage() {
  const { notifications, markNotificationAsRead, clearAllNotifications, refreshNotifications } = useAppContext()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'read' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'NEW' | 'CHANGE' | 'COMPLETE' | 'EVENT' | 'SYSTEM'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const hasLoadedRef = useRef(false)

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = notifications.filter(notification => {
      if (statusFilter === 'read' && !notification.read) return false
      if (statusFilter === 'unread' && notification.read) return false
      if (typeFilter !== 'all' && notification.type !== typeFilter) return false

      if (normalizedQuery) {
        const haystack = `${notification.title} ${notification.content}`.toLowerCase()
        if (!haystack.includes(normalizedQuery)) return false
      }

      return true
    })

    result.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
    })

    return result
  }, [notifications, query, statusFilter, typeFilter, sortOrder])

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    refreshNotifications()
  }, [refreshNotifications])

  return (
    <div className="min-h-screen px-4 md:px-5% py-8">
      <div className="container mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Уведомления</h1>
            <p className="text-sm text-gray-500 mt-1">
              Всего: {notifications.length} • Непрочитано: {unreadCount}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm('Очистить все уведомления?')) {
                  clearAllNotifications()
                }
              }}
              disabled={notifications.length === 0}
            >
              Очистить все
            </Button>
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-primary transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>

        <div className="liquid-section p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по тексту уведомления"
              className="liquid-input px-4 py-3"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="liquid-input px-4 py-3"
            >
              <option value="all">Все статусы</option>
              <option value="unread">Непрочитанные</option>
              <option value="read">Прочитанные</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="liquid-input px-4 py-3"
            >
              <option value="all">Все типы</option>
              <option value="NEW">Новое событие</option>
              <option value="CHANGE">Изменение</option>
              <option value="COMPLETE">Завершение</option>
              <option value="EVENT">Событие</option>
              <option value="SYSTEM">Системное</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className={`liquid-chip px-4 py-2 ${sortOrder === 'newest' ? 'text-primary' : 'text-gray-500'}`}
              onClick={() => setSortOrder('newest')}
              type="button"
            >
              Сначала новые
            </button>
            <button
              className={`liquid-chip px-4 py-2 ${sortOrder === 'oldest' ? 'text-primary' : 'text-gray-500'}`}
              onClick={() => setSortOrder('oldest')}
              type="button"
            >
              Сначала старые
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="liquid-section p-8 text-center text-gray-500">
              Уведомлений не найдено.
            </div>
          ) : (
            filtered.map(notification => (
              <div
                key={notification.id}
                className={`liquid-card liquid-card-hover p-6 space-y-4 ${notification.read ? 'opacity-85' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-white/70 border border-white/70 flex items-center justify-center text-accent shadow">
                      <i className={`fas fa-${typeIcons[notification.type] || 'bell'}`}></i>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-gray-400 tracking-wide">
                        {typeLabels[notification.type] || notification.type}
                      </div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">
                        {notification.title || 'Уведомление'}
                      </div>
                      <div className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                        {notification.content}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {new Date(notification.createdAt).toLocaleString('ru-RU')}
                    <div className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${notification.read ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                      {notification.read ? 'прочитано' : 'не прочитано'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!notification.read && (
                    <Button
                      variant="secondary"
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      Отметить как прочитанное
                    </Button>
                  )}
                  {notification.metadata?.eventId && (
                    <Link href={`/events/${notification.metadata.eventId}`} className="text-accent hover:text-primary">
                      Перейти к мероприятию
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
