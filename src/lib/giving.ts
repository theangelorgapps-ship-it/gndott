import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { first, run } from './db'
import { getActiveViewer } from './viewer.server'
import { CheckoutError, checkoutError } from './checkoutError'

// Server-only checkout helpers come in through dynamic imports so this module
// stays importable from the client bundle (per the repo's import-protection
// rule for *.server.* files).
const server = () => import('./subscriptionCheckout.server')

// Giving: donations (Offering / Tithe / Partner / Seed) from the immersive
// player. Guests give with name/email/phone/country; signed-in viewers give
// from their account details. Partnership can repeat monthly (Stripe
// subscription); everything else is a one-time payment. Fulfilment is the
// Stripe webhook marking the donation paid — there is nothing to unlock, so
// the success page only confirms.
//
// Giving can run on its own Stripe account (e.g. test mode while rolling out):
// set `giving_stripe_secretkey` (and `giving_stripe_webhook_secret`) in admin
// settings; the shared subscription Stripe config is the fallback.

export const GIVING_KINDS = ['offering', 'tithe', 'partner', 'seed'] as const
export type GivingKind = (typeof GIVING_KINDS)[number]
export type GivingFrequency = 'one_time' | 'monthly'

const STRIPE = 'https://api.stripe.com/v1'

async function givingOrigin() {
  setResponseHeader('Cache-Control', 'private, no-store')
  // Same CSRF posture as subscription checkout: same-origin form posts only.
  return (await server()).subscriptionWriteOrigin()
}

const KIND_LABEL: Record<GivingKind, string> = { offering: 'Offering', tithe: 'Tithe', partner: 'Partnership', seed: 'Seed' }

/** Giving-specific Stripe config; falls back to the shared subscription config. */
async function givingConfiguration() {
  const shared = await (await server()).stripeConfiguration()
  const rows = await shared.db.prepare(`SELECT name, val FROM settings WHERE name IN ('giving_stripe_enabled','giving_stripe_secretkey','giving_stripe_publishablekey') AND deleted_at IS NULL`).all<any>().catch(() => ({ results: [] as any[] }))
  const map = Object.fromEntries((rows.results ?? []).map((r: any) => [r.name, String(r.val ?? '')]))
  if (map.giving_stripe_enabled === '1' && map.giving_stripe_secretkey) {
    return { db: shared.db, secret: map.giving_stripe_secretkey as string, enabled: true, publishable: String(map.giving_stripe_publishablekey ?? '') }
  }
  return { ...shared, publishable: '' }
}

type GivingInput = { kind: GivingKind; frequency: GivingFrequency; amountCents: number; name: string; email: string; phone: string; country: string }

export function validateGivingInput(d: any): GivingInput {
  const kind = String(d?.kind ?? '') as GivingKind
  if (!GIVING_KINDS.includes(kind)) throw new CheckoutError('Choose what you are giving: Offering, Tithe, Partner or Seed.')
  const frequency = String(d?.frequency ?? 'one_time')
  if (frequency !== 'one_time' && frequency !== 'monthly') throw new CheckoutError('Choose one-time or monthly giving.')
  // Only Partnership repeats; every other kind is always one-time.
  if (frequency === 'monthly' && kind !== 'partner') throw new CheckoutError('Only Partnership can repeat monthly.')
  const amountCents = Number(d?.amountCents)
  if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 100000000) throw new CheckoutError('Enter an amount between $1.00 and $1,000,000.')
  const name = String(d?.name ?? '').trim()
  const email = String(d?.email ?? '').trim()
  const phone = String(d?.phone ?? '').trim()
  const country = String(d?.country ?? '').trim()
  if (name.length < 2 || name.length > 120) throw new CheckoutError('Enter your name.')
  if (!/^.{1,254}@.{1,254}$/.test(email)) throw new CheckoutError('Enter a valid email address.')
  if (phone.length > 40) throw new CheckoutError('Enter a valid phone number.')
  if (country.length > 80) throw new CheckoutError('Enter a valid country.')
  return { kind, frequency: frequency as GivingFrequency, amountCents, name, email, phone, country }
}

async function stripePost(path: string, secret: string, body: URLSearchParams, key: string) {
  const result = await fetch(`${STRIPE}${path}`, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${secret}`, 'Stripe-Version': '2025-04-30.basil', 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': key },
    body: body.toString(),
  })
  if (!result.ok) throw new CheckoutError('Stripe could not complete this request. Please try again.')
  return result.json() as Promise<any>
}

export const createGivingCheckout = createServerFn({ method: 'POST' })
  .validator(validateGivingInput)
  .handler(async ({ data }) => {
    const origin = await givingOrigin()
    const { db, secret, enabled } = await givingConfiguration()
    if (!enabled || !secret) throw new CheckoutError('Giving is temporarily unavailable. Please try again later.')
    // Signed-in viewers give from their account; guests from the details they entered.
    const viewer = await getActiveViewer()
    const user = viewer
      ? await first<any>(`SELECT id, email, first_name, last_name FROM users WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0`, viewer.userId)
      : null
    const donationId = crypto.randomUUID()
    const donor = {
      userId: user?.id ?? null,
      name: user ? ([user.first_name, user.last_name].filter(Boolean).join(' ') || data.name) : data.name,
      email: user ? String(user.email) : data.email,
    }
    await run(
      `INSERT INTO donations(id, user_id, name, email, phone, country, kind, frequency, amount_cents) VALUES(?,?,?,?,?,?,?,?,?)`,
      donationId, donor.userId, donor.name, donor.email, user ? '' : data.phone, user ? '' : data.country, data.kind, data.frequency, data.amountCents,
    )
    const monthly = data.frequency === 'monthly'
    const body = new URLSearchParams({
      mode: monthly ? 'subscription' : 'payment',
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `${KIND_LABEL[data.kind]}${monthly ? ' (monthly)' : ''} — GoodNews HaloBox`,
      'line_items[0][price_data][unit_amount]': String(data.amountCents), 'line_items[0][quantity]': '1',
      ...(monthly ? { 'line_items[0][price_data][recurring][interval]': 'month', 'line_items[0][price_data][recurring][interval_count]': '1' } : {}),
      success_url: `${origin}/giving-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?giving=cancelled`,
      customer_email: donor.email,
      ...(donor.userId ? { client_reference_id: String(donor.userId) } : {}),
      'metadata[purpose]': 'halobox_giving', 'metadata[donation_id]': donationId,
      'metadata[kind]': data.kind, 'metadata[frequency]': data.frequency,
      ...(donor.userId ? { 'metadata[user_id]': String(donor.userId) } : {}),
    })
    const session = await stripePost('/checkout/sessions', secret, body, `halobox-giving-${donationId}`)
    let safeUrl: URL
    try { safeUrl = new URL(session.url) } catch { throw new CheckoutError('Stripe did not return a checkout link. Please try again.') }
    if (!/^cs_(?:test_|live_)?[a-zA-Z0-9]+$/.test(session.id || '') || safeUrl.protocol !== 'https:' || safeUrl.hostname !== 'checkout.stripe.com' || safeUrl.username || safeUrl.password) {
      throw new CheckoutError('Stripe did not return a valid checkout. Please try again.')
    }
    await run(`UPDATE donations SET stripe_session_id=? WHERE id=? AND stripe_session_id IS NULL`, session.id, donationId)
    return { ok: true as const, checkoutUrl: safeUrl.href }
  })

export const confirmGivingCheckout = createServerFn({ method: 'POST' })
  .validator((d: { sessionId: string }) => {
    if (typeof d?.sessionId !== 'string' || !/^cs_(?:test_|live_)?[a-zA-Z0-9]+$/.test(d.sessionId) || d.sessionId.length > 255) throw new CheckoutError('This payment reference is invalid.')
    return d
  })
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { db, secret } = await givingConfiguration()
    if (!secret) throw new CheckoutError('Payment verification is temporarily unavailable. Please try again.')
    const result = await fetch(`${STRIPE}/checkout/sessions/${encodeURIComponent(data.sessionId)}`, {
      redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${secret}`, 'Stripe-Version': '2025-04-30.basil' },
    })
    if (!result.ok) throw new CheckoutError('Stripe could not complete this request. Please try again.')
    const { fulfillDonation } = await import('./giving.server')
    try {
      return await fulfillDonation(db, await result.json())
    } catch (error) {
      return { ok: false as const, error: checkoutError(error) }
    }
  })

