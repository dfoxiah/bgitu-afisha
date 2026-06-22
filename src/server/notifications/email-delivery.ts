/**
 * File responsibility:
 * Outbound email delivery for notification channels.
 *
 * Main logic:
 * - Support webhook-based delivery when provided by infrastructure.
 * - Fallback to direct SMTP delivery for standalone deployments.
 *
 * Integrations:
 * - src/server/notifications/notification-service.ts
 * - src/app/api/auth/notification-config/route.ts
 */

import nodemailer from "nodemailer"

type EmailNotificationInput = {
  to: string
  subject: string
  text: string
  metadata?: Record<string, unknown>
}

const emailWebhookUrl = process.env.EMAIL_NOTIFICATION_WEBHOOK_URL || ""
const emailFrom = process.env.EMAIL_NOTIFICATION_FROM || "no-reply@bgitu.ru"

const smtpHost = process.env.EMAIL_SMTP_HOST || ""
const smtpPort = Number(process.env.EMAIL_SMTP_PORT || "587")
const smtpSecure = /^(1|true|yes|on)$/i.test(process.env.EMAIL_SMTP_SECURE || "")
const smtpUser = process.env.EMAIL_SMTP_USER || ""
const smtpPassword = process.env.EMAIL_SMTP_PASSWORD || ""

let transporter: nodemailer.Transporter | null = null

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const hasSmtpConfig = () =>
  Boolean(
    emailFrom &&
      smtpHost &&
      Number.isFinite(smtpPort) &&
      smtpPort > 0 &&
      smtpUser &&
      smtpPassword
  )

const getTransporter = () => {
  if (!hasSmtpConfig()) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })
  }
  return transporter
}

const buildHtml = (input: EmailNotificationInput) => {
  const lines = input.text.split(/\r?\n/g)
  const body = lines.map((line) => escapeHtml(line) || "&nbsp;").join("<br />")

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f8ff;padding:24px;color:#162033;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid rgba(22,32,51,0.08);">
        <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#4f7cff;font-weight:700;margin-bottom:12px;">
          БГИТУ Афиша
        </div>
        <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:#162033;">
          ${escapeHtml(input.subject)}
        </h1>
        <div style="font-size:15px;line-height:1.7;color:#43506a;">
          ${body}
        </div>
      </div>
    </div>
  `
}

const sendViaWebhook = async (input: EmailNotificationInput) => {
  const response = await fetch(emailWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: emailFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: buildHtml(input),
      metadata: input.metadata || {},
    }),
  })

  if (!response.ok) {
    throw new Error(`Email notification failed: ${response.status}`)
  }
}

const sendViaSmtp = async (input: EmailNotificationInput) => {
  const nextTransporter = getTransporter()
  if (!nextTransporter) {
    throw new Error("SMTP email delivery is not configured")
  }

  await nextTransporter.sendMail({
    from: emailFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: buildHtml(input),
  })
}

export const isEmailDeliveryConfigured = () => Boolean(emailWebhookUrl) || hasSmtpConfig()

export const sendNotificationEmail = async (input: EmailNotificationInput) => {
  if (emailWebhookUrl) {
    await sendViaWebhook(input)
    return
  }

  await sendViaSmtp(input)
}

