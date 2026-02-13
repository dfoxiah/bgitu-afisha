/**
 * File responsibility:
 * Shared API response contracts.
 *
 * Main logic:
 * - Standardized error payload shape for new/updated endpoints
 *
 * Integrations:
 * - app/api/*
 * - tests/smoke/*
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVER_ERROR"
  | "BAD_REQUEST"

export interface ApiErrorPayload {
  code: ApiErrorCode
  message: string
  details?: unknown
}

export interface ApiErrorResponse {
  error: string
  code?: ApiErrorCode
  errorPayload?: ApiErrorPayload
  details?: unknown
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

