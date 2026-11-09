import { env } from 'cloudflare:workers'
import { deleteCookie, getRequest, getRequestHeaders } from '@tanstack/react-start/server'
import { getAuth, AUTH_REALM } from './better-auth.server'
import { eligibleUser } from './better-auth-core'
import { sameOrigin } from './authCore'

function protectSessionWrite() {
  const request = getRequest()
  if (!['GET', 'HEAD'].includes(request.method)) sameOrigin(request.url, request.headers.get('origin'), request.headers.get('sec-fetch-site'))
}

// Legacy cookies no longer authenticate. Better Auth owns signed, revocable sessions.
export const SESSION_COOKIE = '__Secure-halobox-viewer.session_token'
export async function getSession() {
  protectSessionWrite()
  const result = await getAuth().api.getSession({ headers: getRequestHeaders() }).catch(() => null)
  if (!result) return null
  const user = await eligibleUser((env as any).DB, result.user.id, AUTH_REALM)
  if (!user) return null
  // Better Auth omits fields marked returned:false even from api.getSession().
  // Read this private field only after validating the session and its owner.
  const stored = await (env as any).DB.prepare('SELECT profileId FROM ba_viewer_session WHERE id=? AND userId=?').bind(result.session.id, user.id).first()
  return { uid: Number(user.id), email: String(user.email), name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(), pid: stored?.profileId as number | undefined, sessionId: result.session.id }
}
/** Profile switching updates an existing authenticated session, never creates one. */
export async function setSessionCookie(payload: { uid: number; pid?: number }) {
  const current = await getSession()
  if (!current || current.uid !== payload.uid || !Number.isSafeInteger(payload.pid)) throw new Error('Sign in again to choose a profile.')
  const db = (env as any).DB
  const profile = await db.prepare('SELECT id FROM user_multi_profiles WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(payload.pid, current.uid).first()
  if (!profile) throw new Error('Choose a profile belonging to your account.')
  await db.prepare('UPDATE ba_viewer_session SET profileId=? WHERE id=? AND userId=?').bind(payload.pid, current.sessionId, current.uid).run()
}
export async function clearSessionCookie() {
  protectSessionWrite()
  await getAuth().api.signOut({ headers: getRequestHeaders() })
  deleteCookie('streamit_session', { path: '/' })
}
