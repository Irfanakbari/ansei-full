import { sso } from '@/lib/sso';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/ansei/')) {
    url.pathname = `/ansei${url.pathname}`;
    return sso.callback(
      new Request(url, {
        method: request.method,
        headers: request.headers,
      }),
    );
  }

  return sso.callback(request);
}
