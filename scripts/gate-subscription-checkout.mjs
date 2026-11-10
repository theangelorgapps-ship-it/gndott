#!/usr/bin/env node
// Runs the production checkout helpers and API handlers against SQLite and a fake Stripe transport.
// No production database, payment requests, credentials, or browser are used.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import { DatabaseSync } from 'node:sqlite'
import { webcrypto } from 'node:crypto'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const read=file=>readFileSync(resolve(root,file),'utf8')
const env={}, headers={origin:'https://halobox.tv','sec-fetch-site':'same-origin'}
let viewer={userId:1}, requestUrl='https://halobox.tv/subscription-plan', activeTransport
function load(source, imports) {
  const module={exports:{}}
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(compiled,{module,exports:module.exports,require:name=>{if(!(name in imports))throw Error(`Unexpected dependency: ${name}`);return imports[name]},URL,URLSearchParams,AbortSignal,Response,Request,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,fetch:(...args)=>activeTransport(...args),console})
  return module.exports
}
const helpers=load(read('src/lib/subscriptionCheckout.server.ts'),{
  'cloudflare:workers':{env},
  '@tanstack/react-start/server':{getRequestUrl:()=>new URL(requestUrl),getRequestHeader:key=>headers[key],setResponseHeader(){}},
  './viewer.server':{getActiveViewer:async()=>viewer},
})
const factory={createServerFn(){let validate=data=>data;return{validator(fn){validate=fn;return this},handler(fn){return(input={})=>fn({data:validate(input.data)})}}}}
const apiSource=read('src/lib/api.ts')
const handlers=load("const {createServerFn}=require('@tanstack/react-start');\n"+apiSource.slice(apiSource.indexOf('export const getCheckoutInfo ='),apiSource.indexOf('// ---------- pay per view ----------')),{ '@tanstack/react-start':factory,'./subscriptionCheckout.server':helpers,'./storeCheckout.server':{confirmStoreCheckout:async()=>null} })
const schema=`
 CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT NOT NULL,status INTEGER DEFAULT 1,is_banned INTEGER DEFAULT 0,deleted_at TEXT,is_subscribe INTEGER DEFAULT 0,updated_at TEXT);
 CREATE TABLE settings(name TEXT,val TEXT,deleted_at TEXT);
 CREATE TABLE plan(id INTEGER PRIMARY KEY,name TEXT,identifier TEXT,price REAL,duration TEXT,duration_value INTEGER,level INTEGER,status INTEGER,deleted_at TEXT);
 CREATE TABLE coupons(id INTEGER PRIMARY KEY,code TEXT,discount_type TEXT,discount REAL,start_date TEXT,expire_date TEXT,status INTEGER,deleted_at TEXT);
 CREATE TABLE subscriptions(id INTEGER PRIMARY KEY AUTOINCREMENT,plan_id INTEGER,user_id INTEGER,start_date TEXT,end_date TEXT,status TEXT,is_manual INTEGER,amount REAL,discount_percentage REAL,tax_amount REAL,coupon_discount REAL,total_amount REAL,name TEXT,identifier TEXT,type TEXT,duration INTEGER,level INTEGER,plan_type TEXT,payment_id INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);
 CREATE TABLE subscriptions_transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,subscriptions_id INTEGER,user_id INTEGER,amount REAL,payment_type TEXT,payment_status TEXT,transaction_id TEXT,created_at TEXT,updated_at TEXT);
 INSERT INTO users(id,email) VALUES(1,'viewer@example.test'),(2,'other@example.test');
 INSERT INTO settings VALUES('str_payment_method','1',NULL),('stripe_secretkey','test-secret',NULL),('cash_payment_method','1',NULL);
 INSERT INTO plan VALUES(6,'Monthly Plan','monthly',9,'month',1,1,1,NULL);
 INSERT INTO coupons VALUES(1,'SAVE10','percentage',10,'2000-01-01','2999-01-01',1,NULL),(2,'FREE','percentage',100,NULL,NULL,1,NULL);
 INSERT INTO subscriptions(plan_id,user_id,status,name,end_date,plan_type,payment_id) VALUES(6,1,'active','Existing access','2026-12-01','stripe','cs_old');
`
function fixture() {
  const sql=new DatabaseSync(':memory:');sql.exec(schema);sql.exec(read('migrations/20261108_subscription_checkout.sql'))
  const adapter={failAt:-1,prepare(query){return {sql:query,args:[],bind(...args){return{...this,args}},async first(){return sql.prepare(this.sql).get(...this.args)??null},async run(){return sql.prepare(this.sql).run(...this.args)}}},async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const result=statements.map((statement,index)=>{if(index===adapter.failAt)throw Error('Injected database failure');return sql.prepare(statement.sql).run(...statement.args)});sql.exec('COMMIT');return result}catch(error){sql.exec('ROLLBACK');throw error}}}
  const requests=[],sessions=new Map(),keys=new Map();let counter=0
  const transport=async(url,options)=>{
    requests.push({url,options})
    assert.equal(new URL(url).origin,'https://api.stripe.com')
    assert.equal(options.redirect,'manual')
    if(options.method==='GET'){const session=sessions.get(url.split('/').at(-1));return Response.json(session??{},{status:session?200:404})}
    const body=new URLSearchParams(options.body),key=options.headers['Idempotency-Key']
    assert.ok(key.startsWith('halobox-subscription-'))
    assert.equal(body.get('mode'),'payment','Preserve fixed-term access; do not enroll in recurring billing')
    assert.equal(body.get('payment_method_types[0]'),'card')
    if(keys.has(key)){assert.equal(keys.get(key).body,options.body,'Idempotency retries must have identical Stripe parameters');return Response.json(keys.get(key).session)}
    const id=`cs_test_fixture${++counter}`
    const session={id,url:`https://checkout.stripe.com/c/pay/${id}`,expires_at:Math.floor(Date.now()/1000)+3600,mode:'payment',status:'open',payment_status:'unpaid',amount_total:Number(body.get('line_items[0][price_data][unit_amount]')),currency:body.get('line_items[0][price_data][currency]'),client_reference_id:body.get('client_reference_id'),metadata:{purpose:body.get('metadata[purpose]'),checkout_id:body.get('metadata[checkout_id]'),user_id:body.get('metadata[user_id]'),plan_id:body.get('metadata[plan_id]')}}
    sessions.set(id,session);keys.set(key,{body:options.body,session});return Response.json(session)
  }
  function bind(){env.DB=adapter;env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET='whsec_fixture';viewer={userId:1};headers.origin='https://halobox.tv';headers['sec-fetch-site']='same-origin';activeTransport=transport}
  bind()
  const input=(extra={})=>({planId:6,gateway:'stripe',requestKey:webcrypto.randomUUID(),expectedTotalCents:900,...extra})
  const create=async(extra={})=>{const data=input(extra);const result=await helpers.createSubscriptionCheckout(adapter,{id:1,email:'viewer@example.test'},data,headers.origin,'test-secret',transport);return {data,result,session:[...sessions.values()].at(-1)}}
  const paid=session=>({...session,status:'complete',payment_status:session.amount_total===0?'no_payment_required':'paid'})
  return {sql,adapter,requests,sessions,transport,bind,input,create,paid,count:table=>sql.prepare(`SELECT count(*) n FROM ${table}`).get().n,close:()=>sql.close()}
}

