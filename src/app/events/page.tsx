/**
 * File responsibility:
 * Events route wrapper page.
 *
 * Main logic:
 * - Render events workspace component.
 * - Provide page-level composition for events module.
 *
 * Integrations:
 * - src/components/events/page.tsx
 * - App Router /events route
 */
'use client'

import EventsPage from '@/components/events/page'

export default function EventsRoutePage() {
  return <EventsPage />
}