export const getGivingStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { enabled, secret, publishable } = await givingConfiguration()
  return { available: enabled && !!secret && !!publishable, publishableKey: publishable || null }
})

// ---------- in-module payment (Payment Element) ----------

async function prepareDonation(data: GivingInput) {
  const origin = await givingOrigin()
  const { db, secret, enabled } = await givingConfiguration()
  if (!enabled || !secret) throw new CheckoutError('Giving is temporarily unavailable. Please try again later.')
  const viewer = await getActiveViewer()
  const user = viewer
    ? await first<any>(`SELECT id, email, first_name, last_name FROM users WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0`, viewer.userId)
    : null
  const donationId = crypto.randomUUID()
  const donor = {
    userId: user?.id ?? null,
    name: user ? ([user.first_name, user.last_name].filter(Boolean).join(' ') || data.name) : data.name,
    email: user ? String(user.email) : data.email,
  }
  return { origin, db, secret, user, donationId, donor }
}

/** Same-donor pending gifts from abandoned step-2 visits expire after 24 h so
 *  they stop counting as pending in admin and history views. */
async function expireStalePendingDonations(db: D1Database) {
  await run(`UPDATE donations SET status='expired' WHERE status='pending' AND created_at < datetime('now','-24 hours')`).catch(() => null)
}

const donorWhere = (user: { id: number } | null) => (user ? 'user_id=?' : 'LOWER(email)=LOWER(?)')
const donorParam = (user: { id: number } | null, donor: { email: string }) => (user ? user.id : donor.email)

/** A step-2 remount (Back → Continue, page refresh) used to mint a fresh
 *  donation row + PaymentIntent every time. Instead, reuse the matching
 *  pending gift created in the last hour when Stripe still holds a payable
 *  intent/subscription for it. */
async function findReusableDonation(db: D1Database, user: { id: number } | null, donor: { email: string }, data: GivingInput) {
  return first<any>(
    `SELECT * FROM donations WHERE status='pending' AND kind=? AND frequency=? AND amount_cents=? AND ${donorWhere(user)} AND created_at > datetime('now','-1 hour') ORDER BY created_at DESC LIMIT 1`,
    data.kind, data.frequency, data.amountCents, donorParam(user, donor),
  )
}

