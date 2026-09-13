import { sso } from '@/lib/sso';

export async function POST(request: Request): Promise<Response> {
  try {
    const res = await sso.backchannelLogout(request);
    console.log(
      JSON.stringify({
        event: 'sso_backchannel_logout',
        status: res.status,
      }),
    );
    return res;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'sso_backchannel_logout_error',
        errorName: (error as Error)?.name ?? 'Error',
      }),
    );
    return Response.json({ message: 'Logout failed' }, { status: 500 });
  }
}

