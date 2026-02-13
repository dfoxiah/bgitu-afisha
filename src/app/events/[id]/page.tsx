/**
 * File responsibility:
 * App Router page module for this route.
 *
 * Main logic:
 * - Compose route-level UI blocks.
 * - Connect page state with shared context/services.
 *
 * Integrations:
 * - Shared layout/providers
 * - Feature components and hooks
 */
'use client'

import EventDetailsPage from '@/components/events/[id]/page'

export default function EventDetailsRoutePage() {
  return <EventDetailsPage />
}
