/**
 * File responsibility:
 * Public entry page of the application.
 *
 * Main logic:
 * - Render the public event poster without requiring authentication.
 * - Keep the root page tied to the same event data as the private app.
 *
 * Integrations:
 * - src/components/public/PublicAfishaPage.tsx
 */

import PublicAfishaPage from "@/components/public/PublicAfishaPage"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    redirect("/dashboard")
  }

  return <PublicAfishaPage />
}
