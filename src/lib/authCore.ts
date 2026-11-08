/** Authentication primitives shared by the production handlers and offline security tests. */
export type AuthProvider = 'google' | 'apple'
export class AuthError extends Error {}
export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new AuthError('Enter a valid email address.')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('Enter a valid email address.')
  return email
}
export function loginInput(value: unknown) {
  const data = value as {email?: unknown; password?: unknown} | null
  const email = normalizeEmail(data?.email)
  if (typeof data?.password !== 'string' || !data.password || data.password.length > 1024) throw new AuthError('Enter your password.')
  return {email, password: data.password}
}
export function activeAccount(user: {status?: unknown; is_banned?: unknown; deleted_at?: unknown} | null | undefined) {
  return !!user && Number(user.status) === 1 && Number(user.is_banned ?? 0) === 0 && !user.deleted_at
}
export function laravelHash(hash: unknown): string | null {
  if (typeof hash !== 'string' || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) return null
  return hash.replace(/^\$2y\$/, '$2b$')
}
export function base64url(value: Uint8Array): string { return btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '') }
export function unbase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[\w-]+$/.test(value)) throw new AuthError('Invalid sign-in response.')
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0))
}
export function randomToken() { return base64url(crypto.getRandomValues(new Uint8Array(32))) }
export async function digest(value: string) { return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))) }
export function sameOrigin(requestUrl: string, origin?: string | null, site?: string | null) {
  const url = new URL(requestUrl)
  if (origin !== url.origin || site === 'cross-site') throw new AuthError('Refresh this page and try again.')
  return url.origin
}
export type IdentityClaims = {sub:string; email?:string; email_verified?:boolean|string; iss:string; aud:string|string[]; azp?:string; exp:number; iat:number; nonce:string; name?:string; given_name?:string; family_name?:string}
export async function verifyIdentityToken(token: string, provider: AuthProvider, clientId: string, nonce: string, keys: JsonWebKey[], now = Date.now() / 1000): Promise<IdentityClaims> {
  if (typeof token !== 'string' || token.length > 16384) throw new AuthError('Invalid sign-in response.')
  try {
    const parts = token.split('.')
    if (parts.length !== 3) throw Error()
    const header = JSON.parse(new TextDecoder().decode(unbase64url(parts[0])))
    const claims: IdentityClaims = JSON.parse(new TextDecoder().decode(unbase64url(parts[1])))
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit || header.jku || header.x5u) throw Error()
    const jwk = keys.find(key => (key as JsonWebKey & {kid?:string}).kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig') && (!key.alg || key.alg === 'RS256'))
    if (!jwk) throw Error()
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify'])
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,unbase64url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw Error()
    const issuers = provider === 'google' ? ['https://accounts.google.com','accounts.google.com'] : ['https://appleid.apple.com']
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!issuers.includes(claims.iss) || !audiences.includes(clientId) || (audiences.length > 1 && claims.azp !== clientId) || (claims.azp && claims.azp !== clientId)) throw Error()
    if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 || claims.iat < now - 3600) throw Error()
    if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 || typeof nonce !== 'string' || nonce.length < 32 || claims.nonce !== nonce) throw Error()
    if (claims.email) claims.email = normalizeEmail(claims.email)
    return claims
  } catch { throw new AuthError('The sign-in response could not be verified. Please try again.') }
}
export function verifiedEmail(claims: IdentityClaims) {
  return !!claims.email && (claims.email_verified === true || claims.email_verified === 'true')
}
