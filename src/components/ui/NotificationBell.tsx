'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/contexts/AppContext'
import NotificationModal from './NotificationModal'
import Modal from './Modal'
import Button from './Button'

const NotificationBell = () => {
  const {
    notifications = [],
    markNotificationAsRead,
    clearAllNotifications,
    refreshNotifications
  } = useAppContext()
  
  const { data: session } = useSession()
  const canCreateNotifications = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const activeNotification = notifications.find(n => n.id === activeNotificationId) || null

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (activeNotification && !activeNotification.read) {
      markNotificationAsRead(activeNotification.id)
    }
  }, [activeNotification, markNotificationAsRead])


  const handleClearAll = () => {
    if (confirm('Вы уверены, что хотите очистить все уведомления?')) {
      clearAllNotifications()
      setIsDropdownOpen(false)
      setActiveNotificationId(null)
    }
  }

  return (
    <div className="notification-container relative" ref={dropdownRef}>
      <div 
        className="header-icon pressable w-10 h-10 rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center cursor-pointer hover:bg-white/90 hover:border-accent transition-colors"
        onClick={() => {
          const nextOpen = !isDropdownOpen
          setIsDropdownOpen(nextOpen)
          if (nextOpen) {
            refreshNotifications()
          }
        }}
      >
        <i className="fas fa-bell text-gray-600"></i>
        {unreadCount > 0 && (
          <div className="notification-count absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {isDropdownOpen && (
        <div className="dropdown fixed inset-0 z-[960] sm:absolute sm:inset-auto sm:top-14 sm:right-0">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm sm:hidden"
            onClick={() => setIsDropdownOpen(false)}
            aria-hidden="true"
          ></div>
          <div className="absolute left-4 right-4 top-16 sm:static bg-white rounded-2xl shadow-2xl w-auto sm:w-80 border border-white/70 max-h-[75vh] sm:max-h-[70vh] overflow-hidden">
            <div className="dropdown-header px-4 py-3 border-b border-white/70 font-semibold text-primary bg-white rounded-t-2xl">
            Уведомления
            {notifications.length > 0 && (
              <span className="text-sm text-gray-600 ml-2">
                {unreadCount} непрочитанных
              </span>
            )}
          </div>
          
          <div className="max-h-[55vh] sm:max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Нет уведомлений
              </div>
            ) : (
              notifications.slice(0, 10).map(notification => (
                <div
                  key={notification.id}
                  className={`dropdown-item px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => {
                    setIsDropdownOpen(false)
                    setIsModalOpen(false)
                    setActiveNotificationId(notification.id)
                  }}
                >
                  <div className="flex items-start gap-3">
                    <i className={`fas fa-${
                      notification.type === 'NEW' ? 'calendar-plus' :
                      notification.type === 'CHANGE' ? 'edit' :
                      notification.type === 'COMPLETE' ? 'check-circle' : 'info-circle'
                    } text-accent mt-1`}></i>
                    <div className="flex-grow">
                      <div className={`font-medium ${notification.read ? 'text-gray-700' : 'text-primary'}`}>
                        {notification.content}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(notification.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          
          {notifications.length > 0 && (
            <div 
              className="dropdown-item px-4 py-3 border-t border-gray-200 hover:bg-red-50 cursor-pointer text-red-600 font-semibold"
              onClick={handleClearAll}
            >
              <i className="fas fa-trash-alt mr-2"></i>
              Очистить все уведомления
            </div>
          )}

          <div
            className="dropdown-item px-4 py-3 border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
            onClick={() => {
              setIsDropdownOpen(false)
              router.push('/notifications')
            }}
          >
            <i className="fas fa-layer-group mr-2"></i>
            Все уведомления
          </div>

          {canCreateNotifications && (
            <div 
              className="dropdown-item px-4 py-3 border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                setIsDropdownOpen(false)
                setIsModalOpen(true)
              }}
            >
              <i className="fas fa-plus mr-2"></i>
              Создать уведомление
            </div>
          )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <NotificationModal onClose={() => setIsModalOpen(false)} />
      )}

      {activeNotification && (
        <Modal
          isOpen={true}
          onClose={() => setActiveNotificationId(null)}
          title="Уведомление"
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              {new Date(activeNotification.createdAt).toLocaleString('ru-RU')}
            </div>
            <div className="text-xs uppercase text-gray-400 tracking-wide">
              Статус: {activeNotification.read ? 'прочитано' : 'непрочитано'}
            </div>
            <div className="text-gray-800 whitespace-pre-wrap">
              {activeNotification.content}
            </div>
            {activeNotification.metadata?.eventId ? (
              <Button
                variant="primary"
                onClick={() => {
                  const eventId = activeNotification.metadata?.eventId as string
                  setActiveNotificationId(null)
                  if (eventId) {
                    router.push(`/events/${eventId}`)
                  }
                }}
              >
                Открыть мероприятие
              </Button>
            ) : (
              <div className="text-sm text-gray-500">
                Для этого уведомления не привязано мероприятие.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default NotificationBell
