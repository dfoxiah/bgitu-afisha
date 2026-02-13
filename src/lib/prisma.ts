/**
 * File responsibility:
 * Prisma client singleton bootstrap for server-side database access.
 *
 * Main logic:
 * - Create a single PrismaClient instance for dev/prod.
 * - Prevent duplicate connections during hot reload.
 *
 * Integrations:
 * - Prisma ORM
 * - All server services and API route handlers
 */
// bgitu-afisha/src/lib/prisma.ts

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma