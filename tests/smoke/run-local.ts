/**
 * File responsibility:
 * Local smoke orchestrator that starts the app server and executes smoke suites.
 *
 * Main logic:
 * - Spawn `next start` on configured port
 * - Poll readiness endpoint before running smoke tests
 * - Ensure server shutdown even when tests fail
 *
 * Integrations:
 * - package.json script `test:smoke:local`
 */

import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createConnection, createServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const configuredSmokeBaseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000"
const configuredUrl = new URL(configuredSmokeBaseUrl)
const preferredPort = Number(configuredUrl.port || 3000)
const readinessAttempts = parsePositiveInt(process.env.SMOKE_READINESS_ATTEMPTS, 60)
const readinessIntervalMs = parsePositiveInt(process.env.SMOKE_READINESS_INTERVAL_MS, 1000)
const readinessRequestTimeoutMs = parsePositiveInt(
  process.env.SMOKE_READINESS_REQUEST_TIMEOUT_MS,
  5000
)
const smokeSuitesTimeoutMs = parsePositiveInt(process.env.SMOKE_SUITES_TIMEOUT_MS, 480000)
const seedTimeoutMs = parsePositiveInt(process.env.SMOKE_SEED_TIMEOUT_MS, 240000)
const parseEnvFile = (filePath: string) => {
  if (!existsSync(filePath)) return {} as Record<string, string>

  const values: Record<string, string> = {}
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/g)) {
    const normalized = line.trim()
    if (!normalized || normalized.startsWith("#")) continue

    const separatorIndex = normalized.indexOf("=")
    if (separatorIndex <= 0) continue

    const key = normalized.slice(0, separatorIndex).trim()
    const rawValue = normalized.slice(separatorIndex + 1).trim()
    values[key] = rawValue.replace(/^['"]|['"]$/g, "")
  }

  return values
}
const fileEnv = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
}
const readEnvValue = (key: string, fallback: string) =>
  process.env[key] || fileEnv[key] || fallback
const defaultStudentEmail = "student@bgitu.ru"
const defaultStudentPassword = readEnvValue("STUDENT_SEED_PASSWORD", "student")
const defaultTeacherEmail = readEnvValue("TEACHER_SEED_EMAIL", "MainTeacher2026@bgitu.ru")
const defaultTeacherPassword = readEnvValue("TEACHER_SEED_PASSWORD", "T9mW2pK7sL8xQ4cN")
const defaultAdminEmail =
  readEnvValue("ADMIN_SEED_EMAILS", "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0] || "admin1@bgitu.ru"
const defaultAdminPassword = readEnvValue("ADMIN_SEED_PASSWORD", "R5mQ9tX2sL7pV8cN")

const isPortOccupied = async (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = createConnection({ host, port })
    let settled = false

    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }

    socket.setTimeout(400)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
  })

const resolveListenPort = async (preferred: number) => {
  if (process.env.SMOKE_BASE_URL) {
    return preferred
  }

  const startPort = (await isPortOccupied(configuredUrl.hostname, preferred)) ? 0 : preferred

  return new Promise<number>((resolve, reject) => {
    const tryListen = (port: number, allowFallback: boolean) => {
      const server = createServer()
      server.unref()

      server.once("error", (error) => {
        const code = (error as NodeJS.ErrnoException).code
        if (allowFallback && code === "EADDRINUSE") {
          tryListen(0, false)
          return
        }
        reject(error)
      })

      server.listen(port, "127.0.0.1", () => {
        const address = server.address()
        const resolvedPort =
          typeof address === "object" && address ? address.port : preferred

        server.close((closeError) => {
          if (closeError) {
            reject(closeError)
            return
          }
          resolve(resolvedPort)
        })
      })
    }

    tryListen(startPort, startPort !== 0)
  })
}

const runShellCommand = (command: string) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(command, {
      stdio: "inherit",
      shell: true,
      env: process.env,
    })

    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 1))
  })

const runShellCommandWithTimeout = (
  command: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env
) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(command, {
      stdio: "inherit",
      shell: true,
      env,
    })

    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      console.error(`[smoke-local] timeout ${timeoutMs}ms: ${command}`)
      if (child.pid) {
        void killProcessTree(child.pid)
      }
    }, timeoutMs)

    child.on("error", (error) => {
      clearTimeout(timeoutId)
      reject(error)
    })

    child.on("exit", (code) => {
      clearTimeout(timeoutId)
      if (timedOut) {
        resolve(124)
        return
      }
      resolve(code ?? 1)
    })
  })

