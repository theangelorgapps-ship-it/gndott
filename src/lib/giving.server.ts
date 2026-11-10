import { env } from 'cloudflare:workers'
import { first, run } from './db'
import { CheckoutError } from './checkoutError'
import type { GivingKind } from './giving'

// Server-only giving fulfilment. Webhook and success-page confirmation both
// verify the Stripe session against the donation row before marking it paid,
// then send the thank-you email exactly once.

export type Donation = {
  id: string; user_id: number | null; name: string; email: string; phone: string; country: string;
  kind: GivingKind; frequency: 'one_time' | 'monthly'; amount_cents: number; currency: string;
  stripe_session_id: string | null; status: string; created_at: string; paid_at: string | null
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
  }
  return { ok: true as const, donation: { ...summary, paidAt: new Date().toISOString() } }
}
