import { env } from 'cloudflare:workers'
import { getRequestUrl } from '@tanstack/react-start/server'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { createHaloboxAuth } from './better-auth-core'
import { cloudflareOTPSender } from './auth-email.server'
import { appleClientSecret } from './apple-client-secret'
import { authBaseURL } from './auth-origins'

export const AUTH_REALM = 'viewer' as const
export function authProviderConfig() {
  const e = env as any
  return {
    googleEnabled: e.GOOGLE_AUTH_ENABLED === '1' && !!e.GOOGLE_CLIENT_ID && !!e.GOOGLE_CLIENT_SECRET,
    appleEnabled: e.APPLE_AUTH_ENABLED === '1' && !!e.APPLE_CLIENT_ID && (!!e.APPLE_CLIENT_SECRET || (!!e.APPLE_TEAM_ID && !!e.APPLE_KEY_ID && !!e.APPLE_PRIVATE_KEY)),
  }
}
export function getAuth() {
  const e = env as any
  const providers = authProviderConfig()
  const origin = new URL(getRequestUrl()).origin
  // Only local development may derive its origin from the request.
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)
  const baseURL = authBaseURL(origin, e.BETTER_AUTH_URL, AUTH_REALM)
  return createHaloboxAuth({
    db: e.DB,
    secret: e.BETTER_AUTH_SECRET || e.SESSION_SECRET,
    baseURL,
    realm: AUTH_REALM,
    sendOTP: cloudflareOTPSender(e.EMAIL, e.AUTH_EMAIL_FROM, !local && e.AUTH_EMAIL_ENABLED === '1'),
    socialProviders: {
      ...(providers.googleEnabled ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } } : {}),
      ...(providers.appleEnabled ? { apple: async () => ({
        clientId: e.APPLE_CLIENT_ID,
        clientSecret: e.APPLE_PRIVATE_KEY ? await appleClientSecret({ clientId: e.APPLE_CLIENT_ID, teamId: e.APPLE_TEAM_ID, keyId: e.APPLE_KEY_ID, privateKey: e.APPLE_PRIVATE_KEY }) : e.APPLE_CLIENT_SECRET,
        appBundleIdentifier: e.APPLE_BUNDLE_ID,
      }) } : {}),
    },
    plugins: [tanstackStartCookies()],
  })
}
