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

const jsonRequest = async (
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  jar: CookieJar,
  label?: string
) =>
  fetchWithJar(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    jar,
    label
  )

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
      "/api/admin/events?limit=5",
      {},
      adminJar,
      "GET /api/admin/events?limit=5"
    )
    assert.equal(adminEventsResponse.status, 200, "Admin events endpoint must return 200")

    const diagnosticsResponse = await fetchWithJar(
      "/api/admin/diagnostics",
      {},
      adminJar,
      "GET /api/admin/diagnostics"
    )
    assert.equal(diagnosticsResponse.status, 200, "Admin diagnostics endpoint must return 200")

    const structureResponse = await fetchWithJar(
      "/api/admin/structure",
      {},
      adminJar,
      "GET /api/admin/structure"
    )
    assert.equal(structureResponse.status, 200, "Admin structure endpoint must return 200")

    const groupPromotionPreviewResponse = await jsonRequest(
      "/api/admin/structure",
      "POST",
      { dryRun: true },
      adminJar,
      "POST /api/admin/structure (dry-run)"
    )
    assert.equal(
      groupPromotionPreviewResponse.status,
      200,
      "Admin structure dry-run must return 200"
    )

    const importHistoryResponse = await fetchWithJar(
      "/api/admin/import",
      {},
      adminJar,
      "GET /api/admin/import"
    )
    assert.equal(importHistoryResponse.status, 200, "Admin import history endpoint must return 200")

    const importTemplateResponse = await fetchWithJar(
      "/api/admin/import?template=users",
      {},
      adminJar,
      "GET /api/admin/import?template=users"
    )
    assert.equal(importTemplateResponse.status, 200, "Admin import template endpoint must return 200")
    assert.ok(
      (importTemplateResponse.headers.get("content-type") || "").includes("text/csv"),
      "Admin import template must return CSV content-type"
    )

    const newsTemplatesResponse = await fetchWithJar(
      "/api/news-templates",
      {},
      adminJar,
      "GET /api/news-templates"
    )
    assert.equal(newsTemplatesResponse.status, 200, "News templates endpoint must return 200 for admin")

    let createdUserId: string | null = null
    try {
      const tempUserEmail = `smoke.user.${Date.now()}@bgitu.ru`
      const createUserResponse = await jsonRequest(
        "/api/admin/users",
        "POST",
        {
          name: "Smoke User",
          email: tempUserEmail,
          password: "smoke123",
          role: "STUDENT",
          department: "ФИТ",
          group: "СМ-01",
          admissionYear: 2024,
        },
        adminJar,
        "POST /api/admin/users"
      )
      assert.equal(createUserResponse.status, 201, "Admin user create must return 201")
      const createdUser = (await createUserResponse.json()) as { id: string }
      assert.ok(createdUser.id, "Created admin user must have id")
      createdUserId = createdUser.id

      const updateUserResponse = await jsonRequest(
        `/api/admin/users/${createdUserId}`,
        "PUT",
        {
          name: "Smoke User Updated",
          department: "ФИТ / smoke",
          groupChangeCount: 0,
        },
        adminJar,
        "PUT /api/admin/users/:id"
      )
      assert.equal(updateUserResponse.status, 200, "Admin user update must return 200")
    } finally {
      if (createdUserId) {
        const deleteUserResponse = await fetchWithJar(
          `/api/admin/users/${createdUserId}`,
          { method: "DELETE" },
          adminJar,
          "DELETE /api/admin/users/:id"
        )
        assert.equal(deleteUserResponse.status, 200, "Admin user delete must return 200")
      }
    }

    let createdTemplateId: string | null = null
    try {
      const createTemplateResponse = await jsonRequest(
        "/api/news-templates",
        "POST",
        {
          name: `Smoke template ${Date.now()}`,
          description: "Smoke validation template",
          body: "Новость о {{event.title}} на {{event.date}}",
        },
        adminJar,
        "POST /api/news-templates"
      )
      assert.equal(createTemplateResponse.status, 201, "News template create must return 201")
      const createdTemplate = (await createTemplateResponse.json()) as { id: string }
      assert.ok(createdTemplate.id, "Created news template must have id")
      createdTemplateId = createdTemplate.id

      const updateTemplateResponse = await jsonRequest(
        `/api/news-templates/${createdTemplateId}`,
        "PUT",
        {
          name: "Smoke template updated",
          description: "Updated by smoke",
          body: "Обновленная новость о {{event.title}}",
        },
        adminJar,
        "PUT /api/news-templates/:id"
      )
      assert.equal(updateTemplateResponse.status, 200, "News template update must return 200")
    } finally {
      if (createdTemplateId) {
        const deleteTemplateResponse = await fetchWithJar(
          `/api/news-templates/${createdTemplateId}`,
          { method: "DELETE" },
          adminJar,
          "DELETE /api/news-templates/:id"
        )
        assert.equal(deleteTemplateResponse.status, 200, "News template delete must return 200")
      }
    }

    const adminEvents = (await adminEventsResponse.json()) as Array<{
      id: string
      isPast?: boolean
      title?: string
    }>
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

      const preferredSeedEventTitles = new Set([
        "День открытых дверей БГИТУ",
        "Концерт ко Дню студента",
      ])
      const eventCandidates = [
        ...adminEvents.filter(
          (event) =>
            event.isPast !== true &&
            Boolean(event.title && preferredSeedEventTitles.has(event.title))
        ),
        ...adminEvents.filter((event) => event.isPast !== true),
      ]

      let broadcastPayload: { broadcastId?: string } | null = null
      let lastBroadcastError = "No upcoming events available"

      for (const event of eventCandidates) {
        const broadcastResponse = await jsonRequest(
          "/api/notifications",
          "POST",
          {
            eventId: event.id,
            content: "Smoke: мероприятие [Название] запланировано на [Дата] [Время].",
            audience: "users",
            recipients: "all",
            departments: ["ФИТ"],
            groups: [],
            userIds: [],
            type: "EVENT",
          },
          adminJar,
          `POST /api/notifications (broadcast ${event.id})`
        )

        if (broadcastResponse.status === 200) {
          broadcastPayload = (await broadcastResponse.json()) as {
            broadcastId?: string
          }
          break
        }

        try {
          const errorPayload = (await broadcastResponse.json()) as {
            error?: string
            message?: string
          }
          lastBroadcastError = errorPayload.error || errorPayload.message || `status ${broadcastResponse.status}`
        } catch {
          lastBroadcastError = `status ${broadcastResponse.status}`
        }
      }

      assert.ok(
        broadcastPayload,
        `Notification broadcast endpoint must return 200 for at least one event (${lastBroadcastError})`
      )
      assert.ok(broadcastPayload.broadcastId, "Broadcast response must include broadcastId")

      const cancelBroadcastResponse = await fetchWithJar(
        `/api/notifications/broadcast/${broadcastPayload.broadcastId}`,
        { method: "DELETE" },
        adminJar,
        "DELETE /api/notifications/broadcast/:broadcastId"
      )
      assert.equal(
        cancelBroadcastResponse.status,
        200,
        "Notification broadcast cancel endpoint must return 200"
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
