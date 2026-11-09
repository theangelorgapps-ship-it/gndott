#!/usr/bin/env node
// Execute the production auth code against disposable SQLite, signed fixture tokens and a fake provider.
// No browser, external provider, production DB or real credentials are used.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {webcrypto} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'
import bcrypt from 'bcryptjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const read=file=>readFileSync(resolve(root,file),'utf8')
const prod='https://gndott.theangelorgapps.workers.dev',env={},cookies=new Map(),cookieOptions=new Map(),headers={}
let requestUrl=prod+'/login',transport
function load(file,imports={}) {
 const module={exports:{}}
 const compiled=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 vm.runInNewContext(compiled,{module,exports:module.exports,require:name=>{if(!(name in imports))throw Error(`Unexpected import ${name}`);return imports[name]},URL,URLSearchParams,Request,Response,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortSignal,crypto:webcrypto,btoa,atob,fetch:(...args)=>transport(...args),console})
 return module.exports
}
const context={getCookie:key=>cookies.get(key),setCookie:(key,value,options)=>{cookies.set(key,value);cookieOptions.set(key,options)},deleteCookie:key=>cookies.delete(key),getRequestUrl:()=>new URL(requestUrl),getRequestHeader:key=>headers[key]}
const core=load('src/lib/authCore.ts')
const db=load('src/lib/db.ts',{'cloudflare:workers':{env}})
const session=load('src/lib/session.server.ts',{'cloudflare:workers':{env},'@tanstack/react-start/server':context})
const auth=load('src/lib/auth.server.ts',{'cloudflare:workers':{env},'@tanstack/react-start/server':context,'bcryptjs':bcrypt,'./db':db,'./session.server':session,'./authCore':core})
const oauth=load('src/lib/oauth.server.ts',{'cloudflare:workers':{env},'@tanstack/react-start/server':context,'./db':db,'./session.server':session,'./authCore':core,'./auth.server':auth})
const keyPair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify'])
const publicKey={...await webcrypto.subtle.exportKey('jwk',keyPair.publicKey),kid:'fixture',use:'sig',alg:'RS256'}
const now=Math.floor(Date.now()/1000)
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
async function token(claims,header={alg:'RS256',kid:'fixture'}) {
 const raw=b64(header)+'.'+b64(claims)
 const signature=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keyPair.privateKey,new TextEncoder().encode(raw))
 return raw+'.'+Buffer.from(signature).toString('base64url')
}
const schema=`
 CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT COLLATE NOCASE UNIQUE NOT NULL,first_name TEXT,last_name TEXT,mobile TEXT,password TEXT,user_type TEXT,status INTEGER DEFAULT 1,is_banned INTEGER DEFAULT 0,is_subscribe INTEGER DEFAULT 0,login_type TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
 CREATE TABLE user_multi_profiles(id INTEGER PRIMARY KEY,user_id INTEGER,name TEXT,avatar TEXT,is_child_profile INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);
 CREATE TABLE subscriptions(id INTEGER PRIMARY KEY,user_id INTEGER,status TEXT);
 CREATE TABLE user_providers(id INTEGER PRIMARY KEY,user_id INTEGER,provider TEXT,provider_id TEXT);
 CREATE TABLE settings(name TEXT PRIMARY KEY,val TEXT);
`
const password='Migrated passphrase 2026!',hash=bcrypt.hashSync(password,4).replace('$2b$','$2y$')
function fixture() {
 const sql=new DatabaseSync(':memory:');sql.exec(schema);sql.exec(read('migrations/20261108_auth_identity.sql'))
 sql.prepare("INSERT INTO users(id,email,first_name,last_name,password,user_type,status,is_subscribe) VALUES(42,'viewer@example.test','Existing','Viewer',?,'user',1,1)").run(hash)
 sql.exec("INSERT INTO user_multi_profiles(id,user_id,name,is_child_profile) VALUES(73,42,'My migrated profile',0);INSERT INTO subscriptions VALUES(19,42,'active');")
 const adapter={prepare(query){return{sql:query,args:[],bind(...args){return{...this,args}},async first(){return sql.prepare(this.sql).get(...this.args)??null},async all(){return{results:sql.prepare(this.sql).all(...this.args)}},async run(){const result=sql.prepare(this.sql).run(...this.args);return{meta:{last_row_id:Number(result.lastInsertRowid),changes:result.changes}}}}},async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>sql.prepare(s.sql).run(...s.args));sql.exec('COMMIT');return result}catch(error){sql.exec('ROLLBACK');throw error}}}
 for(const k of Object.keys(env))delete env[k]
 Object.assign(env,{DB:adapter,SESSION_SECRET:'test-only-auth-session-secret-with-32-bytes',AUTH_ORIGIN:prod,GOOGLE_AUTH_ENABLED:'1',APPLE_AUTH_ENABLED:'1',GOOGLE_CLIENT_ID:'google-fixture-client',GOOGLE_CLIENT_SECRET:'fixture-google-secret',APPLE_CLIENT_ID:'apple-fixture-client',APPLE_CLIENT_SECRET:'fixture-apple-secret'})
 cookies.clear();cookieOptions.clear();requestUrl=prod+'/login';headers.origin=prod;headers['sec-fetch-site']='same-origin';headers['cf-connecting-ip']='192.0.2.5'
 let claims={},currentAttempt,exchangeCalls=0
 transport=async(url,options)=>{
  assert.equal(options.redirect,'error','Never send provider secrets through redirects')
  if(url.endsWith('/certs')||url.endsWith('/keys'))return Response.json({keys:[publicKey]})
  assert.ok(['https://oauth2.googleapis.com/token','https://appleid.apple.com/auth/token'].includes(url))
  assert.equal(options.method,'POST');const body=new URLSearchParams(options.body);exchangeCalls++
  assert.equal(body.get('grant_type'),'authorization_code');assert.equal(body.get('code'),'fixture-code')
  assert.equal(body.get('redirect_uri'),`${prod}/auth/${currentAttempt.provider}/callback`)
  assert.equal(body.get('client_secret'),currentAttempt.provider==='google'?env.GOOGLE_CLIENT_SECRET:env.APPLE_CLIENT_SECRET)
  if(currentAttempt.provider==='google'){assert.equal(await core.digest(body.get('code_verifier')),currentAttempt.challenge);assert.equal(body.get('client_id'),env.GOOGLE_CLIENT_ID)}
  return Response.json({id_token:await token({iss:currentAttempt.provider==='google'?'https://accounts.google.com':'https://appleid.apple.com',aud:currentAttempt.provider==='google'?env.GOOGLE_CLIENT_ID:env.APPLE_CLIENT_ID,sub:'fixture-subject',email:'viewer@example.test',email_verified:true,exp:now+300,iat:now,nonce:currentAttempt.nonce,...claims})})
 }
 async function begin(provider='google',overrides={}) {
  claims=overrides
  const response=await oauth.startSocialSignIn(new Request(`${prod}/auth/${provider}`,{headers:{'sec-fetch-site':'same-origin'}}),provider)
  if(response.status!==302)return{response}
  const url=new URL(response.headers.get('location'))
  currentAttempt={provider,state:url.searchParams.get('state'),nonce:url.searchParams.get('nonce'),challenge:url.searchParams.get('code_challenge')}
  assert.ok(currentAttempt.state.length>=32);assert.ok(currentAttempt.nonce.length>=32)
  assert.equal(cookieOptions.get('halobox_oauth_browser').httpOnly,true);assert.equal(cookieOptions.get('halobox_oauth_browser').secure,true)
  const callback=(state=currentAttempt.state)=>new Request(`${prod}/auth/${provider}/callback${provider==='google'?'?'+new URLSearchParams({state,code:'fixture-code'}):''}`,provider==='apple'?{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({state,code:'fixture-code'}).toString()}:undefined)
  return{response,url,callback,attempt:{...currentAttempt}}
 }
 return{sql,adapter,begin,get calls(){return exchangeCalls},count:table=>sql.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,close:()=>sql.close()}
}