// CSRF/origin policy includes a positive local-development control and rejects spoofed hosts.
const prod=headers.origin
assert.equal(helpers.allowedCheckoutOrigin(`${prod}/x`,prod,'same-origin'),prod)
assert.equal(helpers.allowedCheckoutOrigin('http://127.0.0.1:5190/x','http://127.0.0.1:5190','same-origin'),'http://127.0.0.1:5190')
for(const [url,origin,site] of [[`${prod}/x`,undefined,undefined],[`${prod}/x`,'https://attacker.test','cross-site'],[`${prod}/x`,prod,'cross-site'],['https://attacker.test/x','https://attacker.test','same-origin'],['https://9237599c-gndott.theangelorgapps.workers.dev','https://9237599c-gndott.theangelorgapps.workers.dev','same-origin']])assert.throws(()=>helpers.allowedCheckoutOrigin(url,origin,site))
const plan={id:6,status:1,name:'Monthly',price:9,duration:'month',duration_value:1}
assert.equal(helpers.quoteFor(plan).totalCents,900)
assert.equal(helpers.quoteFor({...plan,price:9.99},{status:1,code:'SAVE',discount_type:'percent',discount:15}).totalCents,849)
for(const bad of [null,'',-1,Infinity,NaN])assert.throws(()=>helpers.quoteFor({...plan,price:bad}))
assert.throws(()=>helpers.quoteFor({...plan,duration:'forever'}))
assert.throws(()=>helpers.quoteFor(plan,{status:1,code:'OLD',discount_type:'fixed',discount:1,expire_date:'2020-01-01'}))
assert.throws(()=>helpers.quoteFor(plan,{status:1,code:'BAD',discount_type:'typo',discount:9}))
assert.equal(helpers.planEndDate('month',1,new Date('2027-01-31T12:00:00Z')),'2027-02-28')
assert.equal(helpers.planEndDate('year',1,new Date('2024-02-29T12:00:00Z')),'2025-02-28')
assert.equal(helpers.planEndDate('week',2,new Date('2026-11-01T12:00:00Z')),'2026-11-15')

