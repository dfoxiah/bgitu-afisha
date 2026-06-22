import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ADMIN_SIMULATION_SCENARIOS } from "@/features/admin/simulation-catalog"
import type { AdminSimulationScenarioId } from "@/features/admin/types"
import { ensureAdminSession } from "@/server/admin/admin-session"
import { runAdminDiagnosticsSimulation } from "@/server/admin/admin-diagnostics-simulation"
import { errorJson } from "@/server/shared/http-response"

export const dynamic = "force-dynamic"

const knownScenarioIds = new Set<string>(ADMIN_SIMULATION_SCENARIOS.map((scenario) => scenario.id))

const isSimulationScenarioId = (value: string): value is AdminSimulationScenarioId =>
  knownScenarioIds.has(value)

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!ensureAdminSession(session)) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  let payload: { scenario?: string } = {}
  try {
    payload = (await request.json()) as { scenario?: string }
  } catch {
    payload = {}
  }

  const rawScenario = typeof payload.scenario === "string" ? payload.scenario : "all"
  if (rawScenario !== "all" && !isSimulationScenarioId(rawScenario)) {
    return errorJson(400, "BAD_REQUEST", "Неизвестный сценарий симуляции")
  }

  const result = await runAdminDiagnosticsSimulation(rawScenario)
  return Response.json(result)
}
