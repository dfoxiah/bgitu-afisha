/**
 * File responsibility:
 * API smoke runner for critical backend routes.
 *
 * Main logic:
 * - Authenticate by credentials (if env vars provided)
 * - Validate essential API routes for auth/events/notifications/admin/profile
 *
 * Integrations:
 * - package.json scripts: test:smoke:api
 */

import { strict as assert } from "node:assert"

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000"
const strictMode = process.env.SMOKE_STRICT === "true"

type Credentials = {
  email: string
  password: string
}

type CookieJar = Map<string, string>

const parseSetCookie = (cookie: string) => {
  const first = cookie.split(";")[0]
  const index = first.indexOf("=")
  if (index <= 0) return null
  return { name: first.slice(0, index), value: first.slice(index + 1) }
}

const buildCookieHeader = (jar: CookieJar) =>
  Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")

const fetchWithJar = async (path: string, init: RequestInit = {}, jar?: CookieJar) => {
  const headers = new Headers(init.headers || {})
  if (jar && jar.size > 0) {
    headers.set("cookie", buildCookieHeader(jar))
  }

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" })
  const setCookie = response.headers.getSetCookie()
  if (jar) {
    setCookie.forEach((value) => {
      const parsed = parseSetCookie(value)
      if (parsed) jar.set(parsed.name, parsed.value)
    })
  }

  return response
}

const login = async (credentials: Credentials) => {
  const jar: CookieJar = new Map()

  const csrfResponse = await fetchWithJar("/api/auth/csrf", {}, jar)
  assert.equal(csrfResponse.status, 200, "CSRF endpoint must return 200")

  const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string }
  assert.ok(csrfPayload.csrfToken, "CSRF token must exist")

  const form = new URLSearchParams()
  form.set("csrfToken", csrfPayload.csrfToken!)
  form.set("email", credentials.email)
  form.set("password", credentials.password)
  form.set("callbackUrl", `${baseUrl}/dashboard`)
  form.set("json", "true")

  const loginResponse = await fetchWithJar(
    "/api/auth/callback/credentials",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
    jar
  )

  assert.equal(loginResponse.status, 200, "Login callback must return 200")
  return jar
}

const readCredentials = (prefix: string): Credentials | null => {
  const email = process.env[`${prefix}_EMAIL`]
  const password = process.env[`${prefix}_PASSWORD`]
  if (!email || !password) return null
  return { email, password }
}

const logSkip = (message: string) => {
  if (strictMode) throw new Error(message)
  console.log(`[skip] ${message}`)
}

const run = async () => {
  console.log(`[api-smoke] base: ${baseUrl}`)

  const publicEvents = await fetchWithJar("/api/events?limit=5")
  assert.ok(
    [200, 307, 401].includes(publicEvents.status),
    `Public events endpoint must return 200/307/401, got ${publicEvents.status}`
  )
  if (publicEvents.status !== 200) {
    const location = publicEvents.headers.get("location")
    console.log(`[api-smoke] public /api/events is protected (${publicEvents.status}${location ? ` -> ${location}` : ""})`)
  }

  const studentCredentials = readCredentials("SMOKE_STUDENT")
  if (!studentCredentials) {
    logSkip("SMOKE_STUDENT_EMAIL/SMOKE_STUDENT_PASSWORD are not set")
  } else {
    const studentJar = await login(studentCredentials)

    const studentEventsResponse = await fetchWithJar("/api/events?limit=5", {}, studentJar)
    assert.equal(studentEventsResponse.status, 200, "Events API must return 200 for authenticated student")

    const profileResponse = await fetchWithJar("/api/auth/profile", {}, studentJar)
    assert.equal(profileResponse.status, 200, "Student profile must be available after login")

    const notificationsResponse = await fetchWithJar("/api/notifications", {}, studentJar)
    assert.equal(notificationsResponse.status, 200, "Student notifications list must be available")
  }

  const adminCredentials = readCredentials("SMOKE_ADMIN")
  if (!adminCredentials) {
    logSkip("SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD are not set")
  } else {
    const adminJar = await login(adminCredentials)

    const adminUsersResponse = await fetchWithJar("/api/admin/users?limit=5", {}, adminJar)
    assert.equal(adminUsersResponse.status, 200, "Admin users endpoint must return 200")

    const adminLogsResponse = await fetchWithJar("/api/admin/logs?limit=5", {}, adminJar)
    assert.equal(adminLogsResponse.status, 200, "Admin logs endpoint must return 200")
  }

  console.log("[api-smoke] success")
}

run().catch((error) => {
  console.error("[api-smoke] failed:", error)
  process.exitCode = 1
})
