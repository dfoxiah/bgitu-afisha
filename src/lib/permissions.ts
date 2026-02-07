import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function getEventPermissions(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      creatorId: true,
      moderators: {
        where: { userId },
        select: { userId: true }
      }
    }
  })

  if (!event) {
    return { exists: false, isOwner: false, isModerator: false }
  }

  const isOwner = event.creatorId === userId
  const isModerator = event.moderators.length > 0
  return { exists: true, isOwner, isModerator }
}

export async function canModerateEvent(eventId: string, userId: string, role: Role) {
  if (role === 'ADMIN') return true
  if (role !== 'TEACHER') return false
  const { exists, isOwner, isModerator } = await getEventPermissions(eventId, userId)
  if (!exists) return false
  return isOwner || isModerator
}
