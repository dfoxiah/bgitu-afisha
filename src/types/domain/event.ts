/**
 * File responsibility:
 * Domain-level event and event report models.
 *
 * Main logic:
 * - Represent event aggregate used by UI and state container
 * - Keep Date-compatible fields for runtime calculations
 *
 * Integrations:
 * - src/types/index.ts
 * - events UI/pages/context
 */

import type { EventCategory, ParticipantStatus } from "@prisma/client"
import type { User } from "./user"

export interface EventReport {
  id: string
  eventId: string
  summary: string
  tasks: string[]
  comment?: string
  reportDate: Date
  activeParticipants: string[]
  images: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Event {
  id: string
  title: string
  category: EventCategory
  date: Date | string
  time: string
  duration: string
  location: string
  description: string
  maxParticipants: number
  currentParticipants: number
  isPast: boolean
  removedFromCalendar: boolean
  isNews: boolean
  images: string[]
  report: EventReport | null
  participants: User[]
  pendingParticipants?: User[]
  confirmedParticipantsCount?: number
  pendingParticipantsCount?: number
  canViewParticipants?: boolean
  viewerParticipationStatus?: ParticipantStatus | null
  moderators?: User[]
  responsible: string
  contact: string
  creatorId: string
  creator: User
  createdAt: Date
  updatedAt: Date
}
