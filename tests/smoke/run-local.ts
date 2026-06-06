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
import { setTimeout as delay } from "node:timers/promises"

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const smokeBaseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000"
const url = new URL(smokeBaseUrl)
const port = Number(url.port || 3000)
const readinessAttempts = parsePositiveInt(process.env.SMOKE_READINESS_ATTEMPTS, 60)
const readinessIntervalMs = parsePositiveInt(process.env.SMOKE_READINESS_INTERVAL_MS, 1000)
const readinessRequestTimeoutMs = parsePositiveInt(
  process.env.SMOKE_READINESS_REQUEST_TIMEOUT_MS,
  5000
)
const smokeSuitesTimeoutMs = parsePositiveInt(process.env.SMOKE_SUITES_TIMEOUT_MS, 480000)

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

const runShellCommandWithTimeout = (command: string, timeoutMs: number) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(command, {
      stdio: "inherit",
      shell: true,
      env: process.env,
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

const run = async () => {
  console.log(`[smoke-local] starting server on port ${port}`)
  console.log(`[smoke-local] suites timeout: ${smokeSuitesTimeoutMs}ms`)

  const server = spawn(`npm run start -- --port ${port}`, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  })

  try {
    await waitForServer(smokeBaseUrl)
    console.log("[smoke-local] server is ready, running smoke suites")
    const exitCode = await runShellCommandWithTimeout(
      "npm run test:smoke",
      smokeSuitesTimeoutMs
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
