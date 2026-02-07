// src/components/layout/Header.tsx
'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/ui/NotificationBell'
import SearchInput from '@/components/ui/SearchInput'
import { useAppContext } from '@/contexts/AppContext'

export default function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { setSearchQuery } = useAppContext()
  const showSearch = status === 'authenticated' && !pathname.startsWith('/login') && !pathname.startsWith('/register')
  const forceHardNavigate = pathname === '/profile'

  const hardNavigate = (href: string) => (e: React.MouseEvent) => {
    if (!forceHardNavigate) return
    e.preventDefault()
    window.location.href = href
  }

  if (status === 'loading') {
    return (
      <header className="fixed top-0 left-0 right-0 z-[300] bg-white/70 backdrop-blur-2xl border-b border-white/60 shadow-xl pointer-events-auto isolate">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-primary pressable">
                БГИТУ Афиша
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <div className="animate-pulse w-24 h-4 bg-gray-200 rounded"></div>
              <div className="animate-pulse w-10 h-10 bg-gray-200 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[300] bg-white/70 backdrop-blur-2xl border-b border-white/60 shadow-xl pointer-events-auto isolate">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-primary pressable" onClick={hardNavigate('/')}>
              БГИТУ Афиша
            </Link>
            <nav className="hidden lg:flex space-x-4">
              <Link 
                href="/" 
                className={`nav-link pressable font-medium ${pathname === '/' ? 'text-accent' : 'text-gray-600 hover:text-primary'}`}
                onClick={hardNavigate('/')}
              >
                Главная
              </Link>
              <Link 
                href="/events" 
                className={`nav-link pressable font-medium ${pathname === '/events' ? 'text-accent' : 'text-gray-600 hover:text-primary'}`}
                onClick={hardNavigate('/events')}
              >
                Мероприятия
              </Link>
              <Link 
                href="/calendar" 
                className={`nav-link pressable font-medium ${pathname === '/calendar' ? 'text-accent' : 'text-gray-600 hover:text-primary'}`}
                onClick={hardNavigate('/calendar')}
              >
                Календарь
              </Link>
              <Link
                href="/notifications"
                className={`nav-link pressable font-medium ${pathname === '/notifications' ? 'text-accent' : 'text-gray-600 hover:text-primary'}`}
                onClick={hardNavigate('/notifications')}
              >
                Уведомления
              </Link>
              {(session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN') && (
                <Link 
                  href="/events/create" 
                  className={`nav-link pressable font-medium ${pathname === '/events/create' ? 'text-accent' : 'text-gray-600 hover:text-primary'}`}
                  onClick={hardNavigate('/events/create')}
                >
                  Создать
                </Link>
              )}
              {session?.user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className={`nav-link pressable font-medium ${pathname.startsWith('/admin') ? 'text-accent' : 'text-gray-600 hover:text-primary'}`}
                  onClick={hardNavigate('/admin')}
                >
                  Админ
                </Link>
              )}
            </nav>
          </div>

          {showSearch && (
            <div className="hidden xl:block flex-1 max-w-lg">
              <SearchInput
                placeholder="Поиск мероприятий..."
                onSearch={setSearchQuery}
                className="w-full"
                inputClassName="py-2.5 text-sm"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-4">
            <NotificationBell />
            
            {session ? (
              <div className="flex items-center space-x-3">
                <Link
                  href="/profile"
                  className="text-gray-600 hidden md:block hover:text-primary transition-colors pressable"
                  title="Перейти в профиль"
                  onClick={hardNavigate('/profile')}
                >
                  {session.user?.name}
                </Link>
                <Link 
                  href="/profile"
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary text-white flex items-center justify-center hover:opacity-90 pressable"
                  title="Перейти в профиль"
                  onClick={hardNavigate('/profile')}
                >
                  {session.user?.name?.charAt(0) || 'U'}
                </Link>
              </div>
            ) : (
              <Link 
                href="/login"
                className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-2 rounded-lg hover:opacity-90 font-medium pressable"
                onClick={hardNavigate('/login')}
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}



