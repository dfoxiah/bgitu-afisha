import type { User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type UserTelegramFields = {
  notifyTelegram: boolean
  telegramChatId: string | null
  telegramUsername: string | null
}

export type UserWithTelegram = User & UserTelegramFields

type UserDelegateLike = {
  findUnique: unknown
  findFirst: unknown
  findMany: unknown
  create: unknown
  update: unknown
}

type CompatUserDelegate = {
  findUnique<T>(args: unknown): Promise<T | null>
  findFirst<T>(args: unknown): Promise<T | null>
  findMany<T>(args: unknown): Promise<T[]>
  create<T>(args: unknown): Promise<T>
  update<T>(args: unknown): Promise<T>
}

export const asPrismaUserCompat = (delegate: UserDelegateLike) =>
  delegate as unknown as CompatUserDelegate

export const prismaUserCompat = asPrismaUserCompat(prisma.user)