async function stripeGet(path: string, secret: string) {
  const result = await fetch(`${STRIPE}${path}`, {
    redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${secret}`, 'Stripe-Version': '2025-04-30.basil' },
  })
  if (!result.ok) throw new CheckoutError('Stripe could not complete this request. Please try again.')
  return result.json() as Promise<any>
}

/** Signed-in viewers get a Stripe customer once, so their card can be saved. */
async function givingCustomer(db: D1Database, secret: string, user: { id: number; email: string } | null, donor: { name: string; email: string }) {
  if (!user) return null
  const existing = await first<any>(`SELECT stripe_customer_id FROM giving_customers WHERE user_id=?`, user.id)
  if (existing) return String(existing.stripe_customer_id)
  const created = await stripePost('/customers', secret, new URLSearchParams({ email: user.email, name: donor.name, 'metadata[halobox_user_id]': String(user.id) }), `halobox-giving-customer-${user.id}`)
  if (!/^cus_[a-zA-Z0-9]+$/.test(created.id || '')) throw new CheckoutError('Stripe could not complete this request. Please try again.')
  await run(`INSERT OR IGNORE INTO giving_customers(user_id, stripe_customer_id) VALUES(?,?)`, user.id, created.id)
  const stored = await first<any>(`SELECT stripe_customer_id FROM giving_customers WHERE user_id=?`, user.id)
  return String(stored?.stripe_customer_id ?? created.id)
}

/** Guests have no giving_customers link; reuse their previous customer record
 *  (local donation history first, then a Stripe email lookup) so a repeat
 *  guest partner shares one customer instead of one per gift. */
async function guestGivingCustomer(db: D1Database, secret: string, donor: { name: string; email: string }, donationId: string) {
  const local = await first<any>(`SELECT stripe_customer FROM donations WHERE LOWER(email)=LOWER(?) AND stripe_customer IS NOT NULL ORDER BY created_at DESC LIMIT 1`, donor.email).catch(() => null)
  if (local && /^cus_[a-zA-Z0-9]+$/.test(String(local.stripe_customer ?? ''))) return String(local.stripe_customer)
  const found = await stripeGet(`/customers?email=${encodeURIComponent(donor.email)}&limit=1`, secret).catch(() => null)
  const foundId = found?.data?.[0]?.id
  if (/^cus_[a-zA-Z0-9]+$/.test(foundId || '')) return String(foundId)
  const created = await stripePost('/customers', secret, new URLSearchParams({ email: donor.email, name: donor.name }), `halobox-giving-guest-${donationId}`)
  if (!/^cus_[a-zA-Z0-9]+$/.test(created.id || '')) throw new CheckoutError('Stripe could not complete this request. Please try again.')
  return String(created.id)
}

export const createGivingIntent = createServerFn({ method: 'POST' })
  .validator(validateGivingInput)
  .handler(async ({ data }) => {
    const { origin, db, secret, user, donationId, donor } = await prepareDonation(data)
    const monthly = data.frequency === 'monthly'
    await expireStalePendingDonations(db)
    const returnUrl = `${origin}/giving-success`

    // Remount reuse: return the still-payable intent/subscription of the
    // matching pending gift instead of stacking a new row + Stripe object.
    const reusable = await findReusableDonation(db, user, donor, data)
    if (reusable) {
      if (!monthly && reusable.stripe_payment_intent) {
        const intent = await stripeGet(`/payment_intents/${encodeURIComponent(String(reusable.stripe_payment_intent))}`, secret).catch(() => null)
        if (intent && !['canceled', 'succeeded'].includes(String(intent.status)) && typeof intent.client_secret === 'string') {
          return { ok: true as const, donationId: String(reusable.id), clientSecret: intent.client_secret, returnUrl }
        }
      } else if (monthly && reusable.stripe_subscription_id) {
        const subscription = await stripeGet(`/subscriptions/${encodeURIComponent(String(reusable.stripe_subscription_id))}?expand[]=latest_invoice.confirmation_secret`, secret).catch(() => null)
        const clientSecret = subscription?.latest_invoice?.confirmation_secret?.client_secret
        if (subscription?.status === 'incomplete' && typeof clientSecret === 'string') {
          return { ok: true as const, donationId: String(reusable.id), clientSecret, returnUrl }
        }
      }
      // The Stripe object is gone or finished — retire the row and start fresh.
      await run(`UPDATE donations SET status='expired' WHERE id=? AND status='pending'`, reusable.id)
    }
    // Any older pending rows for this donor + gift type are superseded.
    await run(
      `UPDATE donations SET status='expired' WHERE status='pending' AND kind=? AND frequency=? AND ${donorWhere(user)}`,
      data.kind, data.frequency, donorParam(user, donor),
    )

    await run(
      `INSERT INTO donations(id, user_id, name, email, phone, country, kind, frequency, amount_cents) VALUES(?,?,?,?,?,?,?,?,?)`,
      donationId, donor.userId, donor.name, donor.email, user ? '' : data.phone, user ? '' : data.country, data.kind, data.frequency, data.amountCents,
    )
    const customer = await givingCustomer(db, secret, user, donor)
    const metadata = {
      'metadata[purpose]': 'halobox_giving', 'metadata[donation_id]': donationId,
      'metadata[kind]': data.kind, 'metadata[frequency]': data.frequency,
      ...(donor.userId ? { 'metadata[user_id]': String(donor.userId) } : {}),
    }
    if (!monthly) {
      const body = new URLSearchParams({
        amount: String(data.amountCents), currency: 'usd',
        'automatic_payment_methods[enabled]': 'true',
        receipt_email: donor.email,
        ...(customer ? { customer, setup_future_usage: 'off_session' } : {}),
        ...metadata,
      })
      const intent = await stripePost('/payment_intents', secret, body, `halobox-giving-pi-${donationId}`)
      if (!/^pi_[a-zA-Z0-9]+$/.test(intent.id || '') || typeof intent.client_secret !== 'string') throw new CheckoutError('Stripe did not return a payment. Please try again.')
      await run(`UPDATE donations SET stripe_payment_intent=?, stripe_customer=? WHERE id=?`, intent.id, customer, donationId)
      return { ok: true as const, donationId, clientSecret: intent.client_secret, returnUrl }
    }
    // Monthly partnership: a subscription whose first invoice confirms in-panel.
    // Guests reuse their existing Stripe customer rather than one per gift.
    const monthlyCustomer = customer ?? await guestGivingCustomer(db, secret, donor, donationId)
    const body = new URLSearchParams({
      customer: monthlyCustomer,
      'items[0][price_data][currency]': 'usd',
      'items[0][price_data][product_data][name]': 'Partnership (monthly) — GoodNews HaloBox',
      'items[0][price_data][unit_amount]': String(data.amountCents),
      'items[0][price_data][recurring][interval]': 'month',
      payment_behavior: 'default_incomplete',
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'expand[]': 'latest_invoice.confirmation_secret',
      ...metadata,
    })
    const subscription = await stripePost('/subscriptions', secret, body, `halobox-giving-sub-${donationId}`)
    const clientSecret = subscription?.latest_invoice?.confirmation_secret?.client_secret
    if (!/^sub_[a-zA-Z0-9]+$/.test(subscription.id || '') || typeof clientSecret !== 'string') throw new CheckoutError('Stripe did not return a subscription. Please try again.')
    await run(`UPDATE donations SET stripe_subscription_id=?, stripe_customer=?, stripe_payment_intent=? WHERE id=?`, subscription.id, monthlyCustomer, subscription.latest_invoice?.payment_intent ?? null, donationId)
    return { ok: true as const, donationId, clientSecret, returnUrl }
  })

export const listGivingCards = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const viewer = await getActiveViewer()
  if (!viewer) return { cards: [] as { id: string; brand: string; last4: string; exp: string }[] }
  const { secret } = await givingConfiguration()
  if (!secret) return { cards: [] }
  const link = await first<any>(`SELECT stripe_customer_id FROM giving_customers WHERE user_id=?`, viewer.userId)
  if (!link) return { cards: [] }
  const result = await stripeGet(`/payment_methods?customer=${encodeURIComponent(String(link.stripe_customer_id))}&type=card`, secret).catch(() => null)
  const cards = (result?.data ?? [])
    .filter((pm: any) => pm?.card?.last4)
    .map((pm: any) => ({ id: String(pm.id), brand: String(pm.card.brand ?? 'card'), last4: String(pm.card.last4), exp: `${pm.card.exp_month}/${pm.card.exp_year}` }))
  return { cards }
})

// Confirmation after redirect-based methods (3DS etc.): the success page calls
// this with the donation id; the webhook remains the authoritative fulfiller.
export const confirmGivingPayment = createServerFn({ method: 'POST' })
  .validator((d: { donationId: string }) => {
    if (typeof d?.donationId !== 'string' || !/^[a-f\d-]{36}$/i.test(d.donationId)) throw new CheckoutError('This payment reference is invalid.')
    return d
  })
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const { db, secret } = await givingConfiguration()
    if (!secret) throw new CheckoutError('Payment verification is temporarily unavailable. Please try again.')
    const donation = await first<any>(`SELECT * FROM donations WHERE id=?`, data.donationId)
    if (!donation) throw new CheckoutError('This donation could not be found.')
    const { fulfillDonationIntent } = await import('./giving.server')
    try {
      if (donation.stripe_payment_intent) {
        return await fulfillDonationIntent(db, await stripeGet(`/payment_intents/${encodeURIComponent(donation.stripe_payment_intent)}`, secret))
      }
      // Legacy checkout-session gifts still confirm through the session.
      if (donation.stripe_session_id) {
        const session = await stripeGet(`/checkout/sessions/${encodeURIComponent(donation.stripe_session_id)}`, secret)
        const { fulfillDonation } = await import('./giving.server')
        return await fulfillDonation(db, session)
      }
      throw new CheckoutError('This payment does not exist yet. Please try again.')
    } catch (error) {
      return { ok: false as const, error: checkoutError(error) }
    }
  })
