import { env } from 'cloudflare:workers'
import { first, run } from './db'
import { CheckoutError } from './checkoutError'
import { notifyUser, sendTransactional } from './transactional.server'
import type { GivingKind } from './giving'

// Server-only giving fulfilment. Webhook and success-page confirmation both
// verify the Stripe session against the donation row before marking it paid,
// then send the thank-you email exactly once.

export type Donation = {
  id: string; user_id: number | null; name: string; email: string; phone: string; country: string;
  kind: GivingKind; frequency: 'one_time' | 'monthly'; amount_cents: number; currency: string;
  stripe_session_id: string | null; stripe_payment_intent: string | null;
  stripe_subscription_id: string | null; stripe_customer: string | null;
  status: string; created_at: string; paid_at: string | null
}

const KIND_LABEL: Record<GivingKind, string> = { offering: 'Offering', tithe: 'Tithe', partner: 'Partnership', seed: 'Seed' }

export function verifyGivingPayment(session: any, donation: Donation) {
  const monthly = donation.frequency === 'monthly'
  const expectedMode = monthly ? 'subscription' : 'payment'
  if (!session || session.id !== donation.stripe_session_id || session.mode !== expectedMode || session.status !== 'complete' ||
    session.metadata?.purpose !== 'halobox_giving' || session.metadata?.donation_id !== donation.id ||
    String(session.metadata?.kind ?? '') !== donation.kind) throw new CheckoutError('This payment does not match this donation.')
  if (session.amount_total !== donation.amount_cents || session.currency !== donation.currency) throw new CheckoutError('The paid amount does not match this donation.')
  // Monthly partnerships settle their first invoice at checkout; Stripe reports
  // either 'paid' or 'no_payment_required' (e.g. a full-coupon first cycle).
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) throw new CheckoutError('Payment is not completed yet. Try checking again in a moment.')
}

function thankYouEmail(donation: Donation) {
  const amount = `$${(donation.amount_cents / 100).toFixed(2)}`
  const monthly = donation.frequency === 'monthly'
  const kindLabel = KIND_LABEL[donation.kind] ?? 'gift'
  return {
    subject: `Thank you for your ${kindLabel.toLowerCase()} — GoodNews HaloBox`,
    text: [
      `Dear ${donation.name},`,
      '',
      `Thank you for your ${kindLabel.toLowerCase()} of ${amount}${monthly ? ' every month' : ''}. Your generosity keeps the GoodNews flowing to the world — every sermon, teaching and broadcast is made possible by givers like you.`,
      '',
      monthly ? 'Your monthly partnership is now active and repeats automatically. You can manage or cancel it any time from your HaloBox account.' : 'This is a one-time gift; a receipt for your records is on its way from our payment partner.',
      '',
      '"Give, and it will be given to you. A good measure, pressed down, shaken together and running over." — Luke 6:38',
      '',
      'With gratitude,',
      'The GoodNews HaloBox Team',
      '',
      `Reference: ${donation.id}`,
    ].join('\n'),
  }
}

async function sendThankYou(donation: Donation) {
  const binding = (env as any).EMAIL
  if (!binding) return // email not bound in this environment (local dev)
  const mail = thankYouEmail(donation)
  await binding.send({ from: 'noreply@halobox.tv', to: donation.email, subject: mail.subject, text: mail.text })
}

export async function fulfillDonation(db: D1Database, session: any) {
  const donation = await first<Donation>(`SELECT * FROM donations WHERE stripe_session_id=?`, session?.id || '')
  if (!donation) throw new CheckoutError('This donation could not be found.')
  verifyGivingPayment(session, donation)
  const summary = { kind: donation.kind, frequency: donation.frequency, amountCents: donation.amount_cents, name: donation.name, id: donation.id, paidAt: donation.paid_at }
  if (donation.status === 'paid') return { ok: true as const, already: true, donation: summary }
  const marked = await run(`UPDATE donations SET status='paid', paid_at=datetime('now') WHERE id=? AND status='pending'`, donation.id)
  if (marked?.meta?.changes) {
    // The thank-you goes out exactly once, on the pending → paid transition.
    try { await sendThankYou({ ...donation, status: 'paid' }) } catch (error) { console.warn('Giving thank-you email failed:', error instanceof Error ? error.message : 'send failed') }
    await notifyUser(db, donation.user_id, {
      kind: 'giving', status: 'success',
      title: `${KIND_LABEL[donation.kind] ?? 'Gift'} received`,
      message: `Thank you — your ${(KIND_LABEL[donation.kind] ?? 'gift').toLowerCase()} of $${(donation.amount_cents / 100).toFixed(2)}${donation.frequency === 'monthly' ? ' (monthly)' : ''} is confirmed.`,
      amountCents: donation.amount_cents, currency: donation.currency,
    })
  }
  return { ok: true as const, donation: { ...summary, paidAt: new Date().toISOString() } }
}

// ---------- in-module payment fulfilment (PaymentIntent / invoice webhooks) ----------

async function markPaid(db: D1Database, donation: Donation) {
  if (donation.status === 'paid') return false
  const marked = await run(`UPDATE donations SET status='paid', paid_at=datetime('now') WHERE id=? AND status='pending'`, donation.id)
  if (marked?.meta?.changes) {
    try { await sendThankYou({ ...donation, status: 'paid' }) } catch (error) { console.warn('Giving thank-you email failed:', error instanceof Error ? error.message : 'send failed') }
    await notifyUser(db, donation.user_id, {
      kind: 'giving', status: 'success',
      title: `${KIND_LABEL[donation.kind] ?? 'Gift'} received`,
      message: `Thank you — your ${(KIND_LABEL[donation.kind] ?? 'gift').toLowerCase()} of $${(donation.amount_cents / 100).toFixed(2)}${donation.frequency === 'monthly' ? ' (monthly)' : ''} is confirmed.`,
      amountCents: donation.amount_cents, currency: donation.currency,
    })
    return true
  }
  return false
}

