/**
 * File responsibility:
 * Participant/moderator resolution helpers for event commands.
 *
 * Main logic:
 * - Resolve participant/moderator emails into user ids
 * - Return found/missing information for route-level validation
 *
 * Integrations:
 * - app/api/events/route.ts
 * - app/api/events/[id]/route.ts
 */

import { prisma } from "@/lib/prisma"

const toNormalizedEmails = (value: unknown) => {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => String(item).trim())
        .filter((email): email is string => Boolean(email))
    )
  )
}

export const resolveParticipantUsers = async (rawEmails: unknown) => {
  const emails = toNormalizedEmails(rawEmails)
  if (emails.length === 0) {
    return {
      users: [] as Array<{ id: string; email: string }>,
      missingEmails: [] as string[],
    }
  }

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })

  const found = new Set(users.map((user) => user.email))
  const missingEmails = emails.filter((email) => !found.has(email))

  return { users, missingEmails }
}

export const resolveModerators = async (rawEmails: unknown, creatorId?: string) => {
  const emails = toNormalizedEmails(rawEmails)
  if (emails.length === 0) {
    return {
      users: [] as Array<{ id: string; email: string }>,
      missingEmails: [] as string[],
    }
  }

  const users = await prisma.user.findMany({
    where: {
      email: { in: emails },
      role: { in: ["TEACHER", "ADMIN"] },
    },
    select: { id: true, email: true },
  })

  const found = new Set(users.map((user) => user.email))
  const missingEmails = emails.filter((email) => !found.has(email))
  const filteredUsers = creatorId ? users.filter((user) => user.id !== creatorId) : users

  return { users: filteredUsers, missingEmails }
}