// JWT verification executes WebCrypto signature verification and every claim boundary for both providers.
for(const provider of ['google','apple']) {
 const claims={iss:provider==='google'?'https://accounts.google.com':'https://appleid.apple.com',aud:'client',sub:'subject',nonce:'n'.repeat(43),iat:now,exp:now+60,email:'Viewer@example.test',email_verified:true}
 const valid=await token(claims)
 assert.equal((await core.verifyIdentityToken(valid,provider,'client',claims.nonce,[publicKey])).email,'viewer@example.test')
 for(const bad of [{iss:'https://attacker.test'},{aud:'wrong-client'},{aud:['client','other'],azp:'other'},{exp:now-1},{iat:now+600},{nonce:'wrong'},{sub:''}])await assert.rejects(core.verifyIdentityToken(await token({...claims,...bad}),provider,'client',claims.nonce,[publicKey]))
 for(const header of [{alg:'none',kid:'fixture'},{alg:'HS256',kid:'fixture'},{alg:'RS256',kid:'different'},{alg:'RS256',kid:'fixture',jku:'https://attacker.test/keys'},{alg:'RS256',kid:'fixture',crit:['unknown']}])await assert.rejects(core.verifyIdentityToken(await token(claims,header),provider,'client',claims.nonce,[publicKey]))
 const parts=valid.split('.');parts[1]=b64({...claims,sub:'forged'});await assert.rejects(core.verifyIdentityToken(parts.join('.'),provider,'client',claims.nonce,[publicKey]))
 await assert.rejects(core.verifyIdentityToken(valid,provider,'client','different-nonce',[publicKey]))
}
assert.equal(core.verifiedEmail({email:'viewer@example.test',email_verified:false}),false)
assert.equal(core.verifiedEmail({email:'viewer@example.test',email_verified:'false'}),false)
assert.equal(core.verifiedEmail({email:'viewer@example.test',email_verified:'true'}),true)
for(const [origin,site] of [[undefined,undefined],['https://attacker.test','cross-site'],[prod,'cross-site']])assert.throws(()=>core.sameOrigin(prod,origin,site))
assert.equal(core.sameOrigin(prod,prod,'same-origin'),prod)

