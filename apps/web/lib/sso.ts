import 'server-only';
import { createNextVuteqSso } from '@vuteq/sso-client-react/next';
import { ssoSessionStore } from './sso-session-store';

const baseUrl = process.env.VUTEQ_SSO_BASE_URL;
const secret = process.env.VUTEQ_SSO_SECRET;
const publicOrigin = process.env.VUTEQ_SSO_PUBLIC_ORIGIN;

if (process.env.NODE_ENV === 'production' && (!baseUrl || !secret || !publicOrigin)) {
  throw new Error(
    'VUTEQ_SSO_BASE_URL, VUTEQ_SSO_SECRET, and VUTEQ_SSO_PUBLIC_ORIGIN are required in production',
  );
}

export const sso = createNextVuteqSso({
  baseUrl: baseUrl ?? 'https://sso.vuteq.co.id',
  secret: secret ?? 'configure-vuteq-sso-secret',
  publicOrigin,
  store: ssoSessionStore,
  cookieName: 'ansei_sso',
  callbackPath: '/auth/callback',
  homePath: '/apps',
  errorPath: '/auth/error',
  trustProxy: process.env.VUTEQ_SSO_TRUST_PROXY === 'true',
  onCallbackError: (diagnostic) => {
    console.error(JSON.stringify({ event: 'sso_callback_failed', ...diagnostic }));
  },
});
