/**
 * File responsibility:
 * Public poster route.
 *
 * Main logic:
 * - Expose public events under a stable /afisha URL.
 *
 * Integrations:
 * - src/components/public/PublicAfishaPage.tsx
 */

import PublicAfishaPage from "@/components/public/PublicAfishaPage"

export default function AfishaPage() {
  return <PublicAfishaPage />
}
