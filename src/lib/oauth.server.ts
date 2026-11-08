import {env} from 'cloudflare:workers'
import {getCookie, setCookie, deleteCookie} from '@tanstack/react-start/server'
import {all, first, run} from './db'
import {getSession} from './session.server'
import {AuthError, activeAccount, base64url, digest, randomToken, verifiedEmail, verifyIdentityToken, type AuthProvider, type IdentityClaims} from './authCore'
import {authLimit, authEvent, completeAccountSession, LINK_COOKIE} from './auth.server'

const PROVIDERS={
 google:{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',keys:'https://www.googleapis.com/oauth2/v3/certs',scope:'openid email profile'},
 apple:{authorize:'https://appleid.apple.com/auth/authorize',token:'https://appleid.apple.com/auth/token',keys:'https://appleid.apple.com/auth/keys',scope:'name email'},
} as const
const STATE_COOKIE='halobox_oauth_browser'
const keyCache=new Map<AuthProvider,{keys:JsonWebKey[];until:number}>()
export function providerName(value:unknown):AuthProvider {if(value!=='google'&&value!=='apple')throw new AuthError('Choose Google or Apple.');return value}
async function setting(name:string) {return (await first<{val:string}>('SELECT val FROM settings WHERE name=?',name))?.val?.trim() || ''}
export async function socialConfiguration() {
 const bindings=env as any
 const googleClientId=String(bindings.GOOGLE_CLIENT_ID||await setting('google_client_id'))
 const appleClientId=String(bindings.APPLE_CLIENT_ID||await setting('apple_client_id'))
 return {
  googleClientId, appleClientId,
  googleEnabled:bindings.GOOGLE_AUTH_ENABLED==='1'&&!!(googleClientId&&bindings.GOOGLE_CLIENT_SECRET),
  appleEnabled:bindings.APPLE_AUTH_ENABLED==='1'&&!!(appleClientId&&(bindings.APPLE_CLIENT_SECRET||(bindings.APPLE_TEAM_ID&&bindings.APPLE_KEY_ID&&bindings.APPLE_PRIVATE_KEY))),
 }
}
function origin() {
 const url=new URL(String((env as any).AUTH_ORIGIN||'https://gndott.theangelorgapps.workers.dev'))
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new AuthError('Sign-in is not configured.')
 return url.origin
}
async function appleSecret(clientId:string) {
 const bindings=env as any
 if(bindings.APPLE_CLIENT_SECRET)return String(bindings.APPLE_CLIENT_SECRET)
 const now=Math.floor(Date.now()/1000)
 const head=base64url(new TextEncoder().encode(JSON.stringify({alg:'ES256',kid:bindings.APPLE_KEY_ID,typ:'JWT'})))
 const body=base64url(new TextEncoder().encode(JSON.stringify({iss:bindings.APPLE_TEAM_ID,iat:now,exp:now+300,aud:'https://appleid.apple.com',sub:clientId})))
 const pem=String(bindings.APPLE_PRIVATE_KEY||'').replace(/-----[^-]+-----/g,'').replace(/\s/g,'')
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'ECDSA',namedCurve:'P-256'},false,['sign'])
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(`${head}.${body}`))
 return `${head}.${body}.${base64url(new Uint8Array(signature))}`
}
async function configuration(provider:AuthProvider) {
 const config=await socialConfiguration()
 if(!(provider==='google'?config.googleEnabled:config.appleEnabled))throw new AuthError('This sign-in provider is not configured yet.')
 const clientId=provider==='google'?config.googleClientId:config.appleClientId
 return {clientId,secret:provider==='google'?String((env as any).GOOGLE_CLIENT_SECRET):await appleSecret(clientId)}
}
function redirect(path:string) {return new Response(null,{status:303,headers:{Location:new URL(path,origin()).href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}
async function fetchJson(url:string,init:RequestInit={}) {
 const response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(10000)})
 if(!response.ok)throw new AuthError('The sign-in provider could not complete this request.')
 const content=await response.text()
 if(content.length>100000)throw new AuthError('Invalid sign-in response.')
 return JSON.parse(content)
}
async function providerKeys(provider:AuthProvider,force=false) {
 const cached=keyCache.get(provider)
 if(!force&&cached&&cached.until>Date.now())return cached.keys
 const result=await fetchJson(PROVIDERS[provider].keys)
 if(!Array.isArray(result.keys)||result.keys.length>20)throw new AuthError('Invalid provider signing keys.')
 keyCache.set(provider,{keys:result.keys,until:Date.now()+3600000})
 return result.keys as JsonWebKey[]
}
export async function startSocialSignIn(request:Request,value:unknown) {
 try{
  const provider=providerName(value)
  if(new URL(request.url).origin!==origin()||request.headers.get('sec-fetch-site')==='cross-site')throw new AuthError('Open sign-in from the Halobox website.')
  await authLimit('oauth-start','',request)
  const {clientId}=await configuration(provider)
  deleteCookie(LINK_COOKIE,{path:'/'})
  const state=randomToken(),browser=randomToken(),nonce=randomToken(),verifier=randomToken()
  const now=Math.floor(Date.now()/1000)
  await run('DELETE FROM auth_challenges WHERE expires_at<?',now)
  await run('DELETE FROM auth_pending_links WHERE expires_at<?',now)
  await run('INSERT INTO auth_challenges(state_hash,browser_hash,provider,nonce,verifier,expires_at) VALUES (?,?,?,?,?,?)',await digest(state),await digest(browser),provider,nonce,provider==='google'?verifier:null,now+600)
  // Apple's form_post is a cross-site POST; SameSite=None is required, with Secure and state+nonce binding.
  setCookie(STATE_COOKIE,browser,{httpOnly:true,secure:true,sameSite:'none',path:'/auth',maxAge:600})
  const url=new URL(PROVIDERS[provider].authorize)
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:`${origin()}/auth/${provider}/callback`,response_type:'code',scope:PROVIDERS[provider].scope,state,nonce,...(provider==='google'?{code_challenge:await digest(verifier),code_challenge_method:'S256',prompt:'select_account'}:{response_mode:'form_post'})}).toString()
  return new Response(null,{status:302,headers:{Location:url.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
 }catch(error){return redirect(`/login?auth=${error instanceof AuthError&&error.message.includes('not configured')?'not-configured':'failed'}`)}
}
async function resolveIdentity(provider:AuthProvider,claims:IdentityClaims) {
 const identities=await all<any>(`SELECT u.* FROM auth_identities i JOIN users u ON u.id=i.user_id WHERE i.provider=? AND i.subject=?`,provider,claims.sub)
 if(identities.length===1){if(!activeAccount(identities[0]))throw new AuthError('This account is unavailable.');return identities[0]}
 if(identities.length>1)throw new AuthError('This account needs support.')
 // Preserve a provider's previously migrated immutable ID when one exists.
 const legacy=await all<any>('SELECT u.* FROM user_providers p JOIN users u ON u.id=p.user_id WHERE LOWER(p.provider)=? AND p.provider_id=?',provider,claims.sub)
 if(legacy.length===1&&activeAccount(legacy[0])) {
  await run('INSERT INTO auth_identities(provider,subject,user_id,email_at_link) VALUES (?,?,?,?)',provider,claims.sub,legacy[0].id,legacy[0].email)
  return legacy[0]
 }
 if(legacy.length)throw new AuthError('This account is unavailable.')
 if(!verifiedEmail(claims))throw new AuthError('A verified email address is required.')
 const email=claims.email!
 const existing=await all<any>('SELECT * FROM users WHERE LOWER(TRIM(email))=? LIMIT 2',email)
 if(existing.length>1)throw new AuthError('This account needs support.')
 if(existing.length===1) {
  const user=existing[0]
  if(!activeAccount(user))throw new AuthError('This account is unavailable.')
  const session=await getSession()
  if(session?.uid===user.id) {
   await run('INSERT INTO auth_identities(provider,subject,user_id,email_at_link) VALUES (?,?,?,?)',provider,claims.sub,user.id,email)
   await authEvent(user.id,'identity_linked',provider)
   return user
  }
  // A matching email alone must not take ownership of a migrated account. Ask for its password once.
  const ticket=randomToken()
  await run('INSERT INTO auth_pending_links(ticket_hash,provider,subject,email,user_id,expires_at) VALUES (?,?,?,?,?,?)',await digest(ticket),provider,claims.sub,email,user.id,Math.floor(Date.now()/1000)+600)
  setCookie(LINK_COOKIE,ticket,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600})
  return null
 }
 const firstName=typeof claims.given_name==='string'?claims.given_name.slice(0,80):'Viewer'
 const lastName=typeof claims.family_name==='string'?claims.family_name.slice(0,80):''
 const db=(env as any).DB
 // Both insertions succeed together; a uniqueness failure cannot leave an orphaned social account.
 await db.batch([
  db.prepare(`INSERT INTO users(first_name,last_name,email,password,user_type,status,is_banned,is_subscribe,login_type,created_at,updated_at) VALUES (?,?,?,'','user',1,0,0,?,datetime('now'),datetime('now'))`).bind(firstName,lastName,email,provider),
  db.prepare('INSERT INTO auth_identities(provider,subject,user_id,email_at_link) VALUES (?,?,(SELECT id FROM users WHERE email=?),?)').bind(provider,claims.sub,email,email),
 ])
 return first<any>('SELECT * FROM users WHERE email=?',email)
}
export async function finishSocialSignIn(request:Request,value:unknown) {
 try{
  const provider=providerName(value)
  if(new URL(request.url).origin!==origin())throw new AuthError('Invalid callback address.')
  await authLimit('oauth-callback','',request)
  if(Number(request.headers.get('content-length')||0)>20000)throw new AuthError('Invalid sign-in response.')
  let body=''
  if(request.method==='POST'){
   const reader=request.body?.getReader();if(!reader)throw new AuthError('Invalid sign-in response.')
   const decoder=new TextDecoder();let size=0
   for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>20000){await reader.cancel();throw new AuthError('Invalid sign-in response.')};body+=decoder.decode(chunk.value,{stream:true})}
   body+=decoder.decode()
  }
  const params=request.method==='POST'?new URLSearchParams(body):new URL(request.url).searchParams
  const state=params.get('state'),browser=getCookie(STATE_COOKIE)
  if(!state||state.length>128||!browser||browser.length>128)throw new AuthError('The sign-in session expired.')
  const challenge=await first<any>('UPDATE auth_challenges SET used=1 WHERE state_hash=? AND browser_hash=? AND provider=? AND used=0 AND expires_at>? RETURNING *',await digest(state),await digest(browser),provider,Math.floor(Date.now()/1000))
  if(!challenge)throw new AuthError('The sign-in session expired.')
  deleteCookie(STATE_COOKIE,{path:'/auth'})
  if(params.has('error'))return redirect('/login?auth=cancelled')
  const code=params.get('code')
  if(!code||code.length>4096)throw new AuthError('Invalid sign-in response.')
  const {clientId,secret}=await configuration(provider)
  const tokens=await fetchJson(PROVIDERS[provider].token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:clientId,client_secret:secret,redirect_uri:`${origin()}/auth/${provider}/callback`,...(challenge.verifier?{code_verifier:challenge.verifier}:{})}).toString()})
  let claims:IdentityClaims
  try{claims=await verifyIdentityToken(tokens.id_token,provider,clientId,challenge.nonce,await providerKeys(provider))}
  catch{claims=await verifyIdentityToken(tokens.id_token,provider,clientId,challenge.nonce,await providerKeys(provider,true))}
  const user=await resolveIdentity(provider,claims)
  if(!user)return redirect('/login?auth=link-required')
  await completeAccountSession(user)
  await authEvent(user.id,'social_login',provider)
  return redirect('/manage-profile')
 }catch{return redirect('/login?auth=failed')}
}
