import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins'
import { google, verifyGoogleIdToken } from 'better-auth/social-providers'
import bcrypt from 'bcryptjs'

export type AuthRealm = 'viewer' | 'admin'
export type AuthDatabase = { prepare(sql: string): { bind(...values: unknown[]): { first<T = any>(): Promise<T | null>; all(): Promise<{ results?: any[] }>; run(): Promise<unknown> } } }
export const OTP_UNAVAILABLE = 'Email sign-in is not enabled yet. Please use your password.'
const DENIED = 'Unable to sign in with these details.'
export const cookieName = (realm: AuthRealm, secure: boolean) => `${secure ? '__Secure-' : ''}halobox-${realm}.session_token`

export async function eligibleUser(db: AuthDatabase, id: string | number, realm: AuthRealm) {
  const row = await db.prepare('SELECT id,email,first_name,last_name,status,is_banned,deleted_at,user_type FROM users WHERE id=?').bind(Number(id)).first<any>()
  if (!row || row.deleted_at != null || Number(row.status) !== 1 || Number(row.is_banned ?? 0) !== 0) return null
  if (realm === 'admin' && !['admin', 'demo_admin'].includes(row.user_type)) return null
  const duplicates = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE LOWER(TRIM(email))=?').bind(String(row.email).trim().toLowerCase()).first<{ n: number }>()
  return duplicates?.n === 1 ? row : null
}

