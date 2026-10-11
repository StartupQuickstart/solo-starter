import { NextResponse } from 'next/server';

/**
 * Health check endpoint used by Railway's health check configuration.
 *
 * @returns JSON response with status "ok"
 */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
