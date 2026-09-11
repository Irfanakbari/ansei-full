import { toClientSession } from '@vuteq/sso-client-react';
import { getApiUrl } from '@/lib/config';
import { sso } from '@/lib/sso';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await sso.session(request);
  if (!session) {
    return Response.json(null, { headers: { 'Cache-Control': 'no-store' } });
  }

  const response = await sso.fetch(
    request,
    new URL(`${getApiUrl('v1')}/auth/profile`),
    { cache: 'no-store' },
  );
  const profile = response.ok
    ? (await response.json()) as { RoleName?: string | null; Permission?: string[] }
    : undefined;

  return Response.json(
    toClientSession(session, {
      roles: profile?.RoleName ? [profile.RoleName] : [],
      permissions: profile?.Permission ?? [],
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
