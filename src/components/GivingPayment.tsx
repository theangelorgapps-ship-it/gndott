import { useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { CreditCard, ShieldCheck } from 'lucide-react'
import { confirmGivingPayment, createGivingIntent, listGivingCards, type GivingFrequency, type GivingKind } from '../lib/giving'
import { LiquidGlassButton } from './ui/apple-tahoe-liquid-glass-button'

// Step 2 of Giving: the transaction happens inside the player. One-time gifts
// confirm a PaymentIntent; monthly partnerships confirm the first invoice of a
// subscription. Signed-in viewers can reuse a saved card. 3DS and wallet
// redirects return to /giving-success, which confirms by donation id.

type DonorInput = { kind: GivingKind; frequency: GivingFrequency; amountCents: number; name: string; email: string; phone: string; country: string }
type Prepared = { donationId: string; clientSecret: string; returnUrl: string }

const stripeCache = new Map<string, Promise<Stripe | null>>()
function stripeFor(key: string) {
  let cached = stripeCache.get(key)
  if (!cached) { cached = loadStripe(key); stripeCache.set(key, cached) }
  return cached
}

function PaymentForm({ prepared, summary, monthly, savedCards, onSuccess, onError }: {
  prepared: Prepared
  summary: string
  monthly: boolean
  savedCards: { id: string; brand: string; last4: string; exp: string }[]
  onSuccess: (donationId: string) => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<string>(savedCards[0]?.id ?? 'new')

  async function pay() {
    if (!stripe) return
    setBusy(true)
    onError('')
    try {
      const common = { return_url: `${prepared.returnUrl}?donation=${prepared.donationId}` }
      // Payment Element flow: submit() validates and finalizes the form first.
      if (method === 'new') {
        if (!elements) { onError('The payment form is still loading. Try again in a moment.'); setBusy(false); return }
        const submit = await elements.submit()
        if (submit.error) { onError(submit.error.message ?? 'Check your card details and try again.'); setBusy(false); return }
      }
      const result = method === 'new'
        ? await stripe.confirmPayment({ elements: elements ?? undefined, clientSecret: prepared.clientSecret, confirmParams: common, redirect: 'if_required' })
        : await stripe.confirmPayment({ clientSecret: prepared.clientSecret, confirmParams: { ...common, payment_method: method }, redirect: 'if_required' })
      if (result.error) { onError(result.error.message ?? 'Your card was declined. Try another card.'); setBusy(false); return }
      const status = result.paymentIntent?.status
      if (status === 'succeeded') { onSuccess(prepared.donationId); return }
      if (status === 'processing') { onSuccess(prepared.donationId); return }
      onError('Payment was not completed. Please try again.')
      setBusy(false)
    } catch (cause) {
      console.error('[giving-pay]', cause)
      onError('Payment could not be completed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="giving-pay">
      {savedCards.length > 0 && (
        <div className="giving-methods" role="radiogroup" aria-label="Saved cards">
          {savedCards.map(card => (
            <div key={card.id} className={`giving-method${method === card.id ? ' active' : ''}`} role="radio" aria-checked={method === card.id} tabIndex={0}
              onClick={() => setMethod(card.id)} onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && setMethod(card.id)}>
              <span className="giving-method-icon"><CreditCard size={22} /></span>
              <span className="giving-method-copy"><strong className="giving-card-brand">{card.brand} •••• {card.last4}</strong><span>Expires {card.exp}</span></span>
              <span className="giving-method-radio">{method === card.id && <i />}</span>
            </div>
          ))}
          <div className={`giving-method${method === 'new' ? ' active' : ''}`} role="radio" aria-checked={method === 'new'} tabIndex={0}
            onClick={() => setMethod('new')} onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && setMethod('new')}>
            <span className="giving-method-icon"><CreditCard size={22} /></span>
            <span className="giving-method-copy"><strong>Use a new card</strong><span>Save it for next time</span></span>
            <span className="giving-method-radio">{method === 'new' && <i />}</span>
          </div>
        </div>
      )}
      {method === 'new' && (
        <div className="giving-element">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      )}
      <p className="giving-secure"><ShieldCheck size={15} /> Secure payment powered by Stripe{monthly ? '. Your partnership repeats monthly and can be cancelled any time.' : '.'}</p>
      <LiquidGlassButton interactive appearance="dark" className="w-full" disabled={!stripe || busy} aria-busy={busy} onClick={() => void pay()}>{busy ? 'Processing…' : monthly ? `Partner ${summary} / month` : `Give ${summary}`}</LiquidGlassButton>
    </div>
  )
}

export function GivingPayment({ donor, viewerId, summary, monthly, publishableKey, onSuccess, onError, onReset }: {
  donor: DonorInput
  viewerId: number | null
  summary: string
  monthly: boolean
  publishableKey: string
  onSuccess: (donationId: string) => void
  onError: (message: string) => void
  onReset: () => void
}) {
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [cards, setCards] = useState<{ id: string; brand: string; last4: string; exp: string }[]>([])
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let alive = true
    setFailed('')
    createGivingIntent({ data: donor })
      .then(res => { if (alive) setPrepared(res) })
      .catch(error => { if (alive) setFailed(error instanceof Error ? error.message : 'Giving is temporarily unavailable. Please try again.') })
    if (viewerId != null) listGivingCards().then(res => { if (alive) setCards(res.cards) }).catch(() => undefined)
    return () => { alive = false }
    // Prepared once per entry to step 2; the amount/kind inputs are frozen by Back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stripePromise = useMemo(() => stripeFor(publishableKey), [publishableKey])

  if (failed) {
    return (
      <div className="giving-pay">
        <p className="giving-message" role="alert">{failed}</p>
        <button type="button" className="giving-back" onClick={onReset}>Try again</button>
      </div>
    )
  }
  if (!prepared) return <div className="giving-pay"><p className="giving-note">Preparing secure payment…</p></div>

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: prepared.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#f2f3f7',
            colorBackground: '#17181c',
            colorText: '#f2f2f5',
            colorTextSecondary: '#a3a3ad',
            colorDanger: '#ff8a8a',
            borderRadius: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          },
        },
      }}
    >
      <PaymentForm prepared={prepared} summary={summary} monthly={monthly} savedCards={viewerId != null ? cards : []} onSuccess={onSuccess} onError={onError} />
    </Elements>
  )
}

/** Called after a confirmed payment: records fulfilment (idempotent; the
 *  webhook is authoritative) and returns the donation for the ticket. */
export async function settleGivingPayment(donationId: string) {
  try {
    const res = await confirmGivingPayment({ data: { donationId } })
    return res.ok ? res.donation : null
  } catch {
    return null
  }
}
