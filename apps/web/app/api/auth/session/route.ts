import { toClientSession } from '@vuteq/sso-client-react';
import { getApiUrl } from '@/lib/config';
import { sso } from '@/lib/sso';

export const dynamic = 'force-dynamic';

type LocalProfile = {
  UserId?: string;
  Name?: string;
  Email?: string | null;
  LastLogin?: string | Date | null;
  RoleName?: string | null;
  Permission?: string[] | null;
  AccessStatus?: 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'UNAVAILABLE';
};

export async function GET(request: Request) {
  const session = await sso.session(request);
  if (!session) {
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    // Backchannel logout runs server-to-server and cannot clear the browser
    // cookie itself. Clear stale session cookies on the next browser request.
    headers.append(
      'Set-Cookie',
      '__Host-ansei_sso=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    );
    headers.append(
      'Set-Cookie',
      'ansei_sso=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    );
    return Response.json(null, { headers });
  }

  let profile: LocalProfile | undefined;
  try {
    const response = await sso.fetch(
      request,
      new URL(`${getApiUrl('v1', request)}/auth/profile`),
      { cache: 'no-store' },
    );
    if (response.ok) {
      const body = await response.text();
      if (body) {
        try {
          const payload = JSON.parse(body) as
            | LocalProfile
            | { data?: LocalProfile };
          const data =
            payload && typeof payload === 'object' && 'data' in payload && payload.data
              ? payload.data
              : payload;
          profile = data as LocalProfile;
        } catch {
          // A profile response is optional for constructing the SSO session.
        }
      }
    } else if (response.status === 401) {
      const headers = new Headers({ 'Cache-Control': 'no-store' });
      headers.append(
        'Set-Cookie',
        '__Host-ansei_sso=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      );
      headers.append(
        'Set-Cookie',
        'ansei_sso=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      );
      return Response.json(null, { headers });
    }
  } catch {
    // If backend profile is unreachable
  }

  const globalSuper = session.globalRoles.includes('SUPER_ADMINISTRATOR');
  const globalRoAdmin = session.globalRoles.includes('RO_ADMINISTRATOR');

  if (profile) {
    if (globalSuper) {
      profile.RoleName = 'SUPER';
      profile.Permission = [...new Set([...(profile.Permission ?? []), 'SUPER'])];
      profile.AccessStatus = 'ACTIVE';
    } else if (globalRoAdmin) {
      if (!profile.RoleName || profile.RoleName === 'READONLY' || profile.AccessStatus === 'PENDING') {
        profile.RoleName = 'READONLY';
        profile.AccessStatus = 'ACTIVE';
      }
    } else if (!profile.RoleName) {
      profile.AccessStatus = 'PENDING';
    }
  } else if (globalSuper || globalRoAdmin) {
    profile = {
      UserId: session.profile.sub,
      Name:
        session.profile.name ??
        session.profile.preferred_username ??
        session.profile.sub,
      Email: session.profile.email,
      RoleName: globalSuper ? 'SUPER' : 'READONLY',
      Permission: globalSuper ? ['SUPER'] : [],
      AccessStatus: 'ACTIVE',
    };
  }

  return Response.json(
    toClientSession(session, {
      roles: profile?.RoleName ? [profile.RoleName] : [],
      permissions: profile?.Permission ?? [],
      attributes: profile,
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
