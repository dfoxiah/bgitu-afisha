/**
 * File responsibility:
 * Unified API response helpers for success/error payloads.
 *
 * Main logic:
 * - Build backward-compatible error responses with a normalized error payload
 * - Keep transport status handling in one place
 *
 * Integrations:
 * - app/api/*
 */

import { NextResponse } from "next/server"
import type { ApiErrorCode, ApiErrorResponse } from "@/types/api-contracts/common"

type ErrorOptions = {
  details?: unknown
}

export const errorJson = (
  status: number,
  code: ApiErrorCode,
  message: string,
  options: ErrorOptions = {}
) =>
  NextResponse.json<ApiErrorResponse>(
    {
      error: message,
      code,
      errorPayload: {
        code,
        message,
        details: options.details,
      },
      details: options.details,
    },
    { status }
  )

export const successJson = <T>(data: T, status = 200) =>
  NextResponse.json<T>(data, { status })

