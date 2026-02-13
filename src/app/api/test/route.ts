/**
 * File responsibility:
 * Minimal API probe endpoint for connectivity checks.
 *
 * Main logic:
 * - Return static health/test response.
 * - Provide quick API availability signal.
 *
 * Integrations:
 * - Local debugging tools
 * - CI/smoke sanity checks
 */
// src/app/api/test/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ 
    message: "Test API работает",
    timestamp: new Date().toISOString() 
  })
}
