import 'server-only';
import { createNextVuteqSso } from '@vuteq/sso-client-react/next';
import { ssoSessionStore } from './sso-session-store';

export const sso = createNextVuteqSso({
  baseUrl: process.env.VUTEQ_SSO_BASE_URL ?? 'https://sso.vuteq.co.id',
  secret: process.env.VUTEQ_SSO_SECRET ?? 'configure-vuteq-sso-secret',
  publicOrigin: process.env.VUTEQ_SSO_PUBLIC_ORIGIN,
  store: ssoSessionStore,
  cookieName: 'ansei_sso',
  callbackPath: '/auth/callback',
  homePath: '/apps',
  errorPath: '/auth/error',
  trustProxy: process.env.VUTEQ_SSO_TRUST_PROXY === 'true',
});