const killProcessTree = async (pid: number) => {
  if (process.platform === "win32") {
    await runShellCommand(`taskkill /PID ${pid} /T /F`)
    return
  }

  try {
    process.kill(pid, "SIGTERM")
  } catch {
    return
  }
}

const waitForServer = async (baseUrl: string) => {
  const readinessUrl = `${baseUrl.replace(/\/$/, "")}/api/events/empty`
  let lastStatus: number | null = null
  let lastError: string | null = null

  for (let attempt = 0; attempt < readinessAttempts; attempt += 1) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), readinessRequestTimeoutMs)
      const response = await fetch(readinessUrl, {
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId)
      })

      lastStatus = response.status
      if (response.ok) return
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown error"
    }

    if ((attempt + 1) % 5 === 0) {
      console.log(
        `[smoke-local] waiting for server (${attempt + 1}/${readinessAttempts})`
      )
    }

    await delay(readinessIntervalMs)
  }

  const reason = lastError
    ? `last error: ${lastError}`
    : lastStatus !== null
      ? `last status: ${lastStatus}`
      : "no response"
  throw new Error(`Server did not become ready: ${readinessUrl} (${reason})`)
}

const ensureLocalSeedData = async (env: NodeJS.ProcessEnv) => {
  if (process.env.SMOKE_SKIP_SEED === "true") return

  console.log("[smoke-local] ensuring seeded demo accounts")
  const exitCode = await runShellCommandWithTimeout(
    "npm run db:seed",
    seedTimeoutMs,
    env
  )

  if (exitCode !== 0) {
    throw new Error(`Seed command failed with code ${exitCode}`)
  }
}

const run = async () => {
  const port = await resolveListenPort(preferredPort)
  const smokeBaseUrl =
    process.env.SMOKE_BASE_URL ||
    `${configuredUrl.protocol}//${configuredUrl.hostname}:${port}`
  const childEnv = {
    ...process.env,
    SMOKE_BASE_URL: smokeBaseUrl,
    SMOKE_STUDENT_EMAIL: process.env.SMOKE_STUDENT_EMAIL || defaultStudentEmail,
    SMOKE_STUDENT_PASSWORD: process.env.SMOKE_STUDENT_PASSWORD || defaultStudentPassword,
    SMOKE_TEACHER_EMAIL: process.env.SMOKE_TEACHER_EMAIL || defaultTeacherEmail,
    SMOKE_TEACHER_PASSWORD: process.env.SMOKE_TEACHER_PASSWORD || defaultTeacherPassword,
    SMOKE_ADMIN_EMAIL: process.env.SMOKE_ADMIN_EMAIL || defaultAdminEmail,
    SMOKE_ADMIN_PASSWORD: process.env.SMOKE_ADMIN_PASSWORD || defaultAdminPassword,
  }

  if (!process.env.SMOKE_BASE_URL && port !== preferredPort) {
    console.log(
      `[smoke-local] preferred port ${preferredPort} is busy, using ${port}`
    )
  }

  console.log(`[smoke-local] starting server on port ${port}`)
  console.log(`[smoke-local] suites timeout: ${smokeSuitesTimeoutMs}ms`)

  await ensureLocalSeedData(childEnv)

  const server = spawn(`npm run start -- --port ${port}`, {
    stdio: "inherit",
    shell: true,
    env: childEnv,
  })

  try {
    await waitForServer(smokeBaseUrl)
    console.log("[smoke-local] server is ready, running smoke suites")
    const exitCode = await runShellCommandWithTimeout(
      "npm run test:smoke",
      smokeSuitesTimeoutMs,
      childEnv
    )
    if (exitCode !== 0) {
      throw new Error(`Smoke suites failed with code ${exitCode}`)
    }
    console.log("[smoke-local] success")
  } finally {
    if (!server.killed && server.pid) {
      await killProcessTree(server.pid)
    }
  }
}

run().catch((error) => {
  console.error("[smoke-local] failed:", error)
  process.exitCode = 1
})