// Imported Laravel hashes work as-is, and their IDs, subscriptions and profile records remain unchanged.
{
 const f=fixture(),result=await auth.passwordLogin({email:'  VIEWER@example.test ',password})
 assert.equal(result.ok,true);assert.equal(result.user.id,42);assert.equal(result.profiles[0].id,73)
 assert.equal((await session.getSession()).uid,42)
 assert.equal(f.sql.prepare('SELECT password FROM users WHERE id=42').get().password,hash)
 assert.equal(f.count('users'),1);assert.equal(f.count('subscriptions'),1);assert.equal(f.count('user_multi_profiles'),1)
 assert.equal(f.sql.prepare('SELECT status FROM subscriptions').get().status,'active')
 const opts=cookieOptions.get(session.SESSION_COOKIE);assert.equal(opts.httpOnly,true);assert.equal(opts.secure,true);assert.equal(opts.sameSite,'lax')
 const good=cookies.get(session.SESSION_COOKIE);cookies.set(session.SESSION_COOKIE,good.slice(0,-5)+'wrong');assert.equal(await session.getSession(),null)
 cookies.set(session.SESSION_COOKIE,good);assert.equal((await session.getSession()).uid,42)
 f.close()
}
for(const mutation of ["UPDATE users SET status=0","UPDATE users SET is_banned=1","UPDATE users SET deleted_at=datetime('now')"]){
 const f=fixture();f.sql.exec(mutation);const result=await auth.passwordLogin({email:'viewer@example.test',password});assert.equal(result.ok,false);assert.equal(await session.getSession(),null);assert.equal(f.count('subscriptions'),1);assert.equal(f.count('auth_identities'),0);f.close()
}
{
 const f=fixture()
 assert.equal((await auth.passwordLogin({email:'viewer@example.test',password:'wrong'})).error,(await auth.passwordLogin({email:'missing@example.test',password:'wrong'})).error)
 for(const input of [null,{}, {email:42,password}, {email:'viewer@example.test',password:42}, {email:'viewer@example.test',password:'x'.repeat(1025)}])assert.equal((await auth.passwordLogin(input)).ok,false)
 headers.origin='https://attacker.test';assert.equal((await auth.passwordLogin({email:'viewer@example.test',password})).ok,false);headers.origin=prod
 for(let i=0;i<12;i++)await auth.passwordLogin({email:'rate@example.test',password:'bad'})
 assert.match((await auth.passwordLogin({email:'rate@example.test',password:'bad'})).error,/Too many/)
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM auth_limits WHERE bucket LIKE ?').get('%example%').n,0)
 f.close()
}
{
 const f=fixture(),data={email:'new@example.test',firstName:'New',lastName:'Viewer',mobile:'+14488770344',password}
 for(const patch of [{password:'short'},{password:'🙂'.repeat(30)},{mobile:'+0bad'},{firstName:''},{firstName:'x'.repeat(81)}])assert.equal((await auth.registerAccount({...data,...patch})).ok,false)
 assert.equal((await auth.registerAccount(data)).ok,true);assert.equal(f.count('users'),2);assert.equal(f.count('user_multi_profiles'),2)
 assert.equal((await auth.registerAccount({...data,email:'NEW@example.test'})).ok,false)
 assert.equal((await auth.changeAccountPassword({current:password,next:'new safe passphrase'})).ok,true)
 assert.equal((await auth.passwordLogin({email:data.email,password:'new safe passphrase'})).ok,true)
 assert.equal((await auth.changeAccountPassword({current:'wrong',next:'another safe passphrase'})).ok,false)
 f.close()
}

