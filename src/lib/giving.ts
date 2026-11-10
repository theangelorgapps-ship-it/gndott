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
  const givingSecret = await first<any>(`SELECT val FROM settings WHERE name='giving_stripe_secretkey' AND deleted_at IS NULL`).then(row => String(row?.val ?? '').trim()).catch(() => '')
  const givingEnabled = await first<any>(`SELECT val FROM settings WHERE name='giving_stripe_enabled' AND deleted_at IS NULL`).then(row => String(row?.val ?? '')).catch(() => '')
  if (givingSecret && givingEnabled === '1') return { db: shared.db, secret: givingSecret, enabled: true }
  return shared
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
  const { enabled, secret } = await givingConfiguration()
  return { available: enabled && !!secret }
})
