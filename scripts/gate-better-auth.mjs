import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { createHaloboxAuth, eligibleUser } from '../src/lib/better-auth-core.ts'
import { cloudflareOTPSender } from '../src/lib/auth-email.server.ts'
import { appleClientSecret } from '../src/lib/apple-client-secret.ts'

// Disposable signing key: verify Apple's JWT format and five-minute expiry offline.
const appleKey = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
const applePem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8',appleKey.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`
const appleJwt = await appleClientSecret({clientId:'halobox.example.test',teamId:'TESTTEAM',keyId:'TESTKEY',privateKey:applePem},1000)
const [appleHeader,applePayload,appleSignature] = appleJwt.split('.')
assert.deepEqual(JSON.parse(Buffer.from(appleHeader,'base64url')),{alg:'ES256',kid:'TESTKEY'})
assert.deepEqual(JSON.parse(Buffer.from(applePayload,'base64url')),{iss:'TESTTEAM',sub:'halobox.example.test',aud:'https://appleid.apple.com',iat:1000,exp:1300})
assert(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},appleKey.publicKey,Buffer.from(appleSignature,'base64url'),new TextEncoder().encode(`${appleHeader}.${applePayload}`)))

// No network transports or real addresses. A sender exists only in this test process.
const sql = new DatabaseSync(':memory:')
// Schema-only fixture captured by the read-only production preflight: no personal data.
const preflight = JSON.parse(readFileSync(new URL('../gates/better-auth/database-preflight.json', import.meta.url),'utf8'))
for (const row of preflight.flatMap(r => r.results).filter(r => r.sql)) sql.exec(row.sql)
sql.exec('CREATE TABLE subscriptions(id INTEGER PRIMARY KEY,user_id INTEGER);')
const hash = (await bcrypt.hash('Migration-test-password', 10)).replace('$2b$', '$2y$')
for (const [id,email,role,status] of [[42,'Viewer@Example.test','user',1],[88,'admin@example.test','admin',1],[99,'disabled@example.test','user',0]]) {
 sql.prepare('INSERT INTO users(id,first_name,email,password,user_type,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,'Fixture',email,hash,role,status,new Date().toISOString(),new Date().toISOString())
}
sql.prepare('INSERT INTO user_multi_profiles(id,user_id,name) VALUES (?,?,?)').run(7,42,'Existing profile')
sql.prepare('INSERT INTO subscriptions(id,user_id) VALUES (?,?)').run(13,42)
sql.exec(readFileSync(new URL('../migrations/20261108_better_auth.sql', import.meta.url),'utf8'))
// Exercise the D1 dialect, not a replacement auth implementation.
const db = {
 prepare(query) {
  const make = args => ({
   bind: (...values) => make(values),
   first: async () => sql.prepare(query).get(...args) ?? null,
   all: async () => ({results: sql.prepare(query).all(...args),success:true,meta:{}}),
   run: async () => {const r=sql.prepare(query).run(...args);return {success:true,results:[],meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}},
   raw: async () => {const q=sql.prepare(query);q.setReturnArrays(true);return q.all(...args)},
  });return make([])
 },
 batch: async queries => {const out=[];for(const q of queries)out.push(await q.all());return out},
 exec: async query => sql.exec(query),
}
const mailbox = new Map()
let mailCalls = 0
const sender = async msg => { mailCalls++; mailbox.set(msg.email,msg.otp) }
function auth(realm='viewer',sendOTP=sender) {
 return createHaloboxAuth({db,secret:'test-only-secret-with-at-least-32-characters',baseURL:`https://${realm}.example.test`,realm,sendOTP})
}
const viewer=auth(), admin=auth('admin')
// Explicit no-mail configuration (default parameter above intentionally exercises mock paths).
const noMail=createHaloboxAuth({db,secret:'test-only-secret-with-at-least-32-characters',baseURL:'https://viewer.example.test',realm:'viewer'})
async function request(a,path,body,cookie='') {
 const response=await a.handler(new Request(`${a.options.baseURL}/api/auth${path}`,{method:body===undefined?'GET':'POST',headers:{origin:a.options.baseURL,'content-type':'application/json',cookie,'cf-connecting-ip':`192.0.2.${++request.serial}`},...(body===undefined?{}:{body:JSON.stringify(body)})}))
 const result=await response.json(); return {status:response.status,result,cookie:response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')}
}
request.serial=0
assert.equal(cloudflareOTPSender({send:async()=>{throw new Error('Real send called!')}},'test@example.test'),undefined)
// Verify the transport contract without a real Cloudflare binding/network call.
const transportMessages=[]
const mockBinding={send:async message=>{transportMessages.push(message)}}
assert.equal(cloudflareOTPSender(mockBinding,'auth@example.test',false),undefined)
assert.equal(cloudflareOTPSender(undefined,'auth@example.test',true),undefined)
await cloudflareOTPSender(mockBinding,'auth@example.test',true)({email:'viewer@example.test',otp:'123456',type:'sign-in'})
assert.equal(transportMessages.length,1)
assert.equal(transportMessages[0].from,'auth@example.test')
assert.equal(transportMessages[0].to,'viewer@example.test')
assert.match(transportMessages[0].text,/123456/)
const countBefore=mailCalls
const blocked=await request(noMail,'/email-otp/send-verification-otp',{email:'viewer@example.test',type:'sign-in'})
assert.equal(blocked.status,503);assert.equal(mailCalls,countBefore)
for(const path of ['/request-password-reset','/email-otp/request-password-reset','/forget-password/email-otp','/send-verification-email']) {
 const r=await request(noMail,path,{email:'viewer@example.test',redirectTo:'/login'})
 assert.equal(r.status,503);assert.equal(mailCalls,countBefore)
}

const signed=await request(viewer,'/sign-in/email',{email:' VIEWER@example.test ',password:'Migration-test-password'})
assert.equal(signed.status,200,JSON.stringify(signed.result));assert.equal(signed.result.user.id,'42')
assert(!Object.keys(signed.result.user).some(k=>['legacyPassword','userType','status','banned','subscribed'].includes(k)))
assert.equal(sql.prepare('SELECT user_id FROM subscriptions WHERE id=13').get().user_id,42)
assert.equal(sql.prepare('SELECT user_id FROM user_multi_profiles WHERE id=7').get().user_id,42)
assert.equal((await request(viewer,'/sign-in/email',{email:'viewer@example.test',password:'Wrong-password'})).status,401)
assert.equal((await request(admin,'/sign-in/email',{email:'viewer@example.test',password:'Migration-test-password'})).status,401)
assert.equal((await request(viewer,'/sign-in/email',{email:'disabled@example.test',password:'Migration-test-password'})).status,401)
assert.equal((await request(admin,'/get-session',undefined,signed.cookie)).result,null)
assert.equal((await request(admin,'/sign-in/email',{email:'admin@example.test',password:'Migration-test-password'})).status,200)
const evil=await viewer.handler(new Request('https://viewer.example.test/api/auth/sign-in/email',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({email:'viewer@example.test',password:'Migration-test-password'})}))
assert.equal(evil.status,403)
const sent=await request(viewer,'/email-otp/send-verification-otp',{email:'viewer@example.test',type:'sign-in'})
assert.equal(sent.status,200,JSON.stringify(sent.result)); const otp=mailbox.get('viewer@example.test'); assert.match(otp,/^\d{6}$/)
assert(!JSON.stringify(sent.result).includes(otp))
assert(!sql.prepare('SELECT value FROM ba_viewer_verification').all().some(x=>x.value.includes(otp)))
const redeemed=await request(viewer,'/sign-in/email-otp',{email:'viewer@example.test',otp})
assert.equal(redeemed.status,200,JSON.stringify(redeemed.result));assert.equal(redeemed.result.user.id,'42')
assert.notEqual((await request(viewer,'/sign-in/email-otp',{email:'viewer@example.test',otp})).status,200)
await request(viewer,'/email-otp/send-verification-otp',{email:'viewer@example.test',type:'sign-in'})
const old=mailbox.get('viewer@example.test')
sql.exec("UPDATE ba_viewer_verification SET expiresAt='2000-01-01T00:00:00.000Z'")
assert.notEqual((await request(viewer,'/sign-in/email-otp',{email:'viewer@example.test',otp:old})).status,200)
await request(viewer,'/email-otp/send-verification-otp',{email:'viewer@example.test',type:'sign-in'})
const limited=mailbox.get('viewer@example.test')
for(let i=0;i<3;i++)assert.notEqual((await request(viewer,'/sign-in/email-otp',{email:'viewer@example.test',otp:limited==='000000'?'111111':'000000'})).status,200)
assert.notEqual((await request(viewer,'/sign-in/email-otp',{email:'viewer@example.test',otp:limited})).status,200)
// Concurrent attempts must consume the same code at most once (real D1 adapter).
await request(viewer,'/email-otp/send-verification-otp',{email:'viewer@example.test',type:'sign-in'})
const concurrentCode=mailbox.get('viewer@example.test')
const raced=await Promise.all([request(viewer,'/sign-in/email-otp',{email:'viewer@example.test',otp:concurrentCode}),request(viewer,'/sign-in/email-otp',{email:'viewer@example.test',otp:concurrentCode})])
assert.equal(raced.filter(r=>r.status===200).length,1,'OTP must be single-use even across concurrent requests')
const signup=await request(viewer,'/sign-up/email',{email:'new@example.test',password:'New-strong-password',name:'New',lastName:'Viewer',userType:'admin',status:1,subscribed:1,legacyPassword:'injected'})
assert.equal(signup.status,200,JSON.stringify(signup.result))
const newUser=sql.prepare('SELECT * FROM users WHERE email=?').get('new@example.test')
assert.equal(newUser.user_type,'user');assert.equal(newUser.is_subscribe,0);assert(await bcrypt.compare('New-strong-password',newUser.password))
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM user_multi_profiles WHERE user_id=?').get(newUser.id).n,1)
assert.equal((await request(admin,'/sign-up/email',{email:'intruder@example.test',password:'Strong-password',name:'Intruder'})).status,403)
sql.prepare('UPDATE users SET is_banned=1 WHERE id=42').run()
assert.equal(await eligibleUser(db,42,'viewer'),null)
assert.equal((await request(viewer,'/get-session',undefined,redeemed.cookie)).status,401)
assert.equal((await request(viewer,'/update-user',{name:'Blocked change'},redeemed.cookie)).status,401)
sql.prepare('UPDATE users SET is_banned=0 WHERE id=42').run()
await request(viewer,'/sign-out',{},signed.cookie)
assert.equal((await request(viewer,'/get-session',undefined,signed.cookie)).result,null)
const nextHash=await bcrypt.hash('Changed-by-admin',10)
sql.prepare('UPDATE users SET password=? WHERE id=42').run(nextHash)
assert.equal(sql.prepare("SELECT password FROM ba_account WHERE userId=42 AND providerId='credential'").get().password,nextHash)
assert.equal((await request(viewer,'/get-session',undefined,redeemed.cookie)).result,null)
// Changing a password through Better Auth syncs legacy hashes and revokes BOTH realms.
const adminViewer=await request(viewer,'/sign-in/email',{email:'admin@example.test',password:'Migration-test-password'})
const adminSession=await request(admin,'/sign-in/email',{email:'admin@example.test',password:'Migration-test-password'})
const wrongChange=await request(admin,'/change-password',{currentPassword:'wrong',newPassword:'New-admin-password',revokeOtherSessions:true},adminSession.cookie)
assert.notEqual(wrongChange.status,200)
const changed=await request(admin,'/change-password',{currentPassword:'Migration-test-password',newPassword:'New-admin-password',revokeOtherSessions:true},adminSession.cookie)
assert.equal(changed.status,200,JSON.stringify(changed.result))
assert(await bcrypt.compare('New-admin-password',sql.prepare('SELECT password FROM users WHERE id=88').get().password))
assert.equal((await request(viewer,'/get-session',undefined,adminViewer.cookie)).result,null)
assert.equal((await request(admin,'/get-session',undefined,adminSession.cookie)).result,null)
assert.equal((await request(admin,'/get-session',undefined,changed.cookie)).result?.user.id,'88')
assert.equal((await request(admin,'/sign-in/email',{email:'admin@example.test',password:'Migration-test-password'})).status,401)
assert.equal((await request(admin,'/sign-in/email',{email:'admin@example.test',password:'New-admin-password'})).status,200)
// Normalized email collisions abort rather than silently linking accounts.
assert.throws(()=>sql.prepare('INSERT INTO users(first_name,email,password) VALUES (?,?,?)').run('Collision','VIEWER@example.test','irrelevant'),/UNIQUE/)
// Exercise the actual Google authorization-code callback, including JWT verification.
// Only the token exchange and Google's public-key endpoint are substituted; all other
// network requests fail closed. No provider credentials or personal accounts are used.
const { generateKeyPair, exportJWK, SignJWT } = await import('jose')
const googleKey = await generateKeyPair('RS256')
const googleJwk = { ...await exportJWK(googleKey.publicKey), kid: 'fixture-google-key', alg: 'RS256', use: 'sig' }
const googleClientId = 'fixture-client.apps.googleusercontent.com'
const fixtureProfiles = new Map()
const realFetch = globalThis.fetch
let exchanges = 0
globalThis.fetch = async (input, init) => {
 const req = new Request(input, init)
 const url = new URL(req.url)
 if (url.origin === 'https://www.googleapis.com' && url.pathname === '/oauth2/v3/certs') return Response.json({ keys: [googleJwk] })
 if (url.origin === 'https://oauth2.googleapis.com' && url.pathname === '/token') {
  exchanges++
  const code = new URLSearchParams(await req.text()).get('code')
  const profile = fixtureProfiles.get(code)
  assert(profile, 'Unknown synthetic OAuth code')
  let jwt = await new SignJWT(profile).setProtectedHeader({ alg: 'RS256', kid: googleJwk.kid }).setIssuer(code === 'wrong-issuer' ? 'https://other.example.test' : 'https://accounts.google.com').setAudience(code === 'wrong-audience' ? 'another-client' : googleClientId).setIssuedAt().setExpirationTime(code === 'expired-token' ? Math.floor(Date.now() / 1000) - 3600 : '5m').sign(googleKey.privateKey)
  if (code === 'bad-signature') { const parts = jwt.split('.'); parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1); jwt = parts.join('.') }
  return Response.json({ access_token: 'fixture-access-token', token_type: 'Bearer', expires_in: 300, id_token: jwt, scope: 'openid email profile' })
 }
 throw new Error(`Unexpected network request in offline auth test: ${url.origin}${url.pathname}`)
}
try {
 const googleAuth = realm => createHaloboxAuth({ db, secret: 'test-only-secret-with-at-least-32-characters', baseURL: `https://${realm}.example.test`, realm, sendOTP: sender,
  socialProviders: { google: { clientId: googleClientId, clientSecret: 'fixture-only-secret' } },
 })
 const googleViewer = googleAuth('viewer'), googleAdmin = googleAuth('admin')
 const oauthMailBefore = mailCalls
 const fixture = (id, email, role = 'user', status = 1, banned = 0) => {
  sql.prepare('INSERT INTO users(id,first_name,email,password,user_type,status,is_banned,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id, 'Migrated fixture', email, hash, role, status, banned, new Date().toISOString(), new Date().toISOString())
 }
 fixture(240, 'halobox-fixture@gmail.com')
 fixture(241, 'third-party@example.test')
 fixture(242, 'unverified-fixture@gmail.com')
 fixture(243, 'workspace@example.test')
 fixture(244, 'admin-fixture@gmail.com', 'admin')
 fixture(245, 'disabled-fixture@gmail.com', 'user', 0)
 fixture(246, 'banned-fixture@gmail.com', 'user', 1, 1)
 fixture(247, 'bad-token-fixture@gmail.com')
 sql.prepare('INSERT INTO user_multi_profiles(id,user_id,name) VALUES (?,?,?)').run(240, 240, 'Keep profile')
 sql.prepare('INSERT INTO subscriptions(id,user_id) VALUES (?,?)').run(240, 240)
 const usersBefore = sql.prepare('SELECT COUNT(*) AS n FROM users').get().n
 const callback = async (auth, code, profile, cookie = '', explicit = false) => {
  fixtureProfiles.set(code, { sub: `subject-${profile.email}`, name: 'Provider name must not replace migrated name', ...profile })
  const started = await request(auth, explicit ? '/link-social' : '/sign-in/social', { provider: 'google', callbackURL: '/manage-profile', errorCallbackURL: '/login?auth=failed', disableRedirect: true }, cookie)
  assert.equal(started.status, 200, JSON.stringify(started.result))
  const state = new URL(started.result.url).searchParams.get('state')
  assert(state)
  return auth.handler(new Request(`${auth.options.baseURL}/api/auth/callback/google?code=${code}&state=${encodeURIComponent(state)}`, { headers: { cookie: [cookie, started.cookie].filter(Boolean).join('; '), 'cf-connecting-ip': `192.0.2.${++request.serial}` } }))
 }
 const linked = await callback(googleViewer, 'migrated-gmail', { email: 'halobox-fixture@gmail.com', email_verified: true })
 assert.equal(linked.headers.get('location'), '/manage-profile', 'Verified Google Gmail must sign in to the migrated account')
 const linkedCookie = linked.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
 assert.equal((await request(googleViewer, '/get-session', undefined, linkedCookie)).result?.user.id, '240')
 assert.equal(sql.prepare("SELECT userId FROM ba_account WHERE providerId='google' AND accountId=?").get('subject-halobox-fixture@gmail.com').userId, 240)
 assert.equal(sql.prepare('SELECT auth_email_verified FROM users WHERE id=240').get().auth_email_verified, 1)
 assert.equal(sql.prepare('SELECT first_name FROM users WHERE id=240').get().first_name, 'Migrated fixture')
 assert.equal(sql.prepare('SELECT user_id FROM user_multi_profiles WHERE id=240').get().user_id, 240)
 assert.equal(sql.prepare('SELECT user_id FROM subscriptions WHERE id=240').get().user_id, 240)
 assert.equal((await request(googleViewer, '/sign-in/email', { email: 'halobox-fixture@gmail.com', password: 'Migration-test-password' })).status, 200)
 assert.equal((await request(googleAdmin, '/get-session', undefined, linkedCookie)).result, null)
 assert.equal((await callback(googleViewer, 'returning-gmail', { email: 'halobox-fixture@gmail.com', email_verified: true })).headers.get('location'), '/manage-profile')
 assert.equal((await callback(googleViewer, 'workspace', { email: 'workspace@example.test', email_verified: true, hd: 'example.test' })).headers.get('location'), '/manage-profile')
 for (const [code, id, email, verified, realm] of [
  ['external-email', 241, 'third-party@example.test', true, googleViewer],
  ['unverified', 242, 'unverified-fixture@gmail.com', false, googleViewer],
  ['admin-via-viewer', 244, 'admin-fixture@gmail.com', true, googleViewer],
  ['admin-implicit', 244, 'admin-fixture@gmail.com', true, googleAdmin],
  ['disabled', 245, 'disabled-fixture@gmail.com', true, googleViewer],
  ['banned', 246, 'banned-fixture@gmail.com', true, googleViewer],
  ['wrong-audience', 247, 'bad-token-fixture@gmail.com', true, googleViewer],
  ['wrong-issuer', 247, 'bad-token-fixture@gmail.com', true, googleViewer],
  ['expired-token', 247, 'bad-token-fixture@gmail.com', true, googleViewer],
  ['bad-signature', 247, 'bad-token-fixture@gmail.com', true, googleViewer],
 ]) {
  const denied = await callback(realm, code, { email, email_verified: verified })
  assert.notEqual(denied.headers.get('location'), '/manage-profile', code)
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM ba_account WHERE userId=? AND providerId='google'").get(id).n, 0, code)
 }
 // Password-authenticated linking remains available for third-party addresses.
 const passwordSession = await request(googleViewer, '/sign-in/email', { email: 'third-party@example.test', password: 'Migration-test-password' })
 assert.equal(passwordSession.status, 200)
 assert.equal((await callback(googleViewer, 'explicit-link', { email: 'third-party@example.test', email_verified: true }, passwordSession.cookie, true)).headers.get('location'), '/manage-profile')
 const adminPassword = await request(googleAdmin, '/sign-in/email', { email: 'admin-fixture@gmail.com', password: 'Migration-test-password' })
 assert.equal(adminPassword.status, 200)
 assert.equal((await callback(googleAdmin, 'admin-explicit', { email: 'admin-fixture@gmail.com', email_verified: true }, adminPassword.cookie, true)).headers.get('location'), '/manage-profile')
 // Forged or stale state must fail before token exchange.
 const exchangesBefore = exchanges
 const badState = await googleViewer.handler(new Request('https://viewer.example.test/api/auth/callback/google?code=migrated-gmail&state=forged'))
 assert.notEqual(badState.headers.get('location'), '/manage-profile')
 assert.equal(exchanges, exchangesBefore)
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM users').get().n, usersBefore)
 assert.equal(mailCalls, oauthMailBefore, 'OAuth must not trigger email delivery')
 console.log('GOOGLE_LINKING_GATES_PASS: signed callbacks, preserved ownership, repeat sign-in, explicit linking, unverified/external/admin/disabled/invalid-token rejection, no duplicates or emails')
} finally { globalThis.fetch = realFetch }
console.log('BETTER_AUTH_GATES_PASS: migrated identity, password, OTP expiry/replay/attempts, role isolation, CSRF, profile ownership, logout, password sync, zero outbound emails')
// Recovery uses a separate purpose, never creates users, and revokes both realms.
const recoverEmail = 'recovery-admin@example.test'
sql.prepare('INSERT INTO users(id,first_name,email,password,user_type,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(500,'Recovery',recoverEmail,hash,'admin',1,new Date().toISOString(),new Date().toISOString())
const recoveryViewer = await request(viewer,'/sign-in/email',{email:recoverEmail,password:'Migration-test-password'})
const recoveryAdmin = await request(admin,'/sign-in/email',{email:recoverEmail,password:'Migration-test-password'})
const resetRequest = await request(admin,'/email-otp/request-password-reset',{email:recoverEmail})
assert.equal(resetRequest.status,200,JSON.stringify(resetRequest.result))
const resetOTP=mailbox.get(recoverEmail)
assert(!JSON.stringify(resetRequest.result).includes(resetOTP))
assert(!sql.prepare('SELECT value FROM ba_admin_verification').all().some(x=>x.value.includes(resetOTP)))
assert.notEqual((await request(viewer,'/email-otp/reset-password',{email:recoverEmail,otp:resetOTP,password:'New-recovery-password'})).status,200,'Reset challenge must not cross realms')
const resetResult=await request(admin,'/email-otp/reset-password',{email:recoverEmail,otp:resetOTP,password:'New-recovery-password'})
assert.equal(resetResult.status,200,JSON.stringify(resetResult.result))
assert.equal((await request(admin,'/get-session',undefined,recoveryAdmin.cookie)).result,null)
assert.equal((await request(viewer,'/get-session',undefined,recoveryViewer.cookie)).result,null)
assert.notEqual((await request(admin,'/email-otp/reset-password',{email:recoverEmail,otp:resetOTP,password:'Replay-password'})).status,200)
assert.equal((await request(admin,'/sign-in/email',{email:recoverEmail,password:'New-recovery-password'})).status,200)
assert.equal(sql.prepare('SELECT user_type FROM users WHERE id=500').get().user_type,'admin')
await request(admin,'/email-otp/request-password-reset',{email:recoverEmail})
const bannedReset=mailbox.get(recoverEmail)
sql.prepare('UPDATE users SET is_banned=1 WHERE id=500').run()
assert.equal((await request(admin,'/email-otp/reset-password',{email:recoverEmail,otp:bannedReset,password:'Banned-reset-password'})).status,401,'Eligibility is checked again at reset redemption')
const beforeUnknownMail=mailCalls
assert.equal((await request(viewer,'/email-otp/request-password-reset',{email:'unknown-recovery@example.test'})).status,200)
assert.equal(mailCalls,beforeUnknownMail,'Unknown email recovery has a generic response and no delivery')
for(let i=0;i<12;i++) assert.equal((await request(viewer,'/email-otp/request-password-reset',{email:'rate-recovery@example.test'})).status,200)
assert.equal((await request(viewer,'/email-otp/request-password-reset',{email:'rate-recovery@example.test'})).status,429,'Recovery is limited per email even when IP changes')
assert.equal((await request(viewer,'/email-otp/send-verification-otp',{email:'rate-recovery@example.test',type:'sign-in'})).status,429,'Alternate send endpoint cannot bypass recipient limit')
const unavailableBefore=sql.prepare('SELECT COUNT(*) n FROM ba_viewer_verification').get().n
assert.equal((await request(noMail,'/forget-password/email-otp',{email:'viewer@example.test'})).status,503)
assert.equal(sql.prepare('SELECT COUNT(*) n FROM ba_viewer_verification').get().n,unavailableBefore,'Disabled legacy recovery cannot create a challenge')
const evilRecovery=await admin.handler(new Request('https://admin.example.test/api/auth/email-otp/request-password-reset',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({email:recoverEmail})}))
assert.equal(evilRecovery.status,403)
await cloudflareOTPSender(mockBinding,'auth@example.test',true)({email:recoverEmail,otp:'123456',type:'forget-password'})
assert.match(transportMessages.at(-1).subject,/password reset/)
assert.match(transportMessages.at(-1).text,/password reset/)
console.log('RECOVERY_GATES_PASS: hashed purpose/realm-bound OTP, recovery replay and banned-account rejection, both-realm revocation, recipient limits, generic unknown response, disabled legacy route, CSRF, mock-only delivery')
sql.close()
