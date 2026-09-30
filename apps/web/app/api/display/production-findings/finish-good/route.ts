/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */

import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const labelNumber = searchParams.get('labelNumber')?.trim();

  if (!labelNumber || labelNumber.length > 255) {
    return NextResponse.json(
      { message: 'A valid label number is required.' },
      { status: 400 },
    );
  }

  try {
    const query = new URLSearchParams({ labelNumber });
    const response = await fetch(
      `${getApiUrl('v1', request)}/production/findings/public/finish-good?${query.toString()}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) },
    );
    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: 'Finish-good finding context is unavailable.' },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const response = await fetch(
      `${getApiUrl('v1', request)}/production/findings/public/finish-good`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      },
    );
    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: 'Production finding service is unavailable.' },
      { status: 502 },
    );
  }
}
