/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */

import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = new URLSearchParams();
  const search = searchParams.get('search')?.trim();
  const limit = searchParams.get('limit');

  if (search) query.set('search', search);
  if (limit) query.set('limit', limit);

  try {
    const suffix = query.size ? `?${query.toString()}` : '';
    const response = await fetch(
      `${getApiUrl('v1', request)}/production/findings/public/label-options${suffix}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) },
    );
    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: 'Label options are unavailable.' },
      { status: 502 },
    );
  }
}
