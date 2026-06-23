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

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import NotificationBell from "@/components/ui/NotificationBell"
import SearchInput from "@/components/ui/SearchInput"
import { useAppContext } from "@/contexts/AppContext"
import { isContentManagerRole } from "@/lib/roles"
import { showToast } from "@/lib/toast"

type HeaderMenuItem = {
  href: string
  label: string
  icon: string
  badge?: string | null
}

const BASE_NAV: HeaderMenuItem[] = [
  { href: "/dashboard", label: "Главная", icon: "house" },
  { href: "/events", label: "События", icon: "calendar-days" },
  { href: "/news", label: "Медиа", icon: "newspaper" },
  { href: "/calendar", label: "Календарь", icon: "table-cells-large" },
  { href: "/notifications", label: "Уведомления", icon: "bell" },
]

const PUBLIC_NAV: HeaderMenuItem[] = [
  { href: "/afisha", label: "Афиша", icon: "calendar-days" },
  { href: "/legal/privacy", label: "Политика", icon: "file-shield" },
  { href: "/legal/terms", label: "Соглашение", icon: "file-contract" },
]

export default function Header() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { notifications, setSearchQuery, categories, selectedCategory, setSelectedCategory } =
    useAppContext()

  const forceHardNavigate = pathname === "/profile"
  const [menuOpen, setMenuOpen] = useState(false)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const [isHeaderHovered, setIsHeaderHovered] = useState(false)
  const [stoppingScenario, setStoppingScenario] = useState(false)
  const lastScrollYRef = useRef(0)

  const showSearch =
    status === "authenticated" &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/news")
  const shouldHideHeader = isHeaderHidden && !isHeaderHovered && !menuOpen
  const homeHref = session ? "/dashboard" : "/afisha"
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  )
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount)

  const desktopNavItems = useMemo<HeaderMenuItem[]>(() => {
    if (!session) {
      return PUBLIC_NAV
    }

    const items = BASE_NAV.map((item) =>
      item.href === "/notifications"
        ? { ...item, badge: unreadCount > 0 ? unreadLabel : null }
        : item
    )

    if (isContentManagerRole(session?.user?.role)) {
      items.push({ href: "/events/create", label: "Создать", icon: "plus" })
    }

    if (session?.user?.role === "ADMIN") {
      items.push({ href: "/admin", label: "Админ", icon: "shield-halved" })
    }

    return items
  }, [session, unreadCount, unreadLabel])

  const menuItems = useMemo<HeaderMenuItem[]>(() => {
    const items = [...desktopNavItems]

    if (session) {
      items.push({ href: "/profile", label: "Профиль", icon: "user" })
    } else {
      items.push({ href: "/login", label: "Войти", icon: "arrow-right-to-bracket" })
    }

    return items
  }, [desktopNavItems, session])

  const isRouteActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href))

  const hardNavigate = (href: string) => (event: React.MouseEvent) => {
    if (!forceHardNavigate) return
    event.preventDefault()
    window.location.href = href
  }

  const handleMenuNavigate = (href: string) => (event: React.MouseEvent) => {
    setMenuOpen(false)
    if (!forceHardNavigate) return
    event.preventDefault()
    window.location.href = href
  }

  const handleStopScenario = async () => {
    try {
      setStoppingScenario(true)
      await updateSession({
        impersonation: {
          action: "stop",
        },
      })
      window.location.href = "/admin"
    } catch (error) {
      setStoppingScenario(false)
      showToast(
        error instanceof Error ? error.message : "Не удалось вернуться в основной аккаунт",
        "error"
      )
    }
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
    setMenuOpen(false)

    if (pathname !== "/dashboard") {
      router.push("/dashboard")
    }
  }

  useEffect(() => {
    setMenuOpen(false)
    setIsHeaderHidden(false)
    setIsHeaderHovered(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  useEffect(() => {
    if (menuOpen) {
      setIsHeaderHidden(false)
      setIsHeaderHovered(false)
    }
  }, [menuOpen])

  useEffect(() => {
    lastScrollYRef.current = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollYRef.current

      if (menuOpen) {
        lastScrollYRef.current = currentScrollY
        return
      }

      if (currentScrollY <= 16) {
        setIsHeaderHidden(false)
        setIsHeaderHovered(false)
      } else if (delta > 6) {
        setIsHeaderHidden(true)
        setIsHeaderHovered(false)
      } else if (delta < -6) {
        setIsHeaderHidden(false)
      }

      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [menuOpen])

  if (status === "loading") {
    return (
      <header className="sticky top-0 z-[920] border-b border-primary/10 bg-white/86 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-7xl space-y-2">
          <div className="h-7 animate-pulse rounded-xl bg-primary/10" />
          <div className="h-11 animate-pulse rounded-xl bg-primary/10" />
        </div>
      </header>
    )
  }

  return (
    <>
      {shouldHideHeader && (
        <div
          className="fixed inset-x-0 top-0 z-[925] h-5 sm:h-6"
          onMouseEnter={() => setIsHeaderHovered(true)}
          aria-hidden="true"
        />
      )}

      <header
        className={`site-header sticky top-0 z-[920] border-b border-primary/12 bg-white/84 shadow-[0_10px_28px_rgba(17,39,74,0.1)] backdrop-blur-xl transition-transform duration-300 ease-out will-change-transform ${
          shouldHideHeader ? "-translate-y-full" : "translate-y-0"
        }`}
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => {
          if (isHeaderHidden && window.scrollY > 16) {
            setIsHeaderHovered(false)
          }
        }}
      >
        <div className="border-b border-primary/10 bg-gradient-to-r from-primary/7 via-white to-accent/7">
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary/60 sm:px-6 sm:py-2 sm:text-[11px]">
            <span className="hidden sm:inline">БГИТУ • Афиша кампуса</span>
            <span className="liquid-chip justify-self-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] sm:px-3 sm:text-[11px]">
              Кампус БГИТУ 2026
            </span>
            <span className="hidden justify-self-end sm:inline">
              События, новости и уведомления
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link
              href={homeHref}
              className="group flex min-w-0 items-center gap-2 sm:gap-3"
              onClick={hardNavigate(homeHref)}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-lg sm:h-12 sm:w-12 sm:rounded-2xl">
                БГ
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-primary sm:text-base">
                  БГИТУ Афиша
                </span>
                <span className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/56 sm:block">
                  Campus Events
                </span>
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              {session?.user?.impersonatorId && (
                <>
                  <button
                    type="button"
                    className="hidden h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-[13px] font-semibold text-sky-800 shadow-[0_8px_16px_rgba(14,116,144,0.12)] transition-all hover:-translate-y-0.5 sm:inline-flex"
                    onClick={() => void handleStopScenario()}
                    disabled={stoppingScenario}
                    title="Вернуться в основной аккаунт администратора"
                  >
                    <i
                      className={`fas ${
                        stoppingScenario ? "fa-spinner fa-spin" : "fa-user-shield"
                      } text-[12px]`}
                      aria-hidden="true"
                    />
                    <span>Вернуться к админу</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-800 shadow-[0_8px_16px_rgba(14,116,144,0.12)] sm:hidden"
                    onClick={() => void handleStopScenario()}
                    disabled={stoppingScenario}
                    title="Вернуться к админу"
                    aria-label="Вернуться к админу"
                  >
                    <i
                      className={`fas ${
                        stoppingScenario ? "fa-spinner fa-spin" : "fa-user-shield"
                      } text-sm`}
                      aria-hidden="true"
                    />
                  </button>
                </>
              )}

              <NotificationBell />

              {session ? (
                <>
                  <Link
                    href="/profile"
                    className="hidden h-10 max-w-[12rem] items-center gap-2 rounded-xl border border-primary/16 bg-white/90 pl-1.5 pr-3 text-[13px] font-semibold text-primary shadow-[0_8px_16px_rgba(18,39,76,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/34 xl:inline-flex"
                    onClick={hardNavigate("/profile")}
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-white">
                      {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                    <span className="truncate">{session.user?.name || "Профиль"}</span>
                  </Link>
                  <Link
                    href="/profile"
                    className="hidden h-10 w-10 items-center justify-center rounded-xl border border-primary/16 bg-white/90 text-sm font-semibold text-primary shadow-[0_8px_16px_rgba(18,39,76,0.08)] sm:inline-flex xl:hidden"
                    title={session.user?.name || "Профиль"}
                    onClick={hardNavigate("/profile")}
                  >
                    {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-[0_10px_18px_rgba(36,88,198,0.24)] sm:hidden"
                    aria-label="Войти"
                    onClick={hardNavigate("/login")}
                  >
                    <i className="fas fa-right-to-bracket text-sm" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/login"
                    className="btn btn-primary hidden px-4 py-2 text-sm sm:inline-flex"
                    onClick={hardNavigate("/login")}
                  >
                    Войти
                  </Link>
                </>
              )}

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/18 bg-white text-primary lg:hidden"
                aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <i className={`fas ${menuOpen ? "fa-xmark" : "fa-bars"}`} />
              </button>
            </div>
          </div>

          <div className="mt-3 hidden gap-3 sm:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <nav className="hidden items-center gap-2 overflow-x-auto rounded-2xl border border-primary/12 bg-white/72 p-1.5 lg:flex">
              {desktopNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={hardNavigate(item.href)}
                  className={`nav-link inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    isRouteActive(item.href)
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-[0_10px_18px_rgba(36,88,198,0.26)]"
                      : "text-primary/70 hover:bg-primary/6 hover:text-primary"
                  }`}
                >
                  <i className={`fas fa-${item.icon} text-[11px]`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            <div className="rounded-2xl border border-primary/14 bg-white/84 p-1.5">
              {showSearch ? (
                <SearchInput
                  placeholder="Поиск мероприятий, новостей и аудиторий..."
                  onSearch={setSearchQuery}
                  className="w-full"
                  inputClassName="border-none bg-transparent py-2 text-sm shadow-none focus:ring-0"
                />
              ) : (
                <div className="px-2 py-2 text-xs text-primary/55">
                  Поиск и подборки доступны после входа
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[950] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/48 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-primary/16 bg-[linear-gradient(180deg,rgba(250,252,255,0.98),rgba(241,247,255,0.98))] shadow-[-18px_0_42px_rgba(13,29,58,0.22)]">
            <div className="border-b border-primary/14 px-5 pb-4 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/56">
                Навигация
              </p>
              <p className="mt-2 text-lg font-semibold text-primary">
                {session?.user?.name || "БГИТУ Афиша"}
              </p>
            </div>

            <div className="px-4 pt-4">
              {session?.user?.impersonatorId && (
                <button
                  type="button"
                  className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800"
                  onClick={() => void handleStopScenario()}
                  disabled={stoppingScenario}
                >
                  <i
                    className={`fas ${
                      stoppingScenario ? "fa-spinner fa-spin" : "fa-user-shield"
                    } text-[12px]`}
                    aria-hidden="true"
                  />
                  Вернуться к админу
                </button>
              )}

              {showSearch && (
                <SearchInput
                  placeholder="Поиск..."
                  onSearch={setSearchQuery}
                  className="w-full"
                  inputClassName="border-none bg-transparent py-2.5 text-sm shadow-none focus:ring-0"
                />
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                      isRouteActive(item.href)
                        ? "border-primary/40 bg-gradient-to-r from-primary to-accent text-white"
                        : "border-primary/14 bg-white/86 text-primary/78 hover:border-primary/36"
                    }`}
                    onClick={handleMenuNavigate(item.href)}
                  >
                    <span className="flex items-center gap-2">
                      <i className={`fas fa-${item.icon} text-[12px]`} />
                      {item.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {item.badge && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {item.badge}
                        </span>
                      )}
                      <i className="fas fa-chevron-right text-[10px] opacity-70" />
                    </span>
                  </Link>
                ))}
              </nav>

              {categories.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/56">
                    Категории
                  </p>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.05em] transition-all ${
                          selectedCategory === category
                            ? "border-primary/40 bg-gradient-to-r from-primary to-accent text-white"
                            : "border-primary/16 bg-white/86 text-primary/76"
                        }`}
                        onClick={() => handleCategorySelect(category)}
                      >
                        <span className="line-clamp-1">{category}</span>
                        <i
                          className={`fas ${
                            selectedCategory === category ? "fa-check" : "fa-chevron-right"
                          } text-[10px]`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-primary/14 p-4">
              <button
                type="button"
                className="w-full rounded-xl border border-primary/18 bg-white py-3 text-sm font-semibold text-primary"
                onClick={() => setMenuOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
