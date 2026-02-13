/**
 * File responsibility:
 * Static mapping between event categories and icon classes.
 *
 * Main logic:
 * - Expose icon lookup for calendar/cards.
 * - Keep visual category mapping centralized.
 *
 * Integrations:
 * - Event UI components
 * - Category rendering helpers
 */
import { EventCategory } from '@prisma/client'

const categoryIconMap: Record<EventCategory, string> = {
  [EventCategory.CONCERT]: 'fa-music',
  [EventCategory.INTERNAL_ACTIVITY]: 'fa-building',
  [EventCategory.PUBLIC_EVENT]: 'fa-users',
  [EventCategory.COMPETITION]: 'fa-trophy',
  [EventCategory.LECTURE]: 'fa-chalkboard',
  [EventCategory.MASTERCLASS]: 'fa-toolbox',
  [EventCategory.VOLUNTEER]: 'fa-handshake',
  [EventCategory.NEWS]: 'fa-newspaper'
}

export const getCategoryIcon = (category?: EventCategory | null) => {
  if (!category) return 'fa-calendar'
  return categoryIconMap[category] || 'fa-calendar'
}