/** No Cloudflare globals here: production and isolated tests run the same auth implementation. */
export function createHaloboxAuth(config: {
  db: AuthDatabase
  database?: BetterAuthOptions['database']
  secret: string
  baseURL: string
  realm: AuthRealm
  sendOTP?: (message: { email: string; otp: string; type: string }) => Promise<void>
  socialProviders?: BetterAuthOptions['socialProviders']
  plugins?: BetterAuthOptions['plugins']
}) {
  const { db, realm } = config
  if (typeof config.secret !== 'string' || config.secret.length < 32) throw new Error('Authentication is not configured.')
  const table = `ba_${realm}`
  const googleOptions = config.socialProviders?.google
  const socialProviders = {
    ...config.socialProviders,
    ...(googleOptions ? { google: async () => {
      const options = typeof googleOptions === 'function' ? await googleOptions() : googleOptions
      const provider = google(options)
      return { ...options, getUserInfo: async (tokens: Parameters<typeof provider.getUserInfo>[0]) => {
        // The code exchange is server-to-server. Also validate the ID token
        // before its email claims are allowed to link an existing account.
        if (!tokens.idToken || !await verifyGoogleIdToken({ token: tokens.idToken, audience: options.clientId, nonce: tokens.expectedIdTokenNonce })) return null
        return provider.getUserInfo(tokens)
      } }
    } } : {}),
  }
  const protectedField = (type: 'string' | 'number', fieldName: string, defaultValue?: string | number) => ({ type, fieldName, input: false, returned: false, required: false, ...(defaultValue === undefined ? {} : { defaultValue }) } as const)
  return betterAuth({
    appName: 'GoodNews Halobox',
    baseURL: config.baseURL,
    basePath: '/api/auth',
    secret: config.secret,
    database: config.database ?? db as BetterAuthOptions['database'],
    trustedOrigins: [new URL(config.baseURL).origin, ...(config.socialProviders?.apple ? ['https://appleid.apple.com'] : [])],
    advanced: {
      database: { generateId: ({ model }) => model === 'user' ? false : crypto.randomUUID() },
      cookiePrefix: `halobox-${realm}`,
      useSecureCookies: config.baseURL.startsWith('https:'),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    user: {
      modelName: 'users',
      validateUserInfo: async ({ user, source }, ctx) => {
        if (source.method !== 'oauth' || source.action !== 'link-account') return
        const existing = user.id ? await eligibleUser(db, user.id, realm) : null
        if (!existing) return { error: 'account_not_linked' }
        // Authenticated Settings linking still requires Better Auth's verified
        // provider identity, live initiating session and same-email checks.
        const session = await getSessionFromCtx(ctx)
        if (session?.user.id === String(existing.id)) return

        // Migrated rows lack the new local verification flag. Only Google's
        // validated Gmail/Workspace claims can replace that first password step.
        // A Google account using a third-party mailbox is not proof of current
        // mailbox ownership. Never implicitly attach administrative identities.
        const profile = source.oauth?.profile
        const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : ''
        const authoritative = email.endsWith('@gmail.com') || (typeof profile?.hd === 'string' && profile.hd.length > 0)
        if (realm === 'viewer' && existing.user_type === 'user' && source.oauth?.providerId === 'google'
          && profile?.email_verified === true && user.emailVerified === true && authoritative
          && email === String(existing.email).trim().toLowerCase() && email === user.email?.toLowerCase()) return
        return { error: 'account_not_linked' }
      },
      fields: { name: 'first_name', emailVerified: 'auth_email_verified', image: 'auth_image', createdAt: 'created_at', updatedAt: 'updated_at' },
      additionalFields: {
        lastName: { type: 'string', fieldName: 'last_name', required: false, defaultValue: '' },
        mobile: { type: 'string', required: false },
        legacyPassword: protectedField('string', 'password', ''),
        userType: protectedField('string', 'user_type', 'user'),
        status: protectedField('number', 'status', 1),
        banned: protectedField('number', 'is_banned', 0),
        subscribed: protectedField('number', 'is_subscribe', 0),
      },
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    account: {
      modelName: 'ba_account',
      accountLinking: { enabled: true, disableImplicitLinking: realm === 'admin', requireLocalEmailVerified: realm === 'admin', trustedProviders: [], allowDifferentEmails: false },
      encryptOAuthTokens: true,
    },
    session: {
      modelName: `${table}_session`,
      expiresIn: realm === 'admin' ? 60 * 60 * 12 : 60 * 60 * 24 * 30,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
      additionalFields: { profileId: { type: 'number', required: false, input: false, returned: false } },
    },
    verification: { modelName: `${table}_verification` },
    rateLimit: { enabled: true, storage: 'database', modelName: `${table}_rate_limit`, window: 60, max: 30,
      customRules: { '/sign-in/email': { window: 60, max: 5 }, '/sign-in/email-otp': { window: 60, max: 5 } } },
    emailAndPassword: {
      enabled: true,
      disableSignUp: realm === 'admin',
      minPasswordLength: 8,
      maxPasswordLength: 72,
      password: {
        hash: async password => {
          if (new TextEncoder().encode(password).length > 72) throw new APIError('BAD_REQUEST', { message: 'Use a password of no more than 72 bytes.' })
          return bcrypt.hash(password, 12)
        },
        verify: async ({ hash, password }) => bcrypt.compare(password, hash.replace(/^\$2y\$/, '$2b$')).catch(() => false),
      },
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: { sendOnSignUp: false, sendOnSignIn: false },
    socialProviders,
    hooks: {
      before: createAuthMiddleware(async ctx => {
        // Better Auth's generic origin middleware skips cookie-less requests.
        // Sending recovery mail is still an abuse-sensitive browser action.
        // Provider callbacks retain the library's state/PKCE checks (Apple uses POST).
        if (ctx.request?.method === 'POST' && !ctx.path.startsWith('/callback/')) {
          if (ctx.request.headers.get('origin') !== new URL(config.baseURL).origin || ctx.request.headers.get('sec-fetch-site') === 'cross-site') {
            throw new APIError('FORBIDDEN', { message: 'Refresh this page and try again.' })
          }
        }
        // Sending and recovery endpoints remain unavailable without a sender. This check
        // runs before creating a code, including direct calls to Better Auth endpoints.
        if ((ctx.path.includes('send-verification') || ctx.path.includes('request-password-reset') || ctx.path.startsWith('/forget-password')) && !config.sendOTP) {
          throw new APIError('SERVICE_UNAVAILABLE', { message: OTP_UNAVAILABLE })
        }
        // Link-based recovery is not configured: the supported recovery contract is OTP.
        if (['/request-password-reset', '/forget-password', '/send-verification-email'].includes(ctx.path)) {
          throw new APIError('SERVICE_UNAVAILABLE', { message: 'Use email-code recovery from the sign-in page.' })
        }
        if (typeof ctx.body?.email === 'string') {
          ctx.body.email = ctx.body.email.trim().toLowerCase()
          if (ctx.body.email.length > 254) throw new APIError('BAD_REQUEST', { message: 'Enter a valid email address.' })
        }
        const protectedPaths = ['/get-session', '/update-user', '/change-password', '/set-password', '/link-social', '/unlink-account', '/list-accounts', '/list-sessions', '/revoke-session', '/revoke-sessions', '/revoke-other-sessions', '/get-access-token', '/refresh-token']
        if (protectedPaths.includes(ctx.path)) {
          const current = await getSessionFromCtx(ctx)
          if (current && !await eligibleUser(db, current.user.id, realm)) throw new APIError('UNAUTHORIZED', { message: DENIED })
        }
        if (typeof ctx.body?.email === 'string' && ['/sign-in/email', '/sign-in/email-otp', '/email-otp/send-verification-otp', '/sign-up/email', '/email-otp/request-password-reset', '/forget-password/email-otp', '/email-otp/reset-password', '/email-otp/check-verification-otp', '/email-otp/verify-email'].includes(ctx.path)) {
          const window = Math.floor(Date.now() / 600_000)
          const key = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${config.secret}:${realm}:${['/email-otp/send-verification-otp', '/email-otp/request-password-reset', '/forget-password/email-otp'].includes(ctx.path) ? 'email-send' : ctx.path}:${ctx.body.email}:${window}`))), b => b.toString(16).padStart(2,'0')).join('')
          const count = await db.prepare('INSERT INTO auth_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(key,(window+1)*600).first<{count:number}>()
          await db.prepare('DELETE FROM auth_limits WHERE bucket IN (SELECT bucket FROM auth_limits WHERE expires_at < ? LIMIT 100)').bind(Math.floor(Date.now()/1000)).run()
          if (!count || count.count > 12) throw new APIError('TOO_MANY_REQUESTS', { message: 'Too many attempts. Please wait 10 minutes.' })
        }
        if (['/sign-in/email', '/sign-in/email-otp', '/email-otp/reset-password', '/email-otp/verify-email'].includes(ctx.path)) {
          const rows = await db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email))=? LIMIT 2').bind(ctx.body?.email ?? '').all()
          const row = rows.results?.length === 1 ? rows.results[0] : null
          if (!row || !await eligibleUser(db, row.id, realm)) {
            if (ctx.path === '/sign-in/email') await bcrypt.compare(String(ctx.body?.password ?? ''), '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
            throw new APIError('UNAUTHORIZED', { message: DENIED })
          }
        }
        if (ctx.path === '/sign-up/email') {
          if (realm === 'admin') throw new APIError('FORBIDDEN', { message: DENIED })
          if (typeof ctx.body?.name !== 'string' || !ctx.body.name.trim() || ctx.body.name.length > 80 || String(ctx.body.lastName ?? '').length > 80) throw new APIError('BAD_REQUEST', { message: 'Enter your name (up to 80 characters per field).' })
          if (ctx.body.mobile && !/^\+[1-9][0-9]{5,14}$/.test(ctx.body.mobile)) throw new APIError('BAD_REQUEST', { message: 'Enter an international phone number.' })
        }
      }),
    },
    databaseHooks: {
      user: {
        create: { before: async user => {
          if (realm === 'admin') throw new APIError('FORBIDDEN', { message: DENIED })
          return { data: { ...user, userType: 'user', status: 1, banned: 0, subscribed: 0, legacyPassword: '' } }
        } },
      },
      session: { create: { before: async session => {
        if (!await eligibleUser(db, session.userId, realm)) throw new APIError('UNAUTHORIZED', { message: DENIED })
      } } },
    },
    plugins: [emailOTP({
      disableSignUp: true,
      sendVerificationOnSignUp: false,
      storeOTP: 'hashed',
      expiresIn: 300,
      allowedAttempts: 3,
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async message => {
        if (!config.sendOTP) throw new APIError('SERVICE_UNAVAILABLE', { message: OTP_UNAVAILABLE })
        const rows = await db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email))=? LIMIT 2').bind(message.email).all()
        if (rows.results?.length !== 1 || !await eligibleUser(db, rows.results[0].id, realm)) return
        await config.sendOTP(message)
      },
    }), ...(config.plugins ?? [])],
  })
}
