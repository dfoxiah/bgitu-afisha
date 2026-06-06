/**
 * File responsibility:
 * Event DTO contracts for network boundaries.
 *
 * Main logic:
 * - Describe request payloads for create/update/complete workflows
 * - Keep route/service input contracts explicit and typed
 *
 * Integrations:
 * - app/api/events/*
 * - app/api/admin/events/*
 */

import type { EventCategory } from "@prisma/client"

export interface CreateEventDto {
  title: string
  category: EventCategory
  date: string
  time?: string
  duration?: string
  location: string
  description: string
  maxParticipants?: number
  participants?: string[]
  participantGroups?: string[]
  moderators?: string[]
  images?: string[]
  responsible?: string
  responsibleId?: string
  contact?: string
  isNews?: boolean
  requiresApproval?: boolean
}

export type UpdateEventDto = Partial<CreateEventDto>

export interface CompleteEventDto {
  summary: string
  tasks?: string[]
  activeParticipants?: string[]
  images?: string[]
  reportDate?: string
}
