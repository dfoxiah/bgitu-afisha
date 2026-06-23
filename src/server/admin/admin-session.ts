/**
 * File responsibility:
 * Shared admin auth guards and helpers for admin API routes.
 *
 * Main logic:
 * - Validate admin-only session access
 * - Keep a single reusable admin id extractor
 *
 * Integrations:
 * - src/app/api/admin/*
 */

import type { SessionLike } from "@/server/shared/session"
import { hasSessionUser, isAdminSession } from "@/server/shared/session"

export const ensureAdminSession = (session: SessionLike) => {
  if (!isAdminSession(session) || !hasSessionUser(session)) return null
  return session.user.id
}

export const resolveScenarioAdminOwnerId = (session: SessionLike) => {
  if (!hasSessionUser(session)) return null
  if (isAdminSession(session)) return session.user.id
  if (typeof session.user.impersonatorId === "string" && session.user.impersonatorId) {
    return session.user.impersonatorId
  }
  return null
}
