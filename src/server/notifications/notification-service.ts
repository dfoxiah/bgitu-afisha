/**
 * File responsibility:
 * Central notification creation and optional external delivery.
 *
 * Main logic:
 * - Create in-app notifications with consistent link/metadata shape.
 * - Dispatch optional VK/email channels only when env and user preferences allow it.
 *
 * Integrations:
 * - event/import/report workflows
 * - src/app/api/notifications/*
 */

import { NotificationType, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type NotificationInput = {
  userId: string
  title: string
  content: string
  type: NotificationType
  read?: boolean
  link?: string | null
  metadata?: Prisma.InputJsonValue
}

type NotificationRecipient = {
  id: string
  email: string
  vkUserId: string | null
  notifyInApp: boolean
  notifyEmail: boolean
  notifyVk: boolean
}

const vkToken = process.env.VK_GROUP_TOKEN || ""
const vkApiVersion = process.env.VK_API_VERSION || "5.199"
const emailWebhookUrl = process.env.EMAIL_NOTIFICATION_WEBHOOK_URL || ""
const emailFrom = process.env.EMAIL_NOTIFICATION_FROM || "no-reply@bgitu.ru"

const toRandomId = () => Math.floor(Date.now() + Math.random() * 1000000)

const sendVkNotification = async (recipient: NotificationRecipient, input: NotificationInput) => {
  if (!vkToken || !recipient.vkUserId || !recipient.notifyVk) return

  const body = new URLSearchParams({
    access_token: vkToken,
    v: vkApiVersion,
    user_id: recipient.vkUserId,
    random_id: String(toRandomId()),
    message: `${input.title}\n\n${input.content}${input.link ? `\n${input.link}` : ""}`,
  })

  const response = await fetch("https://api.vk.com/method/messages.send", {
    method: "POST",
    body,
  })

  if (!response.ok) {
    throw new Error(`VK notification failed: ${response.status}`)
  }

  const payload = (await response.json()) as { error?: { error_msg?: string } }
  if (payload.error) {
    throw new Error(payload.error.error_msg || "VK notification failed")
  }
}

const sendEmailNotification = async (recipient: NotificationRecipient, input: NotificationInput) => {
  if (!emailWebhookUrl || !recipient.notifyEmail) return

  const response = await fetch(emailWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: emailFrom,
      to: recipient.email,
      subject: input.title,
      text: `${input.content}${input.link ? `\n\n${input.link}` : ""}`,
      metadata: input.metadata || {},
    }),
  })

  if (!response.ok) {
    throw new Error(`Email notification failed: ${response.status}`)
  }
}

const dispatchExternalChannels = async (
  recipients: NotificationRecipient[],
  inputsByUserId: Map<string, NotificationInput[]>
) => {
  const tasks: Promise<unknown>[] = []

  recipients.forEach((recipient) => {
    const inputs = inputsByUserId.get(recipient.id) || []
    inputs.forEach((input) => {
      tasks.push(sendVkNotification(recipient, input))
      tasks.push(sendEmailNotification(recipient, input))
    })
  })

  const results = await Promise.allSettled(tasks)
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn("External notification delivery failed", result.reason)
    }
  })
}

export const createNotifications = async (inputs: NotificationInput[]) => {
  if (inputs.length === 0) return { count: 0 }

  const userIds = Array.from(new Set(inputs.map((input) => input.userId)))
  const recipients = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      vkUserId: true,
      notifyInApp: true,
      notifyEmail: true,
      notifyVk: true,
    },
  })

  const recipientIds = new Set(recipients.map((recipient) => recipient.id))
  const inAppData = inputs
    .filter((input) => recipientIds.has(input.userId))
    .filter((input) => recipients.find((recipient) => recipient.id === input.userId)?.notifyInApp ?? true)
    .map((input) => ({
      userId: input.userId,
      title: input.title,
      content: input.content,
      type: input.type,
      read: input.read ?? false,
      link: input.link || null,
      metadata: input.metadata || Prisma.JsonNull,
    }))

  const result = inAppData.length > 0
    ? await prisma.notification.createMany({ data: inAppData })
    : { count: 0 }

  const inputsByUserId = new Map<string, NotificationInput[]>()
  inputs.forEach((input) => {
    const current = inputsByUserId.get(input.userId) || []
    current.push(input)
    inputsByUserId.set(input.userId, current)
  })

  await dispatchExternalChannels(recipients, inputsByUserId)

  return result
}

export const createNotification = async (input: NotificationInput) =>
  createNotifications([input])

export const buildEventLink = (eventId: string) => `/events/${eventId}`
export const buildUserLink = (userId: string) => `/users/${userId}`
export const buildAdminLink = (section: string) => `/admin?tab=${encodeURIComponent(section)}`
