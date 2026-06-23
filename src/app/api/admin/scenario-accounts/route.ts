/**
 * File responsibility:
 * Admin scenario account bootstrap/list endpoint.
 *
 * Main logic:
 * - GET: list current admin-owned role personas
 * - POST: create or repair missing personas for all roles
 *
 * Integrations:
 * - src/app/admin/page.tsx
 * - src/components/layout/Header.tsx
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildAuditMeta, logAuditEvent } from "@/lib/audit"
import {
  ensureScenarioAccountsForOwner,
  getScenarioAccountsForOwner,
} from "@/server/admin/scenario-accounts-service"
import { resolveScenarioAdminOwnerId } from "@/server/admin/admin-session"
import { errorJson } from "@/server/shared/http-response"

export async function GET() {
  const session = await getServerSession(authOptions)
  const ownerId = resolveScenarioAdminOwnerId(session)
  if (!ownerId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const accounts = await getScenarioAccountsForOwner(ownerId)
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const ownerId = resolveScenarioAdminOwnerId(session)
  if (!ownerId) {
    return errorJson(403, "FORBIDDEN", "Недостаточно прав")
  }

  const accounts = await ensureScenarioAccountsForOwner(ownerId)

  const { ip, userAgent } = buildAuditMeta(req)
  await logAuditEvent({
    actorId: ownerId,
    action: "ADMIN_SCENARIO_ACCOUNTS_SYNC",
    entityType: "User",
    entityId: ownerId,
    metadata: {
      createdOrVerified: accounts.length,
    },
    ip,
    userAgent,
  })

  return NextResponse.json(accounts, { status: 201 })
}
