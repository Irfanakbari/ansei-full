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
  let profile: { RoleName?: string | null; Permission?: string[] } | undefined;
  if (response.ok) {
    const body = await response.text();
    if (body) {
      try {
        profile = JSON.parse(body) as {
          RoleName?: string | null;
          Permission?: string[];
        };
      } catch {
        // A profile response is optional for constructing the SSO session.
      }
    }
  }

  return Response.json(
    toClientSession(session, {
      roles: profile?.RoleName ? [profile.RoleName] : [],
      permissions: profile?.Permission ?? [],
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
