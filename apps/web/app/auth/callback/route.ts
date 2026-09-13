import { sso } from '@/lib/sso';

export async function GET(request: Request): Promise<Response> {
  return sso.callback(request);
}
