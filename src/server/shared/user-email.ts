import type { Prisma } from "@prisma/client"

export const normalizeEmailAddress = (value: unknown) =>
  String(value ?? "").trim().toLowerCase()

export const normalizeEmailList = (values: unknown[]) =>
  Array.from(new Set(values.map((value) => normalizeEmailAddress(value)).filter(Boolean)))

export const buildEmailInsensitiveFilter = (email: string): Prisma.UserWhereInput => ({
  email: {
    equals: normalizeEmailAddress(email),
    mode: "insensitive",
  },
})

export const buildEmailInsensitiveFilters = (emails: string[]) =>
  normalizeEmailList(emails).map((email) => buildEmailInsensitiveFilter(email))
