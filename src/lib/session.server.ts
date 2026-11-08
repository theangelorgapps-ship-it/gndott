import { env } from 'cloudflare:workers'
import { getCookie, setCookie, deleteCookie, getRequestUrl } from '@tanstack/react-start/server'

export const SESSION_COOKIE = 'streamit_session'
const LIFETIME = 60 * 60 * 24 * 30
async function key() {
  const secret = (env as any).SESSION_SECRET
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Session signing is not configured.')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
export async function sign(payload: object): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + LIFETIME }))
  const body = btoa(String.fromCharCode(...bytes))
  const sig = await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(body))
  return `${body}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`
}
async function verify(token: string | undefined): Promise<any | null> {
  if (!token || token.length > 8192) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    const signature = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0))
    if (!await crypto.subtle.verify('HMAC', await key(), signature, new TextEncoder().encode(parts[0]))) return null
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[0]), c => c.charCodeAt(0))))
    if (!Number.isSafeInteger(payload.exp) || payload.exp <= Date.now() / 1000) return null
    return payload
  } catch { return null }
}
export async function getSession() { return verify(getCookie(SESSION_COOKIE)) }
export async function setSessionCookie(payload: object) {
  setCookie(SESSION_COOKIE, await sign(payload), {
    httpOnly: true, secure: new URL(getRequestUrl()).protocol === 'https:',
    path: '/', maxAge: LIFETIME, sameSite: 'lax',
  })
}
export function clearSessionCookie() { deleteCookie(SESSION_COOKIE, { path: '/' }) }
