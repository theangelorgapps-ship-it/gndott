import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'

export const SESSION_COOKIE = 'streamit_session'
const SECRET = 'streamit-d1-local-dev-secret'

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export async function sign(payload: object): Promise<string> {
  const body = btoa(JSON.stringify(payload))
  return `${body}.${await hmac(body)}`
}

async function verify(token: string | undefined): Promise<any | null> {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  if ((await hmac(body)) !== sig) return null
  try {
    return JSON.parse(atob(body))
  } catch {
    return null
  }
}

export async function getSession() {
  return verify(getCookie(SESSION_COOKIE))
}

export async function setSessionCookie(payload: object) {
  setCookie(SESSION_COOKIE, await sign(payload), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, { path: '/' })
}
