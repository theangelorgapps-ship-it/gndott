import {env} from 'cloudflare:workers'
import {getCookie, deleteCookie, getRequestHeader, getRequestUrl} from '@tanstack/react-start/server'
import bcrypt from 'bcryptjs'
import {first, all, run} from './db'
import {setSessionCookie, getSession} from './session.server'
import {AuthError, activeAccount, digest, laravelHash, loginInput, normalizeEmail, sameOrigin} from './authCore'

export const LINK_COOKIE = 'halobox_identity_link'
const INVALID_LOGIN = 'Email or password is incorrect. Please try again.'
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
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
export async function completeAccountSession(user:any) {
  if (!activeAccount(user)) throw new AuthError(INVALID_LOGIN)
  const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Viewer'
  await run(`INSERT INTO user_multi_profiles(user_id,name,is_child_profile,created_at,updated_at)
    SELECT ?,?,0,datetime('now'),datetime('now') WHERE NOT EXISTS(SELECT 1 FROM user_multi_profiles WHERE user_id=? AND deleted_at IS NULL)`,user.id,name,user.id)
  await setSessionCookie({uid:user.id,email:user.email,name})
}
export async function finishPendingIdentity(user:{id:number;email:string}) {
  const ticket = getCookie(LINK_COOKIE)
  if (!ticket) return
  const hash = await digest(ticket)
  const pending = await first<any>('SELECT * FROM auth_pending_links WHERE ticket_hash=? AND expires_at>?',hash,Math.floor(Date.now()/1000))
  deleteCookie(LINK_COOKIE,{path:'/'})
  if (!pending || pending.user_id !== user.id || pending.email !== user.email.trim().toLowerCase()) return
  // One-time consumption before binding prevents replay. A conflicting binding always fails closed.
  const taken = await first<any>('DELETE FROM auth_pending_links WHERE ticket_hash=? RETURNING *',hash)
  if (!taken) return
  const existing = await first<any>('SELECT user_id FROM auth_identities WHERE provider=? AND subject=?',pending.provider,pending.subject)
  if (existing && existing.user_id !== user.id) throw new AuthError('This sign-in provider is already linked to another account.')
  await run('INSERT INTO auth_identities(provider,subject,user_id,email_at_link) VALUES (?,?,?,?) ON CONFLICT(provider,subject) DO NOTHING',pending.provider,pending.subject,user.id,pending.email)
  await authEvent(user.id,'identity_linked',pending.provider)
}
export async function passwordLogin(input:unknown) {
  try {
    authWriteOrigin()
    const data=loginInput(input)
    await authLimit('password',data.email)
    const matches=await all<any>('SELECT id,email,first_name,last_name,password,user_type,status,is_banned,deleted_at FROM users WHERE LOWER(TRIM(email))=? LIMIT 2',data.email)
    const user=matches.length===1?matches[0]:null
    const hash=laravelHash(user?.password)
    const valid=await bcrypt.compare(data.password,hash ?? DUMMY_HASH)
    if (!valid || !hash || !activeAccount(user)) {await authEvent(null,'password_rejected');return {ok:false as const,error:INVALID_LOGIN}}
    await finishPendingIdentity(user)
    await completeAccountSession(user)
    await authEvent(user.id,'password_login')
    const profiles=await all('SELECT id,name,avatar,is_child_profile FROM user_multi_profiles WHERE user_id=? AND deleted_at IS NULL',user.id)
    return {ok:true as const,user:{id:user.id,email:user.email,name:user.first_name},profiles}
  } catch(error) {return {ok:false as const,error:authError(error)}}
}
export async function registerAccount(input:unknown) {
  try {
    authWriteOrigin()
    const data=input as any
    const email=normalizeEmail(data?.email)
    if (typeof data?.firstName!=='string'||!data.firstName.trim()||data.firstName.length>80||typeof data.lastName!=='string'||data.lastName.length>80) throw new AuthError('Enter your name (up to 80 characters per field).')
    if (typeof data.password!=='string'||data.password.length<8||new TextEncoder().encode(data.password).length>72) throw new AuthError('Use a password of at least 8 characters and no more than 72 bytes.')
    if (data.mobile && (typeof data.mobile!=='string'||!/^\+[1-9][0-9]{5,14}$/.test(data.mobile))) throw new AuthError('Enter your phone number with its international calling code.')
    await authLimit('register',email)
    if (await first('SELECT id FROM users WHERE LOWER(TRIM(email))=?',email)) throw new AuthError('An account already uses this email. Sign in to continue.')
    const hash=await bcrypt.hash(data.password,10)
    const result=await run(`INSERT INTO users(first_name,last_name,email,mobile,password,user_type,status,is_banned,is_subscribe,created_at,updated_at) VALUES (?,?,?,?,?,'user',1,0,0,datetime('now'),datetime('now'))`,data.firstName.trim(),data.lastName.trim(),email,data.mobile||null,hash)
    const user={id:result.meta.last_row_id,email,first_name:data.firstName.trim(),last_name:data.lastName.trim(),status:1,is_banned:0}
    await completeAccountSession(user);await authEvent(user.id,'registered')
    return {ok:true as const}
  }catch(error){return {ok:false as const,error:authError(error)}}
}

export async function changeAccountPassword(input:unknown) {
 try {
  authWriteOrigin()
  const session=await getSession()
  if(!session)throw new AuthError('Sign in required.')
  const data=input as {current?:unknown;next?:unknown}|null
  if(typeof data?.current!=='string'||!data.current||data.current.length>1024)throw new AuthError('Enter your current password.')
  if(typeof data.next!=='string'||data.next.length<8||new TextEncoder().encode(data.next).length>72)throw new AuthError('Use a password of at least 8 characters and no more than 72 bytes.')
  await authLimit('password-change',String(session.uid))
  const user=await first<any>('SELECT * FROM users WHERE id=?',session.uid)
  const hash=laravelHash(user?.password)
  if(!activeAccount(user)||!await bcrypt.compare(data.current,hash??DUMMY_HASH)||!hash)throw new AuthError('Current password is incorrect.')
  await run("UPDATE users SET password=?,updated_at=datetime('now') WHERE id=?",await bcrypt.hash(data.next,10),user.id)
  await completeAccountSession(user)
  await authEvent(user.id,'password_changed')
  return {ok:true as const}
 }catch(error){return {ok:false as const,error:authError(error)}}
}
