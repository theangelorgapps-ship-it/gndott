import { env } from 'cloudflare:workers'
import { getRequestHeader, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { getActiveViewer } from './viewer.server'
import { CheckoutError, checkoutError } from './checkoutError'

export { CheckoutError, checkoutError }

const STRIPE = 'https://api.stripe.com/v1'
const PRODUCTION_ORIGIN = 'https://halobox.tv'
const validId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
export type CheckoutQuote = {
  planId: number; name: string; duration: 'day'|'week'|'month'|'year'; durationValue: number;
  priceCents: number; discountCents: number; totalCents: number; currency: 'usd'; couponCode: string
}
type Snapshot = {
  id: string; user_id: number; plan_id: number; plan_name: string; plan_identifier: string; plan_level: number;
  duration: string; duration_value: number; price_cents: number; discount_cents: number; total_cents: number;
  currency: string; coupon_code: string; customer_email: string; return_origin: string;
  stripe_session_id: string|null; checkout_url: string|null; expires_at: number|null; status: string; end_date: string|null
}
export function allowedCheckoutOrigin(requestUrl: string, origin: string | undefined, fetchSite: string | undefined, configured?: string) {
  const request = new URL(requestUrl)
  const target = configured ? new URL(configured).origin : PRODUCTION_ORIGIN
  const local = request.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(request.hostname)
  if (origin !== request.origin || fetchSite === 'cross-site' || (!local && request.origin !== target) || (!local && request.protocol !== 'https:')) {
    throw new CheckoutError('Open checkout from Halobox and try again.')
  }
  return request.origin
}
export function subscriptionWriteOrigin() {
  setResponseHeader('Cache-Control', 'private, no-store')
  return allowedCheckoutOrigin(String(getRequestUrl()), getRequestHeader('origin'), getRequestHeader('sec-fetch-site'), (env as any).SUBSCRIPTION_CHECKOUT_ORIGIN)
}
function database() { return (env as any).DB as D1Database }
async function setting(db: D1Database, name: string) {
  return (await db.prepare('SELECT val FROM settings WHERE name = ? AND deleted_at IS NULL LIMIT 1').bind(name).first<{val:string}>())?.val
}
export async function subscriptionActor() {
  const viewer = await getActiveViewer()
  if (!viewer) return null
  return database().prepare('SELECT id,email FROM users WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0').bind(viewer.userId).first<{id:number;email:string}>()
}
export async function stripeConfiguration() {
  const db = database()
  const secret = (env as any).STRIPE_SECRET_KEY || await setting(db, 'stripe_secretkey')
  const enabled = await setting(db, 'str_payment_method') === '1'
  return { db, secret: typeof secret === 'string' ? secret : '', enabled }
}
/** Validate a Stripe-hosted checkout URL: the default Stripe domain or the account's custom checkout domain. */
export function stripeCheckoutUrl(session: any): string {
  let safeUrl: URL
  try { safeUrl = new URL(session.url) } catch { throw new CheckoutError('Stripe did not return a checkout link. Please try again.') }
  const customHost = String((env as any).STRIPE_CHECKOUT_HOST || '').trim().toLowerCase()
  const hostOk = safeUrl.hostname === 'checkout.stripe.com' || (customHost !== '' && safeUrl.hostname === customHost && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(customHost))
  if (!/^cs_(?:test_|live_)?[a-zA-Z0-9]+$/.test(session.id || '') || safeUrl.protocol !== 'https:' || !hostOk || safeUrl.username || safeUrl.password) {
    console.warn('Stripe checkout session rejected:', String(session.id || '').slice(0, 12), safeUrl.hostname)
    throw new CheckoutError('Stripe did not return a valid checkout. Please try again.')
  }
  return safeUrl.href
}
export function quoteFor(plan: any, coupon: any = null, now = new Date()): CheckoutQuote {
  if (!plan || !validId(Number(plan.id)) || Number(plan.status) !== 1 || plan.deleted_at) throw new CheckoutError('This plan is unavailable.')
  const amount = Number(plan.price)
  if (plan.price == null || plan.price === '' || !Number.isFinite(amount) || amount < 0 || amount > 999999.99) throw new CheckoutError('This plan has no valid price. Please contact support.')
  if (!['day','week','month','year'].includes(plan.duration) || !Number.isSafeInteger(Number(plan.duration_value)) || Number(plan.duration_value) < 1 || Number(plan.duration_value) > 120) throw new CheckoutError('This plan has no valid access period. Please contact support.')
  const priceCents = Math.round(amount * 100)
  let discountCents = 0
  if (coupon) {
    const today = now.toISOString().slice(0,10)
    const value = Number(coupon.discount)
    if (Number(coupon.status) !== 1 || coupon.deleted_at || (coupon.start_date && String(coupon.start_date).slice(0,10) > today) || (coupon.expire_date && String(coupon.expire_date).slice(0,10) < today)) throw new CheckoutError('This coupon is not currently available.')
    if (!['percent','percentage','fixed','amount'].includes(coupon.discount_type) || coupon.discount == null || !Number.isFinite(value) || value < 0) throw new CheckoutError('This coupon is invalid.')
    const percent = ['percent','percentage'].includes(coupon.discount_type)
    discountCents = Math.min(priceCents, Math.round(percent ? priceCents * Math.min(value,100) / 100 : value * 100))
  }
  return { planId:Number(plan.id), name:String(plan.name), duration:plan.duration, durationValue:Number(plan.duration_value), priceCents, discountCents, totalCents:priceCents-discountCents, currency:'usd', couponCode:coupon ? String(coupon.code) : '' }
}
function couponInput(code: unknown) {
  if (code == null || code === '') return ''
  if (typeof code !== 'string' || code.trim().length > 100) throw new CheckoutError('Enter a valid coupon code.')
  return code.trim()
}
export async function readSubscriptionQuote(db: D1Database, planId: number, code?: string) {
  if (!validId(planId)) throw new CheckoutError('Choose a valid plan.')
  const normalized = couponInput(code)
  const plan = await db.prepare('SELECT * FROM plan WHERE id=? AND status=1 AND deleted_at IS NULL').bind(planId).first<any>()
  const coupon = normalized ? await db.prepare('SELECT * FROM coupons WHERE code=? AND status=1 AND deleted_at IS NULL').bind(normalized).first<any>() : null
  if (normalized && !coupon) throw new CheckoutError('This coupon is invalid or no longer available.')
  return { plan, quote:quoteFor(plan,coupon) }
}
export async function getSubscriptionCheckoutInfo(planId?: number) {
  setResponseHeader('Cache-Control', 'private, no-store')
  const {db,secret,enabled} = await stripeConfiguration()
  const quote = planId ? (await readSubscriptionQuote(db, planId)).quote : null
  return { gateways:enabled && secret ? [{id:'stripe',label:'Secure payment with Stripe'}] : [], quote }
}
export async function stripeRequest(path: string, secret: string, transport: typeof fetch, body?: URLSearchParams, key?: string) {
  const result = await transport(`${STRIPE}${path}`, {
    method:body ? 'POST' : 'GET', redirect:'manual', signal:AbortSignal.timeout(15000),
    headers:{Authorization:`Bearer ${secret}`,'Stripe-Version':'2025-04-30.basil',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},
    body:body?.toString(),
  })
  if (!result.ok) throw new CheckoutError('Stripe could not complete this request. Please try again.')
  return result.json() as Promise<any>
}
export async function createSubscriptionCheckout(db: D1Database, user: {id:number;email:string}, data: {planId:number;gateway:string;couponCode?:string;requestKey:string;expectedTotalCents:number}, origin:string, secret:string, transport:typeof fetch=fetch) {
  if (data.gateway !== 'stripe') throw new CheckoutError('Use secure Stripe checkout to activate a plan.')
  if (!validId(user.id) || !/^.{1,254}@.{1,254}$/.test(user.email)) throw new CheckoutError('Sign in with an active account to subscribe.')
  if (typeof data.requestKey !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(data.requestKey)) throw new CheckoutError('Refresh checkout and try again.')
  if (!Number.isSafeInteger(data.expectedTotalCents) || data.expectedTotalCents < 0) throw new CheckoutError('Review the current plan total before paying.')
  const {plan,quote} = await readSubscriptionQuote(db,data.planId,data.couponCode)
  if (quote.totalCents !== data.expectedTotalCents) throw new CheckoutError('The price has changed. Close checkout and review the updated total.')
  const checkoutId=crypto.randomUUID()
  await db.prepare(`INSERT OR IGNORE INTO subscription_checkouts(id,request_key,user_id,plan_id,plan_name,plan_identifier,plan_level,duration,duration_value,price_cents,discount_cents,total_cents,currency,coupon_code,return_origin,customer_email)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0)`)
    .bind(checkoutId,data.requestKey,user.id,quote.planId,quote.name,String(plan.identifier||plan.name),Number(plan.level)||0,quote.duration,quote.durationValue,quote.priceCents,quote.discountCents,quote.totalCents,quote.currency,quote.couponCode,origin,user.email,user.id).run()
  const snapshot=await db.prepare('SELECT * FROM subscription_checkouts WHERE user_id=? AND request_key=?').bind(user.id,data.requestKey).first<Snapshot>()
  if (!snapshot) throw new CheckoutError('Sign in with an active account to subscribe.')
  if (snapshot.plan_id !== data.planId || snapshot.coupon_code !== quote.couponCode || snapshot.total_cents !== data.expectedTotalCents) throw new CheckoutError('This checkout has changed. Close it and choose your plan again.')
  if (snapshot.status==='paid') return {ok:true as const,already:true,end:snapshot.end_date}
  if (snapshot.stripe_session_id) {
    if (snapshot.checkout_url && snapshot.expires_at && snapshot.expires_at > Date.now()/1000) return {ok:true as const,checkoutUrl:snapshot.checkout_url}
    throw new CheckoutError('This checkout has expired. Close it and start again.')
  }
  const body=new URLSearchParams({mode:'payment','payment_method_types[0]':'card','line_items[0][price_data][currency]':snapshot.currency,
    'line_items[0][price_data][product_data][name]':`${snapshot.plan_name} — ${snapshot.duration_value} ${snapshot.duration} access`,
    'line_items[0][price_data][unit_amount]':String(snapshot.total_cents),'line_items[0][quantity]':'1',
    success_url:`${snapshot.return_origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${snapshot.return_origin}/subscription-plan?cancelled=1`,
    customer_email:snapshot.customer_email,client_reference_id:String(snapshot.user_id),'metadata[purpose]':'halobox_subscription',
    'metadata[checkout_id]':snapshot.id,'metadata[user_id]':String(snapshot.user_id),'metadata[plan_id]':String(snapshot.plan_id),
  })
  const session=await stripeRequest('/checkout/sessions',secret,transport,body,`halobox-subscription-${snapshot.id}`)
  const checkoutUrl = stripeCheckoutUrl(session)
  if (!Number.isSafeInteger(session.expires_at)) throw new CheckoutError('Stripe did not return a valid checkout. Please try again.')
  await db.prepare('UPDATE subscription_checkouts SET stripe_session_id=?,checkout_url=?,expires_at=? WHERE id=? AND stripe_session_id IS NULL').bind(session.id,checkoutUrl,session.expires_at,snapshot.id).run()
  return {ok:true as const,checkoutUrl}
}
export function planEndDate(duration:string, count:number, now=new Date()) {
  const date=new Date(now)
  if (duration==='month' || duration==='year') {
    const day=date.getUTCDate();date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth()+(duration==='year'?count*12:count))
    const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()
    date.setUTCDate(Math.min(day,last))
  } else date.setUTCDate(date.getUTCDate()+(duration==='week'?7:1)*count)
  return date.toISOString().slice(0,10)
}
export function verifySubscriptionPayment(session:any, snapshot:Snapshot, userId?:number) {
  if (!session || session.id!==snapshot.stripe_session_id || session.mode!=='payment' || session.status!=='complete' ||
    session.metadata?.purpose!=='halobox_subscription' || session.metadata?.checkout_id!==snapshot.id ||
    String(session.metadata?.user_id)!==String(snapshot.user_id) || String(session.client_reference_id)!==String(snapshot.user_id) ||
    String(session.metadata?.plan_id)!==String(snapshot.plan_id) || (userId!==undefined && userId!==snapshot.user_id)) throw new CheckoutError('This payment does not match your checkout.')
  if (session.amount_total!==snapshot.total_cents || session.currency!==snapshot.currency) throw new CheckoutError('The paid amount does not match this checkout. Please contact support.')
  const paid=session.payment_status==='paid' || (snapshot.total_cents===0 && session.payment_status==='no_payment_required')
  if (!paid) throw new CheckoutError('Payment is not completed yet. Try checking again in a moment.')
}
export async function fulfillSubscription(db:D1Database, stripeSession:any, userId?:number, now=new Date()) {
  const snapshot=await db.prepare('SELECT * FROM subscription_checkouts WHERE stripe_session_id=?').bind(stripeSession?.id||'').first<Snapshot>()
  if (!snapshot) throw new CheckoutError('This checkout could not be found. Please contact support with your payment reference.')
  verifySubscriptionPayment(stripeSession,snapshot,userId)
  if (snapshot.status==='paid') return {ok:true as const,already:true,end:snapshot.end_date}
  const token=crypto.randomUUID(), start=now.toISOString().slice(0,10), end=planEndDate(snapshot.duration,snapshot.duration_value,now)
  const condition='id=? AND activation_token=? AND status=\'activating\''
  const statements=[
    db.prepare(`UPDATE subscription_checkouts SET status='activating',activation_token=?,start_date=?,end_date=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM users WHERE id=subscription_checkouts.user_id AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0)`).bind(token,start,end,snapshot.id),
    db.prepare(`INSERT INTO subscriptions(plan_id,user_id,start_date,end_date,status,is_manual,amount,discount_percentage,tax_amount,coupon_discount,total_amount,name,identifier,type,duration,level,plan_type,payment_id,created_at,updated_at)
      SELECT plan_id,user_id,start_date,end_date,'active',0,price_cents/100.0,0,0,discount_cents/100.0,total_cents/100.0,plan_name,plan_identifier,'subscription',duration,plan_level,'stripe',stripe_session_id,datetime('now'),datetime('now') FROM subscription_checkouts WHERE ${condition}`).bind(snapshot.id,token),
    db.prepare(`UPDATE subscription_checkouts SET subscription_id=(SELECT id FROM subscriptions WHERE payment_id=subscription_checkouts.stripe_session_id AND user_id=subscription_checkouts.user_id AND plan_type='stripe' ORDER BY id DESC LIMIT 1) WHERE ${condition}`).bind(snapshot.id,token),
    db.prepare(`INSERT INTO subscriptions_transactions(subscriptions_id,user_id,amount,payment_type,payment_status,transaction_id,created_at,updated_at) SELECT subscription_id,user_id,total_cents/100.0,'stripe','paid',stripe_session_id,datetime('now'),datetime('now') FROM subscription_checkouts WHERE ${condition}`).bind(snapshot.id,token),
    db.prepare(`UPDATE subscriptions SET status='inactive',updated_at=datetime('now') WHERE user_id=? AND status='active' AND deleted_at IS NULL AND id!=(SELECT subscription_id FROM subscription_checkouts WHERE ${condition})`).bind(snapshot.user_id,snapshot.id,token),
    db.prepare(`UPDATE users SET is_subscribe=1,updated_at=datetime('now') WHERE id=? AND EXISTS(SELECT 1 FROM subscription_checkouts WHERE ${condition})`).bind(snapshot.user_id,snapshot.id,token),
    db.prepare(`UPDATE subscription_checkouts SET status='paid',activated_at=datetime('now'),activation_token=NULL WHERE ${condition}`).bind(snapshot.id,token),
  ]
  await db.batch(statements)
  const completed=await db.prepare('SELECT status,end_date FROM subscription_checkouts WHERE id=?').bind(snapshot.id).first<{status:string;end_date:string}>()
  if (completed?.status!=='paid') throw new CheckoutError('Your payment is received, but this account cannot be activated. Please contact support.')
  return {ok:true as const,end:completed.end_date}
}
export async function confirmSubscriptionCheckout(sessionId:string,userId:number) {
  if (!/^cs_(?:test_|live_)?[a-zA-Z0-9]+$/.test(sessionId) || sessionId.length>255) throw new CheckoutError('This payment reference is invalid.')
  const {db,secret}=await stripeConfiguration()
  if (!secret) throw new CheckoutError('Payment verification is temporarily unavailable. Please try again.')
  // Verify ownership before retrieving any provider data.
  const owned=await db.prepare('SELECT id FROM subscription_checkouts WHERE stripe_session_id=? AND user_id=?').bind(sessionId,userId).first()
  if (!owned) throw new CheckoutError('This payment does not belong to your account.')
  return fulfillSubscription(db,await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`,secret,fetch),userId)
}

export async function verifyStripeWebhook(raw:string, signature:string, secret:string, now=Math.floor(Date.now()/1000)) {
  if (!secret || raw.length>262144 || signature.length>4096) throw new CheckoutError('Invalid webhook.')
  const parts=signature.split(',').map(part=>part.trim().split('=')), timestamps=parts.filter(([key])=>key==='t')
  const timestamp=timestamps.length===1?Number(timestamps[0][1]):NaN
  const signatures=parts.filter(([key,value])=>key==='v1'&&/^[a-f\d]{64}$/i.test(value||'')).map(([,value])=>value)
  if (!Number.isSafeInteger(timestamp) || Math.abs(now-timestamp)>300 || !signatures.length) throw new CheckoutError('Invalid webhook signature.')
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify'])
  const payload=new TextEncoder().encode(`${timestamp}.${raw}`)
  let valid=false
  for (const value of signatures) if (await crypto.subtle.verify('HMAC',key,Uint8Array.from(value.match(/../g)!,byte=>parseInt(byte,16)),payload)) valid=true
  if (!valid) throw new CheckoutError('Invalid webhook signature.')
  return JSON.parse(raw)
}
export async function boundedWebhookBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new CheckoutError('Missing webhook body.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 262144) { await reader.cancel(); throw new CheckoutError('Webhook body is too large.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const data = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder('utf-8', { fatal: true }).decode(data)
}
export async function handleSubscriptionWebhook(request:Request) {
  const primary=(env as any).STRIPE_SUBSCRIPTION_WEBHOOK_SECRET
  if (typeof primary!=='string' || !primary) return new Response('Webhook is not configured.',{status:503})
  if (Number(request.headers.get('content-length')||0)>262144) return new Response('Payload too large.',{status:413})
  // Giving may run on its own Stripe account (test mode): its endpoint signs
  // with its own secret, so try both before rejecting the signature.
  const giving=await database().prepare(`SELECT val FROM settings WHERE name='giving_stripe_webhook_secret' AND deleted_at IS NULL LIMIT 1`).first<{val:string}>().then(row=>String(row?.val??'').trim()).catch(()=> '')
  const secrets=[primary,...(giving?[giving]:[])]
  let event:any, verified=false, lastError:unknown
  for (const secret of secrets) {
    try { event=await verifyStripeWebhook(await boundedWebhookBody(request.clone() as unknown as Request),request.headers.get('stripe-signature')||'',secret); verified=true; break }
    catch (error) { lastError=error }
  }
  if (!verified) { void lastError; return new Response('Invalid webhook.',{status:400}) }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded', 'invoice.payment_succeeded'].includes(event.type)) return new Response('Ignored.', { status: 200 })
  const purpose = event.data?.object?.metadata?.purpose
  if (event.type === 'payment_intent.succeeded' && purpose === 'halobox_giving') {
    try {
      const giving = await import('./giving.server')
      await giving.fulfillPaymentIntentEvent(database(), event.data.object)
      return new Response('Received.', { status: 200 })
    } catch { return new Response('Fulfilment not completed; retry required.', { status: 500 }) }
  }
  if (event.type === 'invoice.payment_succeeded') {
    try {
      const giving = await import('./giving.server')
      await giving.fulfillInvoiceEvent(database(), event.data.object)
      return new Response('Received.', { status: 200 })
    } catch { return new Response('Fulfilment not completed; retry required.', { status: 500 }) }
  }
  if (purpose === 'halobox_giving') {
    try {
      if (event.data.object.payment_status==='unpaid') return new Response('Awaiting payment.',{status:200})
      const giving = await import('./giving.server')
      await giving.fulfillDonation(database(),event.data.object)
      return new Response('Received.',{status:200})
    } catch { return new Response('Fulfilment not completed; retry required.',{status:500}) }
  }
  if (purpose === 'halobox_store_order') {
    try {
      if (event.data.object.payment_status==='unpaid') return new Response('Awaiting payment.',{status:200})
      const store = await import('./storeCheckout.server')
      await store.fulfillStoreOrder(database(),event.data.object)
      return new Response('Received.',{status:200})
    } catch { return new Response('Fulfilment not completed; retry required.',{status:500}) }
  }
  if (purpose!=='halobox_subscription') return new Response('Ignored.',{status:200})
  try {
    if (event.data.object.payment_status==='unpaid') return new Response('Awaiting payment.',{status:200})
    await fulfillSubscription(database(),event.data.object)
    return new Response('Received.',{status:200})
  } catch { return new Response('Fulfillment not completed; retry required.',{status:500}) }
}
