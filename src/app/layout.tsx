/**
 * File responsibility:
 * Root app layout with global providers and baseline styles.
 *
 * Main logic:
 * - Wrap all pages with common shell/providers.
 * - Attach global metadata and fonts/styles.
 *
 * Integrations:
 * - Next.js App Router root layout
 * - Session/theme/toast providers
 */
import type { Metadata, Viewport } from "next"
import { Rubik, Merriweather } from "next/font/google"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import "@/styles/globals.css"
import { AppProvider } from "@/contexts/AppContext"
import SessionProvider from "@/components/providers/SessionProvider"
import LayoutShell from "@/components/layout/LayoutShell"

const rubik = Rubik({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
})

const merriweather = Merriweather({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  variable: "--font-display",
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "БГИТУ Афиша - мероприятия университета",
    template: "%s | БГИТУ Афиша",
  },
  description:
    "Единая платформа БГИТУ для календаря, новостей, регистрации на события и управления активностями кампуса.",
  applicationName: "БГИТУ Афиша",
  keywords: ["БГИТУ", "афиша", "мероприятия", "календарь", "новости", "кампус"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "БГИТУ Афиша",
    title: "БГИТУ Афиша - мероприятия университета",
    description:
      "Календарь, новости и регистрация на события БГИТУ в одном интерфейсе для студентов, преподавателей и администрации.",
    url: siteUrl,
    images: [
      {
        url: "/window.svg",
        width: 1200,
        height: 630,
        alt: "БГИТУ Афиша",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "БГИТУ Афиша",
    description: "Календарь и новости кампуса БГИТУ",
    images: ["/window.svg"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }],
    shortcut: ["/favicon.ico"],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2458c6",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="ru">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className={`${rubik.variable} ${merriweather.variable} bg-light-gray`}>
        <a href="#main-content" className="skip-link">
          Перейти к основному содержимому
        </a>

        <SessionProvider session={session}>
          <AppProvider>
            <LayoutShell>{children}</LayoutShell>
          </AppProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
