/**
 * File responsibility:
 * Schema-first validation contracts for events API route handlers.
 *
 * Main logic:
 * - Define create/update payload schemas shared by routes/services
 * - Normalize primitive values (trim strings, coerce numbers/booleans)
 * - Export inferred TypeScript types to remove duplicate manual parsing
 *
 * Integrations:
 * - src/app/api/events/route.ts
 * - src/app/api/events/[id]/route.ts
 */

import { z } from "zod"

const trimString = (value: unknown) => (typeof value === "string" ? value.trim() : value)

const nonEmptyString = z.preprocess(trimString, z.string().min(1))
const optionalTrimmedString = z.preprocess(trimString, z.string().min(1).optional())

const numericOptional = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}, z.number().int().min(0).optional())

const stringArrayOptional = z.preprocess(
  (value) => (Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : value),
  z.array(z.string()).optional()
)

const booleanWithDefaultFalse = z.preprocess((value) => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "true" || normalized === "1" || normalized === "yes"
  }
  return false
}, z.boolean())

export const createEventBodySchema = z.object({
  title: nonEmptyString,
  category: nonEmptyString,
  date: nonEmptyString,
  time: optionalTrimmedString,
  duration: optionalTrimmedString,
  location: nonEmptyString,
  description: nonEmptyString,
  maxParticipants: numericOptional,
  participants: stringArrayOptional,
  moderators: stringArrayOptional,
  images: stringArrayOptional,
  responsible: optionalTrimmedString,
  responsibleId: optionalTrimmedString,
  contact: optionalTrimmedString,
  isNews: booleanWithDefaultFalse.optional().default(false),
})

export const updateEventBodySchema = z
  .object({
    title: optionalTrimmedString,
    category: optionalTrimmedString,
    date: optionalTrimmedString,
    time: optionalTrimmedString,
    duration: optionalTrimmedString,
    location: optionalTrimmedString,
    description: optionalTrimmedString,
    maxParticipants: numericOptional,
    participants: stringArrayOptional,
    moderators: stringArrayOptional,
    images: stringArrayOptional,
    responsible: optionalTrimmedString,
    responsibleId: optionalTrimmedString,
    contact: optionalTrimmedString,
  })
  .strict()

export type CreateEventBodyInput = z.infer<typeof createEventBodySchema>
export type UpdateEventBodyInput = z.infer<typeof updateEventBodySchema>
