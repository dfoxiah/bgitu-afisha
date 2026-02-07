// src/types/index.ts
import { EventCategory as PrismaEventCategory, NotificationType as PrismaNotificationType, Role as PrismaRole } from '@prisma/client'

// Реэкспорт Prisma enums
export type EventCategory = PrismaEventCategory;
export type NotificationType = PrismaNotificationType;
export type Role = PrismaRole;

// Базовые интерфейсы
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
  moderators?: User[]
  responsible: string
  contact: string
  creatorId: string
  creator: User
  createdAt: Date
  updatedAt: Date
}

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

export interface User {
  id: string
  name: string | null
  email: string
  emailVerified: Date | null
  image: string | null
  role: Role
  department: string | null
  group: string | null
  groupChangeCount?: number
  privacyConsentAt?: Date | null
  termsConsentAt?: Date | null
  bio?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Notification {
  id: string
  userId: string
  title: string
  content: string
  type: NotificationType
  read: boolean
  metadata?: Record<string, any>
  createdAt: Date
}

// Вспомогательные типы
export interface CategoryMapping {
  [key: string]: EventCategory
}

// Маппинг для отображения русских названий категорий
export const CategoryDisplayMap: Record<EventCategory, string> = {
  [PrismaEventCategory.CONCERT]: 'Концерт',
  [PrismaEventCategory.INTERNAL_ACTIVITY]: 'Внутривузовская активность',
  [PrismaEventCategory.PUBLIC_EVENT]: 'Общественное мероприятие',
  [PrismaEventCategory.COMPETITION]: 'Соревнование',
  [PrismaEventCategory.LECTURE]: 'Лекция',
  [PrismaEventCategory.MASTERCLASS]: 'Мастер-класс',
  [PrismaEventCategory.VOLUNTEER]: 'Волонтёрская активность',
  [PrismaEventCategory.NEWS]: 'Новость'
}

export const CategoryReverseMap: Record<string, EventCategory> = {
  'Концерт': PrismaEventCategory.CONCERT,
  'Внутривузовская активность': PrismaEventCategory.INTERNAL_ACTIVITY,
  'Общественное мероприятие': PrismaEventCategory.PUBLIC_EVENT,
  'Соревнование': PrismaEventCategory.COMPETITION,
  'Лекция': PrismaEventCategory.LECTURE,
  'Мастер-класс': PrismaEventCategory.MASTERCLASS,
  'Волонтёрская активность': PrismaEventCategory.VOLUNTEER,
  'Волонтерская активность': PrismaEventCategory.VOLUNTEER,
  'Новость': PrismaEventCategory.NEWS
}

