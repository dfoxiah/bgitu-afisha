/**
 * File responsibility:
 * Typed domain/service error helper for route handlers.
 *
 * Main logic:
 * - Carry HTTP status, API error code and optional details from services
 * - Provide type guard helpers for safe error handling in controllers
 *
 * Integrations:
 * - src/server/*
 * - src/app/api/*
 */

import type { ApiErrorCode } from "@/types/api-contracts/common"

export class ServiceError extends Error {
  status: number
  code: ApiErrorCode
  details?: unknown

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = "ServiceError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export const isServiceError = (value: unknown): value is ServiceError =>
  value instanceof ServiceError

