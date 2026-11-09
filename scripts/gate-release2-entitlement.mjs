#!/usr/bin/env node
// Offline: production policy + handlers, in-memory SQLite, zero emails/network.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DatabaseSync} from 'node:sqlite'
import {webcrypto} from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
function load(path,imports={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{assert.ok(n in imports,`Unexpected import ${n}`);return imports[n]},crypto:webcrypto,URL,TextEncoder,Uint8Array,btoa,atob});return module.exports}
const core=load('src/lib/entitlement-core.ts'),policy=load('src/lib/subscriptionPolicy.ts'),security=load('src/lib/api-security.ts'),auth=load('src/lib/authCore.ts')
const sql=new DatabaseSync(':memory:')
sql.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,status INTEGER DEFAULT 1,is_banned INTEGER DEFAULT 0,deleted_at TEXT);
 CREATE TABLE plan(id INTEGER PRIMARY KEY,duration TEXT);
 CREATE TABLE subscriptions(id INTEGER PRIMARY KEY,user_id INTEGER,plan_id INTEGER,name TEXT,level INTEGER DEFAULT 1,start_date TEXT,end_date TEXT,status TEXT DEFAULT 'active',duration TEXT,deleted_at TEXT);
 CREATE TABLE ba_viewer_session(id TEXT PRIMARY KEY,userId INTEGER,expiresAt TEXT);
 INSERT INTO plan VALUES(1,'month'),(2,'year'),(3,'week');
 INSERT INTO users(id,email) VALUES(1,'owner@example.test'),(2,'member@example.test'),(3,'three@example.test'),(4,'four@example.test'),(5,'other@example.test'),(6,'six@example.test');
 INSERT INTO subscriptions(id,user_id,plan_id,name,start_date,end_date,duration) VALUES(1,1,1,'Monthly','2000-01-01','2999-01-01','month');`)
const migration=read('migrations/20261108_release2_shared_entitlements.sql');sql.exec(migration);sql.exec(migration)
const db={prepare(query){return{query,args:[],bind(...args){return{...this,args}},async first(){return sql.prepare(this.query).get(...this.args)||null},async all(){return{results:sql.prepare(this.query).all(...this.args)}},async run(){return sql.prepare(this.query).run(...this.args)}}},async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>sql.prepare(s.query).run(...s.args));sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}}
const user=id=>({uid:id,email:sql.prepare('SELECT email FROM users WHERE id=?').get(id).email,sessionId:`session-${id}`})
function session(id,uid,expiry='2999-01-01'){sql.prepare('INSERT OR REPLACE INTO ba_viewer_session VALUES(?,?,?)').run(id,uid,expiry);return {...user(uid),sessionId:id}}
for(let id=1;id<=6;id++)session(`session-${id}`,id)
async function invite(uid,email,token=webcrypto.randomUUID()){const hash=await auth.digest(token);const id=await core.inviteSubscriptionMember(db,user(uid),email,hash);return{id,hash}}
const count=table=>sql.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n
let checks=0;function ok(value,message){assert.ok(value,message);checks++}
// Pass 1: membership lifecycle, capacities, matching authenticated email, no profiles.
ok((await core.resolveEntitlement(db,1)).user_limit===2,'owner included in monthly total 2')
const outcomes=await Promise.allSettled([invite(1,'member@example.test'),invite(1,'three@example.test')]);ok(outcomes.filter(x=>x.status==='fulfilled').length===1,'concurrent invites reserve only 1 monthly member seat')
// Either digest may finish first: don't assume which contender wins the seat.
const raceInvitation=outcomes.find(x=>x.status==='fulfilled').value
await core.removeSubscriptionMember(db,user(1),raceInvitation.id)
const invitation=await invite(1,'member@example.test')
await assert.rejects(core.acceptSubscriptionInvite(db,{...user(3),email:user(2).email},invitation.hash));checks++
await core.acceptSubscriptionInvite(db,user(2),invitation.hash);await core.acceptSubscriptionInvite(db,user(2),invitation.hash)
ok((await core.resolveEntitlement(db,2)).owner_user_id===1,'accepted member shares access idempotently')
await assert.rejects(invite(1,'owner@example.test'));checks++
await assert.rejects(invite(2,'other@example.test'));checks++
ok(!(await core.subscriptionDashboard(db,user(2))).members.length,'member cannot read owner membership list')
ok(!JSON.stringify(await core.subscriptionDashboard(db,user(2))).includes('owner@example.test'),'no owner email/billing leakage')
ok(!JSON.stringify(await core.subscriptionDashboard(db,user(2))).includes('token_hash'),'no invite token hash leakage')
// Production route handlers enforce CSRF, valid session and hashed manually shared token.
let actor=user(1),origin='https://halobox.tv',requestOrigin=origin
const factory={createServerFn(){let validator=x=>x;return{validator(fn){validator=fn;return this},handler(fn){return(input={})=>fn({data:validator(input.data)})}}}}
const handlers=load('src/lib/membership.ts',{'@tanstack/react-start':factory,'@tanstack/react-start/server':{getRequestUrl:()=>new URL(origin+'/account-setting'),setResponseHeader(){}},'./session.server':{getSession:async()=>actor},'./auth.server':{authWriteOrigin:()=>auth.sameOrigin(origin+'/account-setting',requestOrigin,'same-origin')},'./authCore':auth,'./entitlement.server':{entitlementDatabase:()=>db},'./entitlement-core':core})
requestOrigin='https://evil.test';await assert.rejects(handlers.removeMember({data:{id:invitation.id}}));checks++
requestOrigin=origin;actor=null;await assert.rejects(handlers.getSubscriptionSharing());checks++;actor=user(1)
// Pass 2: session device races, pooled count, expiry and revocation.
const attempts=await Promise.all(Array.from({length:12},(_,i)=>core.admitSubscriptionDevice(db,session(`race-${i}`,i%2?1:2),'Browser '+i)))
ok(attempts.filter(Boolean).length===5,'concurrent owner/member admission cannot exceed 5 pooled devices')
ok(count('r2_active_subscription_devices')===5,'database independently enforces device count')
const admitted=sql.prepare('SELECT * FROM r2_active_subscription_devices LIMIT 1').get()
ok(await core.admitSubscriptionDevice(db,{...user(admitted.user_id),sessionId:admitted.session_id,pid:999},'Changed profile'),'profile change reuses its existing device')
ok(count('r2_active_subscription_devices')===5,'profile changes cannot increase pool')
ok(!await core.admitSubscriptionDevice(db,{...user(1),sessionId:'admin-only-session'},'Admin realm'),'admin-only or nonexistent session cannot enrol')
const memberDevice=sql.prepare('SELECT * FROM subscription_devices WHERE user_id=2 LIMIT 1').get()
const strangerDevice=sql.prepare('SELECT * FROM subscription_devices WHERE user_id=1 LIMIT 1').get()
await core.revokeSubscriptionDevice(db,user(3),strangerDevice.id)
ok(sql.prepare('SELECT 1 FROM ba_viewer_session WHERE id=?').get(strangerDevice.session_id),'foreign device revocation denied')
await core.removeSubscriptionMember(db,user(3),invitation.id)
ok(await core.resolveEntitlement(db,2),'foreign membership removal denied')
const memberDashboard=await core.subscriptionDashboard(db,user(2));ok(memberDashboard.devices.every(d=>d.user_id===2),'member only sees own devices')
await core.revokeSubscriptionDevice(db,user(1),memberDevice.id)
ok(!sql.prepare('SELECT 1 FROM ba_viewer_session WHERE id=?').get(memberDevice.session_id),'owner revocation signs out member device')
ok(!await core.admitSubscriptionDevice(db,{...user(2),sessionId:memberDevice.session_id},'Retry'),'revoked device cannot re-enrol')
const expired=sql.prepare('SELECT * FROM subscription_devices WHERE revoked_at IS NULL LIMIT 1').get()
sql.prepare("UPDATE ba_viewer_session SET expiresAt='2000-01-01' WHERE id=?").run(expired.session_id)
ok(!await core.admitSubscriptionDevice(db,{...user(expired.user_id),sessionId:expired.session_id},'Expired'),'expired login cannot use device')
ok(await core.admitSubscriptionDevice(db,session('after-expiry',1),'New browser'),'expired session frees pool capacity')
// Millisecond dates are used by some auth adapters.
sql.prepare('UPDATE ba_viewer_session SET expiresAt=? WHERE id=?').run(Date.now()+1000000,'after-expiry')
ok(await core.admitSubscriptionDevice(db,{...user(1),sessionId:'after-expiry'},'Browser'),'numeric auth expiry accepted')
// Pass 3: annual policy, downgrade, invalid dates, inactive owner and immutable snapshot.
sql.exec("UPDATE subscriptions SET plan_id=2,duration='year' WHERE id=1")
ok((await core.resolveEntitlement(db,1)).user_limit===4,'annual owner plus three members')
const third=await invite(1,'three@example.test'),fourth=await invite(1,'four@example.test')
await core.acceptSubscriptionInvite(db,user(3),third.hash);await core.acceptSubscriptionInvite(db,user(4),fourth.hash)
await assert.rejects(invite(1,'other@example.test'));checks++
await Promise.all(Array.from({length:15},(_,i)=>core.admitSubscriptionDevice(db,session(`annual-${i}`,i%4+1),'Annual browser')))
ok(count('r2_active_subscription_devices')===10,'annual pool capped at 10')
sql.exec("UPDATE subscriptions SET plan_id=1,duration='month' WHERE id=1")
ok(!await core.resolveEntitlement(db,3)&&!await core.resolveEntitlement(db,4),'downgrade denies higher member seats')
ok(count('r2_active_subscription_devices')<=5,'downgrade deterministically limits existing devices')
for(const update of ["end_date='2000-01-01'","end_date=NULL","end_date='invalid'","start_date='2999-01-01'","status='inactive'","deleted_at='2026-01-01'"]){sql.exec(`UPDATE subscriptions SET ${update} WHERE id=1`);ok(!await core.resolveEntitlement(db,1)&&!await core.resolveEntitlement(db,2),'invalid/expired/inactive plan denies owner and member');sql.exec("UPDATE subscriptions SET end_date='2999-01-01',start_date='2000-01-01',status='active',deleted_at=NULL WHERE id=1")}
sql.exec('UPDATE users SET is_banned=1 WHERE id=1');ok(!await core.resolveEntitlement(db,2),'banned owner suspends members');sql.exec('UPDATE users SET is_banned=0 WHERE id=1')
sql.exec("UPDATE users SET email='changed@example.test' WHERE id=2");ok(!await core.resolveEntitlement(db,2),'changed member email loses invite-bound access');sql.exec("UPDATE users SET email='member@example.test' WHERE id=2")
sql.exec("UPDATE plan SET duration='year' WHERE id=1");ok((await core.resolveEntitlement(db,1)).user_limit===2,'snapshot month not silently upgraded by plan edit');sql.exec("UPDATE plan SET duration='month' WHERE id=1")
sql.exec("INSERT INTO subscriptions(id,user_id,plan_id,name,end_date,status,duration) VALUES(2,1,1,'Expired replacement','2000-01-01','active','month')")
ok(!await core.resolveEntitlement(db,2),'newer expired plan cannot fall back to older paid entitlement');sql.exec('DELETE FROM subscriptions WHERE id=2')
// Pass 4: removal, invitation replay/expiry and paid-source boundaries.
await core.removeSubscriptionMember(db,user(1),invitation.id)
ok(!await core.resolveEntitlement(db,2),'removal immediately denies member')
ok(!sql.prepare('SELECT 1 FROM ba_viewer_session bs JOIN subscription_devices d ON d.session_id=bs.id WHERE d.user_id=2').get(),'member removal revokes enrolled sessions')
await assert.rejects(core.acceptSubscriptionInvite(db,user(2),invitation.hash));checks++
const expiring=await invite(1,'other@example.test');sql.prepare('UPDATE subscription_members SET expires_at=1 WHERE id=?').run(expiring.id)
await assert.rejects(core.acceptSubscriptionInvite(db,user(5),expiring.hash));checks++
sql.exec("INSERT INTO subscriptions(id,user_id,plan_id,name,end_date,duration) VALUES(20,5,1,'Other owner','2999-01-01','month')")
sql.prepare('UPDATE subscription_members SET expires_at=9999999999 WHERE id=?').run(expiring.id)
await assert.rejects(core.acceptSubscriptionInvite(db,user(5),expiring.hash));checks++
sql.exec('DELETE FROM subscriptions WHERE id=20')
sql.prepare('UPDATE subscription_members SET expires_at=1 WHERE id=?').run(expiring.id)
actor=user(1);const newLink=await handlers.createMemberInvite({data:{email:'six@example.test'}})
ok(newLink.url.startsWith('https://halobox.tv/subscription-invite#'),'token stays in URL fragment')
const token=newLink.url.split('#')[1], stored=sql.prepare("SELECT token_hash FROM subscription_members WHERE invited_email='six@example.test' AND revoked_at IS NULL").get()
ok(stored.token_hash!==token&&stored.token_hash===await auth.digest(token),'only SHA-256 digest stored')
actor=user(6);await handlers.acceptMemberInvite({data:{token}});ok(await core.resolveEntitlement(db,6),'manual invitation handler works without email transport')
const source={id:1,access:'subscription',plan_id:1,video_url_input:'https://cdn.example/private',bunny_video_url:'private',download_url:'secret'}
ok(policy.subscriptionFields(source,null,true).video_url_input===null,'no entitlement strips subscription sources')
ok(policy.subscriptionFields(source,{plan_id:1},false).video_url_input===null,'full device pool strips subscription sources')
ok(policy.subscriptionFields(source,{plan_id:2},true).video_url_input===null,'wrong plan strips subscription sources')
ok(policy.subscriptionFields(source,{plan_id:1},true).hasSubscriptionAccess===true,'matching plan and admitted session grants access')
ok(security.playbackFields({...source,access:'paid'},false).video_url_input===null,'PPV remains a separate purchase')
ok(policy.subscriptionFields(security.playbackFields({...source,access:'paid'},false),{plan_id:1},true).video_url_input===null,'subscription cannot unlock PPV')
ok(!policy.requiresSubscription({access:'free',plan_id:1}),'explicitly free remains free')
ok(policy.requiresSubscription({access:'premium'}),'premium requires plan')
ok(!read('src/lib/membership.ts').includes('sendOTP'),'invitation module has no email operation')
ok(!read('src/lib/api.ts').includes('myPurchase: entitlement'),'no fake rental marker for subscription')
console.log(`RELEASE2_ENTITLEMENT_PASS: ${checks} assertions; four passes; SQLite migration rerun; membership/device races; no network, emails, purchases or production writes.`)
sql.close()
