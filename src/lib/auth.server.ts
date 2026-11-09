import {env} from 'cloudflare:workers'
import {getRequestHeader, getRequestUrl} from '@tanstack/react-start/server'
import {first, all, run} from './db'
import {AuthError, digest, loginInput, normalizeEmail, sameOrigin} from './authCore'

export const LINK_COOKIE = 'halobox_identity_link'
const INVALID_LOGIN = 'Email or password is incorrect. Please try again.'
export function authWriteOrigin() {
  return sameOrigin(String(getRequestUrl()), getRequestHeader('origin'), getRequestHeader('sec-fetch-site'))
}
export function authError(error: unknown) { return error instanceof AuthError ? error.message : 'Sign-in is temporarily unavailable. Please try again.' }
export async function authLimit(action: string, account = '', request?: Request) {
  const now = Math.floor(Date.now()/1000), window = Math.floor(now/600)
  const ip = request?.headers.get('cf-connecting-ip') ?? getRequestHeader('cf-connecting-ip') ?? 'local'
  // No account addresses or IPs are stored. The per-installation salt prevents a dictionary lookup.
  const salt = String((env as any).SESSION_SECRET || '')
  if (salt.length < 32) throw new AuthError('Sign-in is temporarily unavailable.')
  for (const [scope, value, maximum] of [['ip', ip, 60], ...(account ? [['account', account, 12]] : [])] as [string,string,number][]) {
    const bucket = await digest(`${salt}:${action}:${scope}:${value}:${window}`)
    const result = await first<{count:number}>(`INSERT INTO auth_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count`,bucket,(window+1)*600)
    if (!result || result.count > maximum) throw new AuthError('Too many sign-in attempts. Please wait 10 minutes and try again.')
  }
  // Bounded cleanup; no unbounded history of authentication attempts.
  await run('DELETE FROM auth_limits WHERE bucket IN (SELECT bucket FROM auth_limits WHERE expires_at < ? LIMIT 100)',now)
}
export async function authEvent(userId:number|null,event:string,provider?:string) {
  await run('INSERT INTO auth_events(user_id,event,provider) VALUES (?,?,?)',userId,event,provider ?? null)
}
// Better Auth is the only session issuer. Legacy callbacks are retired below.
export async function completeAccountSession(_user: unknown): Promise<never> {
  throw new AuthError('Please sign in again using the current sign-in page.')
}
export async function finishPendingIdentity(_user: unknown) {}

async function profilesFor(id: number) {
  await run(`INSERT INTO user_multi_profiles(user_id,name,is_child_profile,created_at,updated_at)
    SELECT id,COALESCE(first_name,'Viewer'),0,datetime('now'),datetime('now') FROM users
    WHERE id=? AND NOT EXISTS(SELECT 1 FROM user_multi_profiles WHERE user_id=? AND deleted_at IS NULL)`,id,id)
  return all('SELECT id,name,avatar,is_child_profile FROM user_multi_profiles WHERE user_id=? AND deleted_at IS NULL',id)
}
export async function passwordLogin(input: unknown) {
  try {
    authWriteOrigin()
    const data = loginInput(input)
    await authLimit('password', data.email)
    const { getAuth } = await import('./better-auth.server')
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const result = await getAuth().api.signInEmail({ body: data, headers: getRequestHeaders() })
    const id = Number(result.user.id)
    return { ok: true as const, user: { id, email: result.user.email, name: result.user.name }, profiles: await profilesFor(id), token: result.token ?? null }
  } catch { return { ok: false as const, error: INVALID_LOGIN } }
}
export async function registerAccount(input: unknown) {
  try {
    authWriteOrigin()
    const data = input as any
    const email = normalizeEmail(data?.email)
    await authLimit('register', email)
    const { getAuth } = await import('./better-auth.server')
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const result = await getAuth().api.signUpEmail({ headers: getRequestHeaders(), body: { name: data.firstName, lastName: data.lastName, email, password: data.password, mobile: data.mobile || undefined } })
    return { ok: true as const, token: (result as any)?.token ?? null }
  } catch { return { ok: false as const, error: 'Could not create your account. Check your details or sign in if you already have an account.' } }
}
export async function changeAccountPassword(input: unknown) {
  try {
    authWriteOrigin()
    const data = input as { current: string; next: string }
    const { getAuth } = await import('./better-auth.server')
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    await getAuth().api.changePassword({ headers: getRequestHeaders(), body: { currentPassword: data.current, newPassword: data.next, revokeOtherSessions: true } })
    return { ok: true as const }
  } catch { return { ok: false as const, error: 'Could not change your password. Check your current password and use at least 8 characters.' } }
}
export async function requestEmailOtp(contact: string) {
  try {
    authWriteOrigin()
    const email = normalizeEmail(contact)
    const { getAuth } = await import('./better-auth.server')
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    await authLimit('email-otp', email)
    await getAuth().api.sendVerificationOTP({ headers: getRequestHeaders(), body: { email, type: 'sign-in' } })
    return { ok: true as const }
  } catch (error) { return { ok: false as const, error: (error as { status?: string }).status === 'SERVICE_UNAVAILABLE' ? 'Email sign-in is not enabled yet. Please use your password.' : 'Unable to request a code. Please try again later.' } }
}
export async function verifyEmailOtp(contact: string, code: string) {
  try {
    authWriteOrigin()
    const email = normalizeEmail(contact)
    await authLimit('verify-otp', email)
    const { getAuth } = await import('./better-auth.server')
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const result = await getAuth().api.signInEmailOTP({ headers: getRequestHeaders(), body: { email, otp: code } })
    await profilesFor(Number(result.user.id))
    return { ok: true as const, token: (result as { token?: string | null }).token ?? null }
  } catch { return { ok: false as const, error: 'The code is invalid or expired. Request another code.' } }
}