// Stripe-hosted checkout URLs: default domain, or the account's configured custom domain only.
assert.equal(helpers.stripeCheckoutUrl({id:'cs_test_abc123',url:'https://checkout.stripe.com/c/pay/cs_test_abc123'}),'https://checkout.stripe.com/c/pay/cs_test_abc123')
env.STRIPE_CHECKOUT_HOST='pay.uebertangelstore.com'
assert.equal(helpers.stripeCheckoutUrl({id:'cs_live_abc123',url:'https://pay.uebertangelstore.com/c/pay/cs_live_abc123'}),'https://pay.uebertangelstore.com/c/pay/cs_live_abc123')
for (const bad of ['https://evil.test/c/pay/cs_live_abc123','http://pay.uebertangelstore.com/c/pay/cs_live_abc123','https://pay.uebertangelstore.com.evil.test/','https://checkout.stripe.com@evil.test/']) assert.throws(()=>helpers.stripeCheckoutUrl({id:'cs_live_abc123',url:bad}),/valid checkout/,bad)
delete env.STRIPE_CHECKOUT_HOST
assert.throws(()=>helpers.stripeCheckoutUrl({id:'cs_live_abc123',url:'https://pay.uebertangelstore.com/c/pay/cs_live_abc123'}),/valid checkout/,'Custom checkout domain must not be trusted without configuration')

