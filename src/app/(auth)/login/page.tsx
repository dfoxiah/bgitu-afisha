import { getTelegramBotUsername, isTelegramLinkingConfigured } from "@/lib/telegram"
import LoginPageClient, { type LoginPageConfig } from "./LoginPageClient"

export const dynamic = "force-dynamic"

export default function LoginPage() {
  const initialConfig: LoginPageConfig = {
    telegram: {
      configured: isTelegramLinkingConfigured(),
      botUsername: getTelegramBotUsername(),
    },
    yandex: {
      configured: Boolean(process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET),
    },
  }

  return <LoginPageClient initialConfig={initialConfig} />
}
