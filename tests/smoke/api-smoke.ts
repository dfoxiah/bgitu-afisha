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

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000"
const strictMode = process.env.SMOKE_STRICT === "true"
const requestTimeoutMs = parsePositiveInt(process.env.SMOKE_REQUEST_TIMEOUT_MS, 15000)

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

const fetchWithJar = async (
  path: string,
  init: RequestInit = {},
  jar?: CookieJar,
  label?: string
) => {
  const headers = new Headers(init.headers || {})
  if (jar && jar.size > 0) {
    headers.set("cookie", buildCookieHeader(jar))
  }

  const requestLabel = label || `${init.method || "GET"} ${path}`
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs)

  console.log(`[api-smoke] -> ${requestLabel}`)
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      redirect: "manual",
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `[api-smoke] timeout ${requestTimeoutMs}ms: ${requestLabel}`
      )
    }
    throw new Error(
      `[api-smoke] request failed: ${requestLabel} (${error instanceof Error ? error.message : "unknown error"})`
    )
  } finally {
    clearTimeout(timeoutId)
  }

  console.log(
    `[api-smoke] <- ${requestLabel} ${response.status} (${Date.now() - startedAt}ms)`
  )

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

  const csrfResponse = await fetchWithJar("/api/auth/csrf", {}, jar, "GET /api/auth/csrf")
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
    jar,
    "POST /api/auth/callback/credentials"
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
  console.log(`[api-smoke] request timeout: ${requestTimeoutMs}ms`)

  console.log("[api-smoke] step: public endpoints")
  const publicEvents = await fetchWithJar(
    "/api/events?limit=5",
    {},
    undefined,
    "GET /api/events?limit=5 (public)"
  )
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
    console.log("[api-smoke] step: student authenticated endpoints")
    const studentJar = await login(studentCredentials)

    const studentEventsResponse = await fetchWithJar(
      "/api/events?limit=5",
      {},
      studentJar,
      "GET /api/events?limit=5 (student)"
    )
    assert.equal(studentEventsResponse.status, 200, "Events API must return 200 for authenticated student")

    const profileResponse = await fetchWithJar(
      "/api/auth/profile",
      {},
      studentJar,
      "GET /api/auth/profile (student)"
    )
    assert.equal(profileResponse.status, 200, "Student profile must be available after login")

    const notificationsResponse = await fetchWithJar(
      "/api/notifications",
      {},
      studentJar,
      "GET /api/notifications (student)"
    )
    assert.equal(notificationsResponse.status, 200, "Student notifications list must be available")
  }

  const adminCredentials = readCredentials("SMOKE_ADMIN")
  if (!adminCredentials) {
    logSkip("SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD are not set")
  } else {
    console.log("[api-smoke] step: admin endpoints")
    const adminJar = await login(adminCredentials)

    const adminUsersResponse = await fetchWithJar(
      "/api/admin/users?limit=5",
      {},
      adminJar,
      "GET /api/admin/users?limit=5"
    )
    assert.equal(adminUsersResponse.status, 200, "Admin users endpoint must return 200")

    const adminLogsResponse = await fetchWithJar(
      "/api/admin/logs?limit=5",
      {},
      adminJar,
      "GET /api/admin/logs?limit=5"
    )
    assert.equal(adminLogsResponse.status, 200, "Admin logs endpoint must return 200")

    const adminMetricsResponse = await fetchWithJar(
      "/api/admin/metrics",
      {},
      adminJar,
      "GET /api/admin/metrics"
    )
    assert.equal(adminMetricsResponse.status, 200, "Admin metrics endpoint must return 200")

    const adminEventsResponse = await fetchWithJar(
      "/api/admin/events?limit=1",
      {},
      adminJar,
      "GET /api/admin/events?limit=1"
    )
    assert.equal(adminEventsResponse.status, 200, "Admin events endpoint must return 200")

    const adminEvents = (await adminEventsResponse.json()) as Array<{ id: string }>
    if (adminEvents.length > 0) {
      const exportResponse = await fetchWithJar(
        `/api/admin/events/${adminEvents[0].id}/export`,
        {},
        adminJar,
        "GET /api/admin/events/:id/export"
      )
      assert.equal(exportResponse.status, 200, "Admin event export endpoint must return 200")
      const contentType = exportResponse.headers.get("content-type") || ""
      assert.ok(
        contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "Admin event export must return XLSX content-type"
      )
    } else {
      logSkip("No admin events available to validate export endpoint")
    }
  }

  console.log("[api-smoke] success")
}

run().catch((error) => {
  console.error("[api-smoke] failed:", error)
  process.exitCode = 1
})
