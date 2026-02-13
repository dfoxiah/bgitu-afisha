/**
 * File responsibility:
 * Top navigation header with user actions and route links.
 *
 * Main logic:
 * - Render responsive navigation controls.
 * - Display auth-aware controls and quick actions.
 *
 * Integrations:
 * - next-auth session state
 * - Layout shell and app pages
 */
// src/components/layout/Header.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import NotificationBell from '@/components/ui/NotificationBell'
import SearchInput from '@/components/ui/SearchInput'
import { useAppContext } from '@/contexts/AppContext'

export default function Header() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { setSearchQuery, categories, selectedCategory, setSelectedCategory } = useAppContext()
  const showSearch = status === 'authenticated'
    && !pathname.startsWith('/login')
    && !pathname.startsWith('/register')
    && !pathname.startsWith('/news')
  const forceHardNavigate = pathname === '/profile'
  const [menuOpen, setMenuOpen] = useState(false)

  const hardNavigate = (href: string) => (e: React.MouseEvent) => {
    if (!forceHardNavigate) return
    e.preventDefault()
    window.location.href = href
  }

  const handleMenuNavigate = (href: string) => (e: React.MouseEvent) => {
    setMenuOpen(false)
    if (!forceHardNavigate) return
    e.preventDefault()
    window.location.href = href
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
    setMenuOpen(false)
    if (pathname !== '/dashboard') {
      router.push('/dashboard')
    }
  }

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
    document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const menuItems = useMemo(() => {
    const items = [
      { href: '/', label: 'Главная', show: true },
      { href: '/events', label: 'Мероприятия', show: true },
      { href: '/news', label: 'Новостная лента', show: true },
      { href: '/calendar', label: 'Календарь', show: true },
      { href: '/notifications', label: 'Уведомления', show: true }
    ]

    if (session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN') {
      items.push({ href: '/events/create', label: 'Создать', show: true })
    }

    if (session?.user?.role === 'ADMIN') {
      items.push({ href: '/admin', label: 'Админ', show: true })
    }

    if (session) {
      items.push({ href: '/profile', label: 'Профиль', show: true })
    } else {
      items.push({ href: '/login', label: 'Войти', show: true })
    }

    return items
  }, [session])

  if (status === 'loading') {
    return (
      <header className="fixed top-0 left-0 right-0 z-[900] bg-white/70 backdrop-blur-2xl border-b border-white/60 shadow-xl pointer-events-auto isolate">
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
    <>
      <header className="fixed top-0 left-0 right-0 z-[900] bg-white/70 backdrop-blur-2xl border-b border-white/60 shadow-xl pointer-events-auto isolate">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
            <Link href="/" className="text-xl sm:text-2xl font-bold text-primary pressable" onClick={hardNavigate('/')}>
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
                href="/news" 
                className={`nav-link pressable font-medium ${pathname === '/news' ? 'text-accent' : 'text-gray-600 hover:text-primary'}`}
                onClick={hardNavigate('/news')}
              >
                Новостная лента
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
          
          <div className="flex items-center gap-2 sm:gap-4">
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
                className="bg-gradient-to-r from-primary to-secondary text-white px-3 py-2 sm:px-4 rounded-lg hover:opacity-90 font-medium pressable text-sm sm:text-base"
                onClick={hardNavigate('/login')}
              >
                Войти
              </Link>
            )}

            <button
              type="button"
              className="header-icon pressable lg:hidden w-10 h-10 rounded-2xl bg-white/70 border border-white/70 shadow flex items-center justify-center hover:bg-white/90 hover:border-accent transition-colors"
              aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
              onClick={() => setMenuOpen(prev => !prev)}
            >
              <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'} text-gray-600`}></i>
            </button>
          </div>
        </div>
      </div>
    </header>
    {menuOpen && (
      <div className="fixed inset-0 z-[950] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          ></div>
          <div className="absolute right-0 top-0 h-full w-full sm:w-[85%] max-w-sm bg-white border-l border-white/70 shadow-2xl flex flex-col">
            <div className="px-5 pt-6 pb-4 border-b border-white/70 sticky top-0 bg-white">
              <div className="text-xs uppercase tracking-wide text-gray-500">Меню</div>
              <div className="text-lg font-semibold text-primary mt-1">
                {session?.user?.name || session?.user?.email || 'БГИТУ Афиша'}
              </div>
            </div>

            {showSearch && (
              <div className="px-4 pt-4">
                <SearchInput
                  placeholder="Поиск мероприятий..."
                  onSearch={setSearchQuery}
                  className="w-full"
                  inputClassName="py-2.5 text-sm"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <nav className="space-y-2">
                {menuItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 hover:bg-slate-50'
                    }`}
                    onClick={handleMenuNavigate(item.href)}
                  >
                    <span>{item.label}</span>
                    <i className="fas fa-chevron-right text-xs text-gray-400"></i>
                  </Link>
                ))}
              </nav>

              {categories.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Категории</div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(category => (
                      <button
                        key={category}
                        type="button"
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selectedCategory === category
                            ? 'bg-gradient-to-r from-secondary to-accent text-white border-transparent shadow-custom'
                            : 'bg-white border-white/80 text-gray-700 hover:bg-slate-50'
                        }`}
                        onClick={() => handleCategorySelect(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 pb-6">
              <button
                type="button"
                className="w-full rounded-2xl border border-white/70 bg-white/70 py-3 text-sm font-medium text-gray-600 hover:bg-white"
                onClick={() => setMenuOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
      </div>
    )}
    </>
  )
}



