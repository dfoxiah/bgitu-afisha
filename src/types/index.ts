/**
 * File responsibility:
 * Public typed entrypoint for client/domain/api contracts.
 *
 * Main logic:
 * - Re-export domain models and Prisma enums
 * - Keep category display/reverse maps used by UI forms and filters
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - src/app/* and src/components/*
 */

import {
  EventCategory as PrismaEventCategory,
  NotificationType as PrismaNotificationType,
  Role as PrismaRole,
} from "@prisma/client"

import type { Event, EventReport } from "./domain/event"
import type { Notification } from "./domain/notification"
import type { User } from "./domain/user"

export type EventCategory = PrismaEventCategory
export type NotificationType = PrismaNotificationType
export type Role = PrismaRole

export type { Event, EventReport, Notification, User }

export type CategoryMapping = Record<string, EventCategory>

export const CategoryDisplayMap: Record<EventCategory, string> = {
  [PrismaEventCategory.CONCERT]: "Концерт",
  [PrismaEventCategory.INTERNAL_ACTIVITY]: "Внутривузовская активность",
  [PrismaEventCategory.PUBLIC_EVENT]: "Общественное мероприятие",
  [PrismaEventCategory.COMPETITION]: "Соревнование",
  [PrismaEventCategory.LECTURE]: "Лекция",
  [PrismaEventCategory.MASTERCLASS]: "Мастер-класс",
  [PrismaEventCategory.VOLUNTEER]: "Волонтерская активность",
  [PrismaEventCategory.NEWS]: "Новость",
}

export const CategoryReverseMap: Record<string, EventCategory> = {
  Концерт: PrismaEventCategory.CONCERT,
  "Внутривузовская активность": PrismaEventCategory.INTERNAL_ACTIVITY,
  "Общественное мероприятие": PrismaEventCategory.PUBLIC_EVENT,
  Соревнование: PrismaEventCategory.COMPETITION,
  Лекция: PrismaEventCategory.LECTURE,
  "Мастер-класс": PrismaEventCategory.MASTERCLASS,
  "Волонтерская активность": PrismaEventCategory.VOLUNTEER,
  "Волонтёрская активность": PrismaEventCategory.VOLUNTEER,
  Новость: PrismaEventCategory.NEWS,
}