// Both providers: new verified accounts authenticate; existing accounts do not silently link by email.
for(const provider of ['google','apple']) {
 const f=fixture(),flow=await f.begin(provider),result=await oauth.finishSocialSignIn(flow.callback(),provider)
 assert.equal(new URL(result.headers.get('location')).searchParams.get('auth'),'link-required')
 assert.equal(await session.getSession(),null);assert.equal(f.count('users'),1);assert.equal(f.count('auth_identities'),0)
 assert.equal(f.count('auth_pending_links'),1);assert.equal(f.calls,1)
 const pendingCookie=cookies.get(auth.LINK_COOKIE)
 assert.equal((await auth.passwordLogin({email:'viewer@example.test',password})).ok,true)
 assert.equal(f.sql.prepare('SELECT user_id FROM auth_identities').get().user_id,42);assert.equal(f.count('auth_pending_links'),0)
 assert.equal(f.count('user_multi_profiles'),1);assert.equal(f.count('subscriptions'),1)
 cookies.set(auth.LINK_COOKIE,pendingCookie);await auth.finishPendingIdentity({id:42,email:'viewer@example.test'});assert.equal(f.count('auth_identities'),1)
 cookies.clear();const again=await f.begin(provider),direct=await oauth.finishSocialSignIn(again.callback(),provider)
 assert.equal(new URL(direct.headers.get('location')).pathname,'/manage-profile');assert.equal((await session.getSession()).uid,42)
 const replay=await oauth.finishSocialSignIn(again.callback(),provider);assert.equal(new URL(replay.headers.get('location')).searchParams.get('auth'),'failed');assert.equal(f.calls,2)
 f.close()
}
for(const provider of ['google','apple']) {
 const f=fixture(),flow=await f.begin(provider,{email:'fresh@example.test',sub:'new-user',given_name:'New',family_name:'Person'}),response=await oauth.finishSocialSignIn(flow.callback(),provider)
 assert.equal(new URL(response.headers.get('location')).pathname,'/manage-profile');assert.equal(f.count('users'),2);assert.equal(f.count('auth_identities'),1);assert.equal(f.count('user_multi_profiles'),2)
 const user=f.sql.prepare('SELECT * FROM users WHERE email=?').get('fresh@example.test');assert.equal((await session.getSession()).uid,user.id);assert.equal(user.password,'');assert.equal(user.status,1)
 f.close()
}
for(const override of [{email_verified:false},{email_verified:'false'},{aud:'foreign-client'},{iss:'https://attacker.test'},{nonce:'other-nonce'},{exp:1}]){
 const f=fixture(),flow=await f.begin('google',{email:'fresh@example.test',...override}),result=await oauth.finishSocialSignIn(flow.callback(),'google')
 assert.equal(new URL(result.headers.get('location')).searchParams.get('auth'),'failed');assert.equal(f.count('users'),1);assert.equal(f.count('auth_identities'),0);assert.equal(await session.getSession(),null);f.close()
}
{
 const f=fixture(),flow=await f.begin();cookies.set('halobox_oauth_browser','wrong-browser');const response=await oauth.finishSocialSignIn(flow.callback(),'google');assert.equal(new URL(response.headers.get('location')).searchParams.get('auth'),'failed');assert.equal(f.calls,0);assert.equal(f.count('auth_pending_links'),0);f.close()
}
{
 const f=fixture(),flow=await f.begin();f.sql.exec('UPDATE auth_challenges SET expires_at=0');await oauth.finishSocialSignIn(flow.callback(),'google');assert.equal(f.calls,0);f.close()
}
{
 const f=fixture(),flow=await f.begin();await oauth.finishSocialSignIn(flow.callback('forged-state'),'google');assert.equal(f.calls,0)
 const response=await oauth.finishSocialSignIn(new Request(`${prod}/auth/apple/callback`,{method:'POST',body:'x'.repeat(21000)}),'apple');assert.equal(new URL(response.headers.get('location')).searchParams.get('auth'),'failed');assert.equal(f.calls,0);f.close()
}
{
 const f=fixture();delete env.GOOGLE_CLIENT_SECRET;delete env.APPLE_CLIENT_SECRET;const config=await oauth.socialConfiguration();assert.equal(config.googleEnabled,false);assert.equal(config.appleEnabled,false)
 const flow=await f.begin();assert.equal(new URL(flow.response.headers.get('location')).searchParams.get('auth'),'not-configured');assert.equal(f.count('auth_challenges'),0);f.close()
}
{
 const f=fixture();f.sql.exec("INSERT INTO user_providers VALUES(1,42,'google','legacy-subject')");const flow=await f.begin('google',{sub:'legacy-subject'});const response=await oauth.finishSocialSignIn(flow.callback(),'google');assert.equal(new URL(response.headers.get('location')).pathname,'/manage-profile');assert.equal((await session.getSession()).uid,42);assert.equal(f.count('users'),1);f.close()
}
for(const mutation of ["UPDATE users SET status=0","UPDATE users SET is_banned=1","UPDATE users SET deleted_at=datetime('now')"]){
 const f=fixture();f.sql.exec(mutation);const flow=await f.begin();await oauth.finishSocialSignIn(flow.callback(),'google');assert.equal(await session.getSession(),null);assert.equal(f.count('auth_pending_links'),0);assert.equal(f.count('auth_identities'),0);f.close()
}
{
 const f=fixture();f.sql.exec("INSERT INTO users(id,email,password,status) VALUES(99,'other@example.test','',1)")
 const flow=await f.begin();await oauth.finishSocialSignIn(flow.callback(),'google');await auth.finishPendingIdentity({id:99,email:'other@example.test'});assert.equal(f.count('auth_identities'),0);f.close()
}
// Recovery/import of credentials must never enable a provider before its callback registration is validated.
{
 const f=fixture();delete env.GOOGLE_AUTH_ENABLED;delete env.APPLE_AUTH_ENABLED
 const config=await oauth.socialConfiguration();assert.equal(config.googleEnabled,false);assert.equal(config.appleEnabled,false)
 const flow=await f.begin();assert.equal(new URL(flow.response.headers.get('location')).searchParams.get('auth'),'not-configured');assert.equal(f.count('auth_challenges'),0);f.close()
}
// Apple P8 signing configuration produces a verifiable, short-lived client secret without a stored JWT.
{
 const f=fixture(),pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
 delete env.APPLE_CLIENT_SECRET;env.APPLE_TEAM_ID='fixture-team';env.APPLE_KEY_ID='fixture-apple-key'
 env.APPLE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await webcrypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----'
 assert.equal((await oauth.socialConfiguration()).appleEnabled,true)
 const originalTransport=transport
 transport=async(url,options)=>{
  if(url==='https://appleid.apple.com/auth/token'){
   const secret=new URLSearchParams(options.body).get('client_secret'),parts=secret.split('.')
   const header=JSON.parse(Buffer.from(parts[0],'base64url')),payload=JSON.parse(Buffer.from(parts[1],'base64url'))
   assert.equal(header.alg,'ES256');assert.equal(header.kid,env.APPLE_KEY_ID);assert.equal(payload.iss,env.APPLE_TEAM_ID);assert.equal(payload.sub,env.APPLE_CLIENT_ID);assert.equal(payload.aud,'https://appleid.apple.com')
   assert.equal(payload.exp-payload.iat,300)
   assert.equal(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pair.publicKey,Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts[0]+'.'+parts[1])),true)
   // Supply the captured fixture secret only to the existing fake provider assertion.
   env.APPLE_CLIENT_SECRET=secret
  }
  return originalTransport(url,options)
 }
 const flow=await f.begin('apple',{email:'new-p8@example.test'});const response=await oauth.finishSocialSignIn(flow.callback(),'apple')
 assert.equal(new URL(response.headers.get('location')).pathname,'/manage-profile');f.close()
}
{
 const f=fixture()
 for(let i=0;i<60;i++)await auth.authLimit('ip-limit',`different-${i}`)
 await assert.rejects(auth.authLimit('ip-limit','next-account'),/Too many/)
 await session.setSessionCookie({uid:42,email:'viewer@example.test'});f.sql.exec('UPDATE users SET status=0')
 assert.equal((await auth.changeAccountPassword({current:password,next:'another long password'})).ok,false)
 assert.equal(f.sql.prepare('SELECT password FROM users WHERE id=42').get().password,hash);f.close()
}
// New-account creation is atomic: an identity constraint failure cannot leave an orphan user.
{
 const f=fixture()
 f.sql.exec("CREATE TRIGGER deny_identity BEFORE INSERT ON auth_identities BEGIN SELECT RAISE(ABORT,'injected write failure'); END;")
 const flow=await f.begin('google',{email:'rollback@example.test'});await oauth.finishSocialSignIn(flow.callback(),'google')
 assert.equal(f.count('users'),1);assert.equal(f.count('auth_identities'),0);assert.equal(await session.getSession(),null);f.close()
}
// Critical regression: neither an OTP value nor fake email delivery is exposed by public auth endpoints.
const api=read('src/lib/api.ts')
assert.doesNotMatch(api,/devCode|tokeninfo\?id_token|Math\.random\(\).*999999/)
assert.match(read('src/routes/forgot-password.tsx'),/Automatic password reset emails are currently unavailable/)
assert.match(read('src/components/SocialSignIn.tsx'),/Continue with/)
console.log('AUTH PASS: JWT claims/signatures, OAuth code exchange/state/nonce, migrated account preservation, safe linking, cookies, validation, rate limits and unavailable provider states')
