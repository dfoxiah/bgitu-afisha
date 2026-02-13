/**
 * File responsibility:
 * Debug endpoint to inspect current session payload.
 *
 * Main logic:
 * - Return session diagnostic data.
 * - Help validate authentication wiring in local environment.
 *
 * Integrations:
 * - next-auth getServerSession()
 * - Local smoke/debug flows
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const session = await getServerSession(authOptions);
    
    return NextResponse.json({
      success: true,
      session: {
        hasSession: !!session,
        user: session?.user,
        expires: session?.expires
      },
      cookies: req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Session test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}
