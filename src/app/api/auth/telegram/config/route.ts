import { NextResponse } from "next/server"
import { getTelegramBotUsername, isTelegramLinkingConfigured } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    {
      configured: isTelegramLinkingConfigured(),
      botUsername: getTelegramBotUsername(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  )
}
