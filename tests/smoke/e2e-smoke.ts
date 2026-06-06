/**
 * File responsibility:
 * End-to-end HTTP smoke runner for key user flows.
 *
 * Main logic:
 * - Validate page-level flows: login -> dashboard -> events -> event details
 * - Validate profile persistence and optional admin navigation flows
 *
 * Integrations:
 * - package.json scripts: test:smoke:e2e
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

const cookieHeader = (jar: CookieJar) =>
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
    headers.set("cookie", cookieHeader(jar))
  }

  const requestLabel = label || `${init.method || "GET"} ${path}`
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs)

  console.log(`[e2e-smoke] -> ${requestLabel}`)
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
        `[e2e-smoke] timeout ${requestTimeoutMs}ms: ${requestLabel}`
      )
    }
    throw new Error(
      `[e2e-smoke] request failed: ${requestLabel} (${error instanceof Error ? error.message : "unknown error"})`
    )
  } finally {
    clearTimeout(timeoutId)
  }

  console.log(
    `[e2e-smoke] <- ${requestLabel} ${response.status} (${Date.now() - startedAt}ms)`
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

const login = async ({ email, password }: Credentials) => {
  const jar: CookieJar = new Map()

  const csrfResponse = await fetchWithJar("/api/auth/csrf", {}, jar, "GET /api/auth/csrf")
  assert.equal(csrfResponse.status, 200, "CSRF endpoint must return 200")

  const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string }
  assert.ok(csrfPayload.csrfToken, "CSRF token is required")

  const form = new URLSearchParams()
  form.set("csrfToken", csrfPayload.csrfToken!)
  form.set("email", email)
  form.set("password", password)
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
  assert.equal(loginResponse.status, 200, "Credentials login must return 200")

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

const ensurePage = async (path: string, jar: CookieJar) => {
  const response = await fetchWithJar(path, {}, jar, `GET ${path}`)
  assert.equal(response.status, 200, `Page ${path} must return 200`)
}

const run = async () => {
  console.log(`[e2e-smoke] base: ${baseUrl}`)
  console.log(`[e2e-smoke] request timeout: ${requestTimeoutMs}ms`)

  const studentCredentials = readCredentials("SMOKE_STUDENT")
  if (!studentCredentials) {
    logSkip("SMOKE_STUDENT_EMAIL/SMOKE_STUDENT_PASSWORD are not set")
  } else {
    console.log("[e2e-smoke] step: student page flow")
    const studentJar = await login(studentCredentials)

    await ensurePage("/dashboard", studentJar)
    await ensurePage("/events", studentJar)
    await ensurePage("/profile", studentJar)
    await ensurePage("/notifications", studentJar)

    const eventsResponse = await fetchWithJar(
      "/api/events?limit=1",
      {},
      studentJar,
      "GET /api/events?limit=1 (student)"
    )
    assert.equal(eventsResponse.status, 200, "Events API must return 200 for authenticated user")
    const events = (await eventsResponse.json()) as Array<{ id: string }>
    if (events.length > 0) {
      await ensurePage(`/events/${events[0].id}`, studentJar)
    }
  }

  const adminCredentials = readCredentials("SMOKE_ADMIN")
  if (!adminCredentials) {
    logSkip("SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD are not set")
  } else {
    console.log("[e2e-smoke] step: admin page flow")
    const adminJar = await login(adminCredentials)
    await ensurePage("/admin", adminJar)
  }

  console.log("[e2e-smoke] success")
}

run().catch((error) => {
  console.error("[e2e-smoke] failed:", error)
  process.exitCode = 1
})
