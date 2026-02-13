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

const STATIC_FILE_PATTERN = /\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$/i
const PUBLIC_PATHS = ['/login', '/register', '/api/auth']

const isPublicPath = (pathname: string) => {
  if (pathname.startsWith('/_next') || pathname.startsWith('/public')) return true
  if (STATIC_FILE_PATTERN.test(pathname)) return true

  return PUBLIC_PATHS.some(base => pathname === base || pathname.startsWith(`${base}/`))
}

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_MIDDLEWARE === 'true') {
    console.log(...args)
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (pathname === '/favicon.ico') {
    return NextResponse.redirect(new URL('/favicon.svg', request.url))
  }

  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isPublic = isPublicPath(pathname)

  let token = null
  if (isAdminPath || isAuthPage || !isPublic) {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })
    debug('Middleware - token:', { pathname, hasToken: !!token })
  }

  if (isAdminPath) {
    if (!token || token.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  if (isAuthPage) {
    if (token) {
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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
