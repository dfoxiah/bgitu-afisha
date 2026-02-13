/**
 * File responsibility:
 * Shared helpers for building compact audit metadata diffs.
 *
 * Main logic:
 * - Normalize values to audit-safe JSON-compatible representation
 * - Build before/after field diff map for selected fields
 *
 * Integrations:
 * - Event update/admin update audit logging
 */

const normalizeArrayItem = (value: unknown): string | number | boolean | null => {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  return String(value)
}

export const toAuditValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString()

  if (Array.isArray(value)) {
    return value.map(normalizeArrayItem)
  }

  if (value === null || value === undefined) return null

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

export const buildFieldChanges = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
) => {
  const changes: Record<string, { before: unknown; after: unknown }> = {}

  fields.forEach((field) => {
    const beforeValue = toAuditValue(before[field])
    const afterValue = toAuditValue(after[field])
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[field] = { before: beforeValue, after: afterValue }
    }
  })

  return changes
}

