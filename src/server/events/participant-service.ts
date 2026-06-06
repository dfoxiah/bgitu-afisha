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
import { Role, type Prisma } from "@prisma/client"

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

const toNormalizedGroups = (value: unknown) => {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => String(item).trim())
        .filter((group): group is string => Boolean(group))
    )
  )
}

export const resolveParticipantUsers = async (rawEmails: unknown, rawGroups: unknown = []) => {
  const emails = toNormalizedEmails(rawEmails)
  const groups = toNormalizedGroups(rawGroups)
  if (emails.length === 0 && groups.length === 0) {
    return {
      users: [] as Array<{ id: string; email: string; group?: string | null }>,
      missingEmails: [] as string[],
      missingGroups: [] as string[],
    }
  }

  const or: Prisma.UserWhereInput[] = []
  if (emails.length > 0) or.push({ email: { in: emails } })
  if (groups.length > 0) or.push({ group: { in: groups } })

  const users = await prisma.user.findMany({
    where: { OR: or },
    select: { id: true, email: true, group: true },
  })

  const found = new Set(users.map((user) => user.email))
  const missingEmails = emails.filter((email) => !found.has(email))
  const foundGroups = new Set(users.map((user) => user.group).filter((group): group is string => Boolean(group)))
  const missingGroups = groups.filter((group) => !foundGroups.has(group))

  return { users, missingEmails, missingGroups }
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
      role: { in: [Role.TEACHER, Role.EDITOR, Role.ADMIN] },
    },
    select: { id: true, email: true },
  })

  const found = new Set(users.map((user) => user.email))
  const missingEmails = emails.filter((email) => !found.has(email))
  const filteredUsers = creatorId ? users.filter((user) => user.id !== creatorId) : users

  return { users: filteredUsers, missingEmails }
}
