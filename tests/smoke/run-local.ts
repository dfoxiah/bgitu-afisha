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

const smokeBaseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000"
const url = new URL(smokeBaseUrl)
const port = Number(url.port || 3000)
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
  const readinessUrl = `${baseUrl.replace(/\/$/, "")}/api/test`
  const attempts = 60

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(readinessUrl, { cache: "no-store" })
      if (response.ok) return
    } catch {
      // ignore until ready
    }
    await delay(1000)
  }

  throw new Error(`Server did not become ready: ${readinessUrl}`)
}

const run = async () => {
  console.log(`[smoke-local] starting server on port ${port}`)

  const server = spawn(`npm run start -- --port ${port}`, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  })

  try {
    await waitForServer(smokeBaseUrl)
    console.log("[smoke-local] server is ready, running smoke suites")
    const exitCode = await runShellCommand("npm run test:smoke")
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