/** payment_intent.payment_failed: the donor gets a nudge email and a failed
 *  transaction card in their notifications. */
export async function failPaymentIntentEvent(db: D1Database, intent: any) {
  if (intent?.metadata?.purpose !== 'halobox_giving') return
  const donation = await first<Donation>(`SELECT * FROM donations WHERE id=?`, String(intent.metadata.donation_id || ''))
  if (!donation || donation.stripe_payment_intent !== intent.id || donation.status === 'paid') return
  const reason = intent.last_payment_error?.message || 'Your card was declined.'
  const amount = `$${(donation.amount_cents / 100).toFixed(2)}`
  try {
    await sendTransactional(donation.email, 'Your giving didn’t go through — GoodNews HaloBox', [
      `Dear ${donation.name},`, '',
      `Your ${(KIND_LABEL[donation.kind] ?? 'gift').toLowerCase()} of ${amount} could not be completed: ${reason}`, '',
      'No money has left your account. You can try again any time from the Giving tab while watching.', '',
      'With gratitude,', 'The GoodNews HaloBox Team', '',
      `Reference: ${donation.id}`,
    ].join('\n'))
  } catch (error) { console.warn('Giving failure email failed:', error instanceof Error ? error.message : 'send failed') }
  await notifyUser(db, donation.user_id, {
    kind: 'giving', status: 'failed',
    title: 'Giving not completed',
    message: `Your ${(KIND_LABEL[donation.kind] ?? 'gift').toLowerCase()} of ${amount} didn't go through. ${reason}`,
    amountCents: donation.amount_cents, currency: donation.currency,
  })
}

/** payment_intent.succeeded: one-time gifts confirm in-panel; this is the authoritative record. */
export async function fulfillPaymentIntentEvent(db: D1Database, intent: any) {
  if (intent?.metadata?.purpose !== 'halobox_giving' || intent?.status !== 'succeeded') return
  const donation = await first<Donation>(`SELECT * FROM donations WHERE id=?`, String(intent.metadata.donation_id || ''))
  if (!donation || donation.stripe_payment_intent !== intent.id) return
  if (intent.amount !== donation.amount_cents || intent.currency !== donation.currency) return
  await markPaid(db, donation)
}

/** invoice.payment_succeeded: first monthly payment marks the partnership
 *  donation paid; every later renewal records a new paid donation + thank-you. */
export async function fulfillInvoiceEvent(db: D1Database, invoice: any) {
  const subscriptionId = typeof invoice?.subscription === 'string' ? invoice.subscription : null
  if (!subscriptionId || !invoice?.id || invoice.status !== 'paid') return
  const original = await first<Donation>(`SELECT * FROM donations WHERE stripe_subscription_id=?`, subscriptionId)
  if (!original) return
  const already = await first<any>(`SELECT id FROM donations WHERE stripe_payment_intent=?`, String(invoice.payment_intent ?? ''))
  if (already) return
  const amount = Number(invoice.amount_paid)
  if (!Number.isSafeInteger(amount) || amount <= 0) return
  if (original.status === 'pending') {
    await run(`UPDATE donations SET stripe_payment_intent=? WHERE id=?`, String(invoice.payment_intent ?? ''), original.id)
    await markPaid(db, original)
    return
  }
  // Renewal: a fresh paid donation row in the same campaign.
  const id = crypto.randomUUID()
  await run(
    `INSERT INTO donations(id, user_id, name, email, phone, country, kind, frequency, amount_cents, status, paid_at, stripe_subscription_id, stripe_customer, stripe_payment_intent)
     VALUES(?,?,?,?,?,?,?,?,?,'pending',NULL,?,?,?)`,
    id, original.user_id, original.name, original.email, original.phone, original.country,
    original.kind, 'monthly', amount, subscriptionId, original.stripe_customer, String(invoice.payment_intent ?? ''),
  )
  const renewal = await first<Donation>(`SELECT * FROM donations WHERE id=?`, id)
  if (renewal) await markPaid(db, renewal)
}

/** Success-page confirmation for in-module gifts (the webhook stays authoritative). */
export async function fulfillDonationIntent(db: D1Database, intent: any) {
  if (!intent || intent.metadata?.purpose !== 'halobox_giving') throw new CheckoutError('This payment does not match this donation.')
  const donation = await first<Donation>(`SELECT * FROM donations WHERE id=?`, String(intent.metadata.donation_id || ''))
  if (!donation || donation.stripe_payment_intent !== intent.id) throw new CheckoutError('This payment does not match this donation.')
  if (intent.amount !== donation.amount_cents || intent.currency !== donation.currency) throw new CheckoutError('The paid amount does not match this donation.')
  if (intent.status !== 'succeeded') throw new CheckoutError(intent.status === 'processing' ? 'Your payment is processing. Check again in a moment.' : 'Payment is not completed yet.')
  const summary = { kind: donation.kind, frequency: donation.frequency, amountCents: donation.amount_cents, name: donation.name, id: donation.id, paidAt: donation.paid_at }
  const marked = await markPaid(db, donation)
  return { ok: true as const, already: !marked, donation: marked ? { ...summary, paidAt: new Date().toISOString() } : summary }
}
