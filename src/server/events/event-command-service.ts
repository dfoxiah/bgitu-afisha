/**
 * File responsibility:
 * Event mutation operations used by API controllers.
 *
 * Main logic:
 * - Create/update event aggregates with participant/moderator relations
 * - Keep transaction boundaries in one place
 *
 * Integrations:
 * - app/api/events/route.ts
 * - app/api/events/[id]/route.ts
 */

import { prisma } from "@/lib/prisma"
import { ParticipantStatus } from "@prisma/client"

type CreateEventInput = {
  title: string
  category: string
  date: Date
  time: string
  duration: string
  location: string
  description: string
  maxParticipants: number
  isNews: boolean
  images: string[]
  responsible: string
  contact: string
  creatorId: string
  participantIds: string[]
  moderatorIds: string[]
}

export const createEventWithRelations = async (input: CreateEventInput) => {
  const confirmedParticipants = input.participantIds.map((userId) => ({
    userId,
    status: ParticipantStatus.CONFIRMED,
  }))

  return prisma.event.create({
    data: {
      title: input.title,
      category: input.category as never,
      date: input.date,
      time: input.time,
      duration: input.duration,
      location: input.location,
      description: input.description,
      maxParticipants: input.maxParticipants,
      currentParticipants: confirmedParticipants.length,
      isPast: false,
      removedFromCalendar: false,
      isNews: input.isNews,
      images: input.images,
      responsible: input.responsible,
      contact: input.contact,
      creatorId: input.creatorId,
      ...(input.moderatorIds.length > 0
        ? {
            moderators: {
              createMany: {
                data: input.moderatorIds.map((userId) => ({ userId })),
                skipDuplicates: true,
              },
            },
          }
        : {}),
      ...(confirmedParticipants.length > 0
        ? { eventParticipants: { create: confirmedParticipants } }
        : {}),
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          group: true,
        },
      },
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
}

type UpdateEventRelationsInput = {
  eventId: string
  updateData: Record<string, unknown>
  moderatorIds: string[] | null
  confirmedParticipantIds: string[] | null
}

export const updateEventWithRelations = async (input: UpdateEventRelationsInput) =>
  prisma.$transaction(async (tx) => {
    if (Object.keys(input.updateData).length > 0) {
      await tx.event.update({
        where: { id: input.eventId },
        data: input.updateData,
      })
    }

    if (input.moderatorIds !== null) {
      await tx.eventModerator.deleteMany({
        where: {
          eventId: input.eventId,
          userId: {
            notIn: input.moderatorIds.length > 0 ? input.moderatorIds : ["__none__"],
          },
        },
      })

      if (input.moderatorIds.length > 0) {
        await tx.eventModerator.createMany({
          data: input.moderatorIds.map((userId) => ({ eventId: input.eventId, userId })),
          skipDuplicates: true,
        })
      }
    }

    if (input.confirmedParticipantIds !== null) {
      await tx.eventParticipant.deleteMany({
        where: {
          eventId: input.eventId,
          status: ParticipantStatus.CONFIRMED,
          userId: {
            notIn:
              input.confirmedParticipantIds.length > 0
                ? input.confirmedParticipantIds
                : ["__none__"],
          },
        },
      })

      if (input.confirmedParticipantIds.length > 0) {
        await tx.eventParticipant.updateMany({
          where: { eventId: input.eventId, userId: { in: input.confirmedParticipantIds } },
          data: { status: ParticipantStatus.CONFIRMED },
        })

        await tx.eventParticipant.createMany({
          data: input.confirmedParticipantIds.map((userId) => ({
            eventId: input.eventId,
            userId,
            status: ParticipantStatus.CONFIRMED,
          })),
          skipDuplicates: true,
        })
      }

      await tx.event.update({
        where: { id: input.eventId },
        data: { currentParticipants: input.confirmedParticipantIds.length },
      })
    }

    return tx.event.findUnique({
      where: { id: input.eventId },
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
  })