// API handlers check origin + active account before creating a provider session.
{
 const f=fixture()
 const info=await handlers.getCheckoutInfo({data:{planId:6}})
 assert.equal(info.gateways.length,1);assert.equal(info.gateways[0].id,'stripe');assert.equal(info.quote.totalCents,900)
 assert.equal((await handlers.validateCoupon({data:{planId:6,code:'SAVE10',amount:0.01}})).quote.totalCents,810,'Coupon total comes from server plan, never client amount')
 headers.origin='https://attacker.test';assert.equal((await handlers.subscribePlan({data:f.input()})).ok,false);assert.equal(f.requests.length,0)
 f.bind();viewer=null;assert.equal((await handlers.subscribePlan({data:f.input()})).needsAuth,true);assert.equal(f.requests.length,0)
 f.bind();f.sql.prepare('UPDATE users SET is_banned=1 WHERE id=1').run();assert.equal((await handlers.subscribePlan({data:f.input()})).needsAuth,true)
 f.sql.prepare('UPDATE users SET is_banned=0 WHERE id=1').run()
 assert.equal((await handlers.subscribePlan({data:f.input({gateway:'cash'})})).ok,false);assert.equal(f.requests.length,0);assert.equal(f.count('subscriptions_transactions'),0)
 f.sql.prepare("UPDATE settings SET val='0' WHERE name='str_payment_method'").run();assert.equal((await handlers.subscribePlan({data:f.input()})).ok,false)
 f.sql.prepare("UPDATE settings SET val='1' WHERE name='str_payment_method'").run()
 assert.equal((await handlers.subscribePlan({data:f.input({expectedTotalCents:1})})).ok,false)
 const result=await handlers.subscribePlan({data:f.input()});assert.equal(result.ok,true);assert.match(result.checkoutUrl,/^https:\/\/checkout\.stripe\.com\//)
 const session=[...f.sessions.values()][0];f.sessions.set(session.id,f.paid(session));viewer={userId:2};assert.equal((await handlers.confirmStripeSession({data:{sessionId:session.id}})).ok,false);assert.equal(f.requests.length,1,'Foreign account never triggers provider retrieval')
 viewer={userId:1};assert.equal((await handlers.confirmStripeSession({data:{sessionId:session.id}})).ok,true)
 assert.equal(f.count('subscriptions_transactions'),1);f.close()
}

// Immutable price/access snapshot, real paid activation and concurrent browser/webhook retries.
{
 const f=fixture(),{data,session}=await f.create({couponCode:'SAVE10',expectedTotalCents:810})
 await helpers.createSubscriptionCheckout(f.adapter,{id:1,email:'viewer@example.test'},data,prod,'test-secret',f.transport)
 assert.equal(f.requests.length,1,'A repeat click reuses its existing Checkout session')
 assert.equal(f.count('subscription_checkouts'),1)
 const snapshot=f.sql.prepare('SELECT * FROM subscription_checkouts').get();assert.equal(snapshot.total_cents,810)
 f.sql.prepare("UPDATE plan SET name='Changed later',price=199,duration='year',duration_value=10 WHERE id=6").run()
 const payment=f.paid(session)
 await Promise.all([helpers.fulfillSubscription(f.adapter,payment,1,new Date('2027-01-31T12:00:00Z')),helpers.fulfillSubscription(f.adapter,payment,undefined,new Date('2027-01-31T12:00:00Z'))])
 assert.equal(f.count('subscriptions'),2);assert.equal(f.count('subscriptions_transactions'),1)
 const sub=f.sql.prepare("SELECT * FROM subscriptions WHERE payment_id=?").get(session.id)
 assert.equal(sub.name,'Monthly Plan');assert.equal(sub.total_amount,8.1);assert.equal(sub.amount,9);assert.equal(sub.coupon_discount,.9);assert.equal(sub.end_date,'2027-02-28');assert.equal(sub.plan_type,'stripe');assert.equal(sub.is_manual,0)
 assert.equal(f.sql.prepare('SELECT status FROM subscriptions WHERE id=1').get().status,'inactive')
 assert.equal(f.sql.prepare('SELECT is_subscribe FROM users WHERE id=1').get().is_subscribe,1)
 assert.equal((await helpers.fulfillSubscription(f.adapter,payment,1)).already,true)
 assert.equal(f.count('subscriptions_transactions'),1);f.close()
}

// Reject unpaid, mismatched, cross-account or forged sessions without changing existing access.
for(const mutate of [s=>({...s,payment_status:'unpaid'}),s=>({...s,status:'open'}),s=>({...s,amount_total:1}),s=>({...s,currency:'eur'}),s=>({...s,mode:'subscription'}),s=>({...s,client_reference_id:'2'}),s=>({...s,metadata:{...s.metadata,user_id:'2'}}),s=>({...s,metadata:{...s.metadata,plan_id:'99'}}),s=>({...s,metadata:{...s.metadata,purpose:'store'}}),s=>({...s,metadata:{...s.metadata,checkout_id:'wrong'}})]){
 const f=fixture(),{session}=await f.create()
 await assert.rejects(helpers.fulfillSubscription(f.adapter,mutate(f.paid(session)),1))
 assert.equal(f.count('subscriptions_transactions'),0);assert.equal(f.count('subscriptions'),1);assert.equal(f.sql.prepare('SELECT status FROM subscriptions WHERE id=1').get().status,'active');f.close()
}
{
 const f=fixture(),{session}=await f.create()
 await assert.rejects(helpers.fulfillSubscription(f.adapter,f.paid(session),2))
 f.sql.prepare('UPDATE users SET status=0 WHERE id=1').run()
 await assert.rejects(helpers.fulfillSubscription(f.adapter,f.paid(session),1),/cannot be activated/)
 assert.equal(f.count('subscriptions_transactions'),0);assert.equal(f.count('subscriptions'),1);f.close()
}

// Transaction failure after insertion rolls back both access and claim; a subsequent retry succeeds.
{
 const f=fixture(),{session}=await f.create();f.adapter.failAt=3
 await assert.rejects(helpers.fulfillSubscription(f.adapter,f.paid(session),1),/Injected/)
 assert.equal(f.count('subscriptions'),1);assert.equal(f.count('subscriptions_transactions'),0);assert.equal(f.sql.prepare('SELECT status FROM subscription_checkouts').get().status,'pending')
 assert.equal(f.sql.prepare('SELECT status FROM subscriptions WHERE id=1').get().status,'active')
 f.adapter.failAt=-1;await helpers.fulfillSubscription(f.adapter,f.paid(session),1);assert.equal(f.count('subscriptions_transactions'),1);f.close()
}
{
 const f=fixture(),{session}=await f.create({couponCode:'FREE',expectedTotalCents:0})
 await helpers.fulfillSubscription(f.adapter,f.paid(session),1)
 assert.equal(f.sql.prepare('SELECT amount FROM subscriptions_transactions').get().amount,0,'An explicitly valid 100% coupon can complete through Stripe without a charge');f.close()
}

// Provider redirects are not followed, so bearer credentials cannot leave Stripe.
{
 const f=fixture()
 await assert.rejects(helpers.createSubscriptionCheckout(f.adapter,{id:1,email:'viewer@example.test'},f.input(),prod,'test-secret',async(_url,opts)=>{
  assert.equal(opts.redirect,'manual');return new Response('',{status:302,headers:{Location:'https://attacker.test'}})
 }))
 assert.equal(f.count('subscriptions_transactions'),0);f.close()
}

// A provider transport failure stores the quote but does not grant access; retry uses its same idempotency key.
{
 const f=fixture(),data=f.input();let attemptedKey
 await assert.rejects(helpers.createSubscriptionCheckout(f.adapter,{id:1,email:'viewer@example.test'},data,prod,'test-secret',async(_url,opts)=>{attemptedKey=opts.headers['Idempotency-Key'];return new Response('{}',{status:503})}))
 assert.equal(f.count('subscriptions'),1);assert.equal(f.count('subscriptions_transactions'),0)
 await helpers.createSubscriptionCheckout(f.adapter,{id:1,email:'viewer@example.test'},data,prod,'test-secret',f.transport)
 assert.equal(f.requests[0].options.headers['Idempotency-Key'],attemptedKey);f.close()
}

async function signature(raw,secret='whsec_fixture',timestamp=Math.floor(Date.now()/1000)){
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const bytes=await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${raw}`))
 return `t=${timestamp},v1=${Buffer.from(bytes).toString('hex')}`
}
// Authenticated provider callbacks recover payments even when the purchaser never returns to the website.
{
 const f=fixture(),{session}=await f.create(),event={type:'checkout.session.completed',data:{object:f.paid(session)}}
 const raw=JSON.stringify(event),sig=await signature(raw)
 assert.equal((await helpers.verifyStripeWebhook(raw,sig,'whsec_fixture')).type,event.type)
 await assert.rejects(helpers.verifyStripeWebhook(raw+' ',sig,'whsec_fixture'))
 await assert.rejects(helpers.verifyStripeWebhook(raw,await signature(raw,'wrong-secret'),'whsec_fixture'))
 await assert.rejects(helpers.verifyStripeWebhook(raw,await signature(raw,'whsec_fixture',1),'whsec_fixture'))
 const request=()=>new Request(`${prod}/api/stripe-webhook`,{method:'POST',body:raw,headers:{'stripe-signature':sig}})
 assert.equal((await helpers.handleSubscriptionWebhook(request())).status,200)
 assert.equal((await helpers.handleSubscriptionWebhook(request())).status,200)
 assert.equal(f.count('subscriptions_transactions'),1)
 assert.equal((await helpers.handleSubscriptionWebhook(new Request(`${prod}/api/stripe-webhook`,{method:'POST',body:raw,headers:{'stripe-signature':'invalid'}}))).status,400)
 assert.equal((await helpers.handleSubscriptionWebhook(new Request(`${prod}/api/stripe-webhook`,{method:'POST',body:'x'.repeat(262145)}))).status,400,'Chunked/missing-length oversized payload is bounded')
 assert.equal(f.count('subscriptions_transactions'),1)
 const unrelated=JSON.stringify({type:'customer.updated',data:{object:{}}})
 assert.equal((await helpers.handleSubscriptionWebhook(new Request(`${prod}/api/stripe-webhook`,{method:'POST',body:unrelated,headers:{'stripe-signature':await signature(unrelated)}}))).status,200)
 assert.equal(f.count('subscriptions_transactions'),1);f.close()
}

// Static checks only cover presentation wiring; security assertions above execute production code.
const ui=read('src/routes/subscription-plan.tsx'),css=read('src/subscription-checkout.css')
assert.match(ui,/node\?\.showModal\(\)/,'Native modal provides keyboard focus containment')
assert.match(ui,/expectedTotalCents: quote.totalCents/)
assert.match(ui,/No automatic renewal/)
assert.doesNotMatch(ui,/cardNumber|card-number|security-code|\bCVV\b|origin: window.location/)
assert.match(css,/@media \(max-width: 640px\)/)
assert.match(css,/prefers-reduced-motion/)
console.log('SUBSCRIPTION_CHECKOUT_PASS')
