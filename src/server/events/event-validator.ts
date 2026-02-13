/**
 * File responsibility:
 * Validation helpers for event domain input.
 *
 * Main logic:
 * - Validate event category enum
 * - Provide list of valid categories for API responses
 *
 * Integrations:
 * - app/api/events/*
 * - app/api/admin/events/*
 */

import { EventCategory } from "@prisma/client"

export const isValidEventCategory = (category: string) =>
  Object.values(EventCategory).includes(category as EventCategory)

export const validEventCategories = Object.values(EventCategory)

