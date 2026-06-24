import { NextResponse } from "next/server"
import { resolveTelegramBotUsername, resolveTelegramLinkingConfigured } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function GET() {
  const [configured, botUsername] = await Promise.all([
    resolveTelegramLinkingConfigured(),
    resolveTelegramBotUsername(),
  ])

  return NextResponse.json(
    {
      configured,
      botUsername,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  )
}
