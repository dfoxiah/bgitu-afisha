/**
 * File responsibility:
 * Shared cache tag constants and revalidation helpers for event data.
 *
 * Main logic:
 * - Single source of truth for event cache tag name
 * - Manual cache invalidation entrypoint after event mutations
 *
 * Integrations:
 * - app/api/events/*
 * - app/api/admin/events/*
 */

import { revalidateTag } from "next/cache"

export const EVENTS_CACHE_TAG = "events"

export const revalidateEventsCache = () => {
  revalidateTag(EVENTS_CACHE_TAG, "max")
}
