/**
 * File responsibility:
 * Schema-first validation contracts for admin API query/payload parsing.
 *
 * Main logic:
 * - Validate and normalize list query parameters for admin endpoints
 * - Validate import query mode/type flags
 * - Provide inferred types for thin route controllers
 *
 * Integrations:
 * - src/app/api/admin/events/route.ts
 * - src/app/api/admin/import/route.ts
 */

import { z } from "zod"

const trimNullable = (value: unknown) => {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const numericWithDefault = (fallback: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }, z.number().int().min(0))

export const adminEventsQuerySchema = z.object({
  search: z.preprocess(trimNullable, z.string().optional()),
  category: z.preprocess(trimNullable, z.string().optional()),
  upcoming: z.enum(["true", "false"]).optional().nullable(),
  past: z.enum(["true", "false"]).optional().nullable(),
  news: z.enum(["true", "false"]).optional().nullable(),
  limit: numericWithDefault(50),
  offset: numericWithDefault(0),
})

export const adminImportQuerySchema = z.object({
  type: z.enum(["users", "events", "news"]),
  mode: z.enum(["upsert", "create"]).optional().default("upsert"),
})

export type AdminEventsQueryInput = z.infer<typeof adminEventsQuerySchema>
export type AdminImportQueryInput = z.infer<typeof adminImportQuerySchema>

