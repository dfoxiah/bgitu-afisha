/**
 * File responsibility:
 * Event query operations used by API controllers.
 *
 * Main logic:
 * - Build list filters and fetch event collections/details with relations
 * - Keep Prisma include/select definitions centralized
 *
 * Integrations:
 * - app/api/events/route.ts
 * - app/api/events/[id]/route.ts
 */

import { prisma } from "@/lib/prisma"
import { ParticipantStatus } from "@prisma/client"
import type { EventCategory, Prisma } from "@prisma/client"

type EventListParams = {
  category?: string | null
  search?: string | null
  upcoming?: string | null
  past?: string | null
  limit?: number
  includePastForAuthorized: boolean
  publicOnly?: boolean
}

type EventListFetchOptions = {
  viewerId?: string | null
}

export const buildEventListWhere = (params: EventListParams): Prisma.EventWhereInput => {
  const where: Prisma.EventWhereInput = { removedFromCalendar: false }

  if (params.publicOnly) {
    where.isPublic = true
  }

  if (params.category) {
    where.category = params.category as EventCategory
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
      { location: { contains: params.search, mode: "insensitive" } },
      { responsible: { contains: params.search, mode: "insensitive" } },
    ]
  }

  const now = new Date()
  if (params.upcoming === "true") {
    where.isPast = false
    where.date = { gte: now }
  } else if (params.past === "true") {
    where.isPast = true
  } else if (!params.includePastForAuthorized) {
    where.isPast = false
    where.date = { gte: now }
  }

  return where
}

export const findEventsForList = (
  where: Prisma.EventWhereInput,
  limit?: number,
  options?: EventListFetchOptions
) => {
  const viewerId = options?.viewerId || null
  const participantWhere: Prisma.EventParticipantWhereInput = viewerId
    ? {
        OR: [{ status: ParticipantStatus.PENDING }, { userId: viewerId }],
      }
    : { status: ParticipantStatus.PENDING }

  return prisma.event.findMany({
    where,
    include: {
      report: {
        select: {
          id: true,
          summary: true,
          tasks: true,
          comment: true,
          reportDate: true,
          activeParticipants: true,
          images: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      eventParticipants: {
        where: participantWhere,
        select: {
          status: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              group: true,
              image: true,
            },
          },
        },
      },
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          group: true,
          image: true,
        },
      },
      moderators: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              group: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "asc" }],
    take: limit,
  })
}

export const findEventByIdForRead = (id: string) =>
  prisma.event.findUnique({
    where: { id },
    include: {
      report: true,
      eventParticipants: {
        select: {
          status: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              group: true,
              image: true,
              createdAt: true,
            },
          },
        },
      },
      creator: true,
      moderators: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              group: true,
              image: true,
            },
          },
        },
      },
    },
  })

export const findEventByIdForEdit = (eventId: string) =>
  prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      duration: true,
      responsible: true,
      contact: true,
      category: true,
      creatorId: true,
      date: true,
      time: true,
      maxParticipants: true,
      currentParticipants: true,
      requiresApproval: true,
      isNews: true,
      removedFromCalendar: true,
      images: true,
      eventParticipants: {
        select: {
          userId: true,
          status: true,
          user: { select: { email: true } },
        },
      },
      moderators: {
        select: {
          userId: true,
          user: { select: { email: true } },
        },
      },
    },
  })
