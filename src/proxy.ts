/**
 * File responsibility:
 * Middleware entry for route protection and session-aware redirects.
 *
 * Main logic:
 * - Apply access rules for public/private/admin routes.
 * - Forward authorized traffic and redirect unauthorized requests.
 *
 * Integrations:
 * - Next.js proxy/middleware runtime
 * - next-auth session cookies
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/profile-completion'

const STATIC_FILE_PATTERN = /\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$/i
const PUBLIC_PATHS = ['/login', '/legal', '/afisha', '/forbidden', '/api/auth', '/api/events']

const isPublicPath = (pathname: string) => {
  if (pathname.startsWith('/_next') || pathname.startsWith('/public')) return true
  if (STATIC_FILE_PATTERN.test(pathname)) return true
  if (pathname === '/' || pathname === '/manifest.webmanifest') return true
  if (/^\/events\/[^/]+$/.test(pathname)) return true

  return PUBLIC_PATHS.some(base => pathname === base || pathname.startsWith(`${base}/`))
}

const needsProfileCompletion = (token: Record<string, unknown> | null) => {
  if (!token) return false
  if (token.role === 'ADMIN') return false
  return (
    !token.profileCompletedAt ||
    token.privacyConsentVersion !== PRIVACY_POLICY_VERSION ||
    token.termsConsentVersion !== TERMS_VERSION
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (pathname === '/favicon.ico') {
    return NextResponse.redirect(new URL('/favicon.svg', request.url))
  }

  if (pathname === '/register' || pathname.startsWith('/api/auth/register')) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Публичная регистрация отключена. Используйте VK, MAX или Яндекс.' }, { status: 410 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isProfileCompletionPath =
    pathname === '/profile/complete' || pathname.startsWith('/api/auth/profile/complete')
  const isAuthPage = pathname === '/login'
  const isPublic = isPublicPath(pathname)

  let token = null
  if (isAdminPath || isAuthPage || isProfileCompletionPath || !isPublic) {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })
  }

  if (isAdminPath) {
    if (!token || token.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
      }
      return NextResponse.redirect(new URL(token ? '/forbidden' : '/login', request.url))
    }
    return NextResponse.next()
  }

  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL(needsProfileCompletion(token) ? '/profile/complete' : '/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (isProfileCompletionPath) {
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (!needsProfileCompletion(token) && pathname === '/profile/complete') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
  }

  if (isPublic) {
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (needsProfileCompletion(token)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Заполните профиль перед продолжением', code: 'PROFILE_INCOMPLETE' },
        { status: 428 }
      )
    }

    const url = new URL('/profile/complete', request.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
