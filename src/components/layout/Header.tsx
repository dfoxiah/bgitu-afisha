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

type HeaderMenuItem = {
  href: string
  label: string
  icon: string
}

const BASE_NAV: HeaderMenuItem[] = [
  { href: "/", label: "Главная", icon: "house" },
  { href: "/events", label: "События", icon: "calendar-days" },
  { href: "/news", label: "Медиа", icon: "newspaper" },
  { href: "/calendar", label: "Календарь", icon: "table-cells-large" },
  { href: "/notifications", label: "Уведомления", icon: "bell" },
]

export default function Header() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { setSearchQuery, categories, selectedCategory, setSelectedCategory } = useAppContext()

  const forceHardNavigate = pathname === "/profile"
  const [menuOpen, setMenuOpen] = useState(false)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const [isHeaderHovered, setIsHeaderHovered] = useState(false)
  const lastScrollYRef = useRef(0)

  const showSearch =
    status === "authenticated" &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/news")
  const shouldHideHeader = isHeaderHidden && !isHeaderHovered && !menuOpen

  const desktopNavItems = useMemo<HeaderMenuItem[]>(() => {
    const items = [...BASE_NAV]

    if (session?.user?.role === "TEACHER" || session?.user?.role === "ADMIN") {
      items.push({ href: "/events/create", label: "Создать", icon: "plus" })
    }

    if (session?.user?.role === "ADMIN") {
      items.push({ href: "/admin", label: "Админ", icon: "shield-halved" })
    }

    return items
  }, [session])

  const menuItems = useMemo<HeaderMenuItem[]>(() => {
    const items = [...desktopNavItems]

    if (session) {
      items.push({ href: "/profile", label: "Профиль", icon: "user" })
    } else {
      items.push({ href: "/login", label: "Войти", icon: "arrow-right-to-bracket" })
    }

    return items
  }, [desktopNavItems, session])

  const isRouteActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href))

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
        className={`sticky top-0 z-[920] border-b border-primary/12 bg-white/84 shadow-[0_10px_28px_rgba(17,39,74,0.1)] backdrop-blur-xl transition-transform duration-300 ease-out will-change-transform ${
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
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary/60 sm:px-6">
            <span className="hidden sm:inline">БГИТУ • Афиша кампуса</span>
            <span className="liquid-chip justify-self-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]">
              Брянск Кампус 2026
            </span>
            <span className="hidden justify-self-end sm:inline">Единое пространство событий</span>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="group flex min-w-0 items-center gap-3" onClick={hardNavigate("/")}>
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-lg">
                БГ
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-primary">БГИТУ Афиша</span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/56">Campus Events</span>
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationBell />

              {session ? (
                <>
                  <Link
                    href="/profile"
                    className="hidden rounded-xl border border-primary/16 bg-white px-3 py-2 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:border-primary/34 md:block"
                    onClick={hardNavigate("/profile")}
                  >
                    {session.user?.name || "Профиль"}
                  </Link>
                  <Link
                    href="/profile"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white shadow-md"
                    title="Профиль"
                    onClick={hardNavigate("/profile")}
                  >
                    {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </Link>
                </>
              ) : (
                <Link href="/login" className="btn btn-primary px-4 py-2 text-sm" onClick={hardNavigate("/login")}>
                  Войти
                </Link>
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

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
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
                </Link>
              ))}
            </nav>

            <div className="rounded-2xl border border-primary/14 bg-white/84 p-1.5">
              {showSearch ? (
                <SearchInput
                  placeholder="Поиск мероприятий, аудиторий, тем..."
                  onSearch={setSearchQuery}
                  className="w-full"
                  inputClassName="border-none bg-transparent py-2 text-sm shadow-none focus:ring-0"
                />
              ) : (
                <div className="px-2 py-2 text-xs text-primary/55">Поиск доступен после входа</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[950] lg:hidden">
          <div className="absolute inset-0 bg-slate-950/48 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-hidden="true" />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-primary/16 bg-[linear-gradient(180deg,rgba(250,252,255,0.98),rgba(241,247,255,0.98))] shadow-[-18px_0_42px_rgba(13,29,58,0.22)]">
            <div className="border-b border-primary/14 px-5 pb-4 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/56">Навигация</p>
              <p className="mt-2 text-lg font-semibold text-primary">{session?.user?.name || "БГИТУ Афиша"}</p>
            </div>

            <div className="px-4 pt-4">
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
                    <i className="fas fa-chevron-right text-[10px] opacity-70" />
                  </Link>
                ))}
              </nav>

              {categories.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/56">Категории</p>
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
                        <i className={`fas ${selectedCategory === category ? "fa-check" : "fa-chevron-right"} text-[10px]`} />
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