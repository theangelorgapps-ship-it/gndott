import { first, run } from './db'
import { CheckoutError } from './checkoutError'
import type { GivingKind } from './giving'

// Server-only giving fulfilment. Webhook and success-page confirmation both
// verify the Stripe session against the donation row before marking it paid.

export type Donation = {
  id: string; user_id: number | null; name: string; email: string; phone: string; country: string;
  kind: GivingKind; amount_cents: number; currency: string; stripe_session_id: string | null;
  status: string; created_at: string; paid_at: string | null
}

export function verifyGivingPayment(session: any, donation: Donation) {
  if (!session || session.id !== donation.stripe_session_id || session.mode !== 'payment' || session.status !== 'complete' ||
    session.metadata?.purpose !== 'halobox_giving' || session.metadata?.donation_id !== donation.id ||
    String(session.metadata?.kind ?? '') !== donation.kind) throw new CheckoutError('This payment does not match this donation.')
  if (session.amount_total !== donation.amount_cents || session.currency !== donation.currency) throw new CheckoutError('The paid amount does not match this donation.')
  if (session.payment_status !== 'paid') throw new CheckoutError('Payment is not completed yet. Try checking again in a moment.')
}

export async function fulfillDonation(db: D1Database, session: any) {
  const donation = await first<Donation>(`SELECT * FROM donations WHERE stripe_session_id=?`, session?.id || '')
  if (!donation) throw new CheckoutError('This donation could not be found.')
  verifyGivingPayment(session, donation)
  if (donation.status === 'paid') return { ok: true as const, already: true }
  await run(`UPDATE donations SET status='paid', paid_at=datetime('now') WHERE id=? AND status='pending'`, donation.id)
  return { ok: true as const }
}
