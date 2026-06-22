import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { isTelegramLinkingConfigured, isTelegramMessagingConfigured } from "@/lib/telegram"
import { isEmailDeliveryConfigured } from "@/server/notifications/email-delivery"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  return NextResponse.json(
    {
      emailConfigured: isEmailDeliveryConfigured(),
      vkConfigured: Boolean(process.env.VK_GROUP_TOKEN),
      telegramBotConfigured: isTelegramLinkingConfigured(),
      telegramMessagingConfigured: isTelegramMessagingConfigured(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  )
}

