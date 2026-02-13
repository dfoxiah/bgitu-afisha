/**
 * File responsibility:
 * Fallback events endpoint for empty dataset response.
 *
 * Main logic:
 * - Return stable empty payload.
 * - Support lightweight diagnostics and fallback clients.
 *
 * Integrations:
 * - Events API consumers
 * - Local testing scenarios
 */
import { NextResponse } from "next/server"

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json([], {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}
