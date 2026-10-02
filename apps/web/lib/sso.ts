import 'server-only';
import { createNextVuteqSso } from '@vuteq/sso-client-react/next';
import { ssoSessionStore } from './sso-session-store';

// Runtime secrets are injected by Docker/Compose. Keep build-time evaluation safe;
// the SDK validates the real credentials when an auth route is actually used.
const baseUrl = process.env.VUTEQ_SSO_BASE_URL ?? 'https://sso.vuteq.co.id';
const secret = process.env.VUTEQ_SSO_SECRET ?? 'build-only-placeholder-secret';
const publicOrigin = process.env.VUTEQ_SSO_PUBLIC_ORIGIN;

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
