import { resolveTelegramBotUsername, resolveTelegramLinkingConfigured } from "@/lib/telegram"
import LoginPageClient, { type LoginPageConfig } from "./LoginPageClient"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const [telegramConfigured, telegramBotUsername] = await Promise.all([
    resolveTelegramLinkingConfigured(),
    resolveTelegramBotUsername(),
  ])

  const initialConfig: LoginPageConfig = {
    telegram: {
      configured: telegramConfigured,
      botUsername: telegramBotUsername,
    },
    yandex: {
      configured: Boolean(process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET),
    },
  }

  return <LoginPageClient initialConfig={initialConfig} />
}
