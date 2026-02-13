/**
 * File responsibility:
 * Audit logging helpers shared by API and domain services.
 *
 * Main logic:
 * - Build normalized audit payloads.
 * - Persist action metadata in audit log storage.
 *
 * Integrations:
 * - Prisma AuditLog model
 * - src/server/* and src/app/api/* routes
 */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AuditPayload = {
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
  userAgent?: string | null
}

const getIpFromRequest = (req?: NextRequest) => {
  if (!req) return null
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null
  }
  return req.headers.get('x-real-ip') || null
}

export const buildAuditMeta = (req?: NextRequest) => ({
  ip: getIpFromRequest(req),
  userAgent: req?.headers.get('user-agent') || null
})

export async function logAuditEvent(payload: AuditPayload) {
  try {
    const metadata =
      payload.metadata === null
        ? Prisma.JsonNull
        : payload.metadata ?? undefined

    await prisma.auditLog.create({
      data: {
        actorId: payload.actorId || null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId || null,
        metadata: metadata as Prisma.InputJsonValue | undefined,
        ip: payload.ip || null,
        userAgent: payload.userAgent || null
      }
    })
  } catch (error) {
    // Аудит не должен ломать основной запрос
    console.error('Audit log error:', error)
  }
}
