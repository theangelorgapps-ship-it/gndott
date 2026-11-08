import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, CreditCard, LockKeyhole, ShieldCheck, X } from 'lucide-react'
import type { CheckoutQuote } from '../lib/subscriptionCheckout.server'
import { getPlansPage, getCheckoutInfo, validateCoupon, subscribePlan } from '../lib/api'
import { IconCrown } from '../components/Poster'

export const Route = createFileRoute('/subscription-plan')({
  loader: async () => await getPlansPage(),
  component: SubscriptionPlan,
})

function featureLines(lims: any[]): string[] {
  const lines: string[] = []
  for (const l of lims) {
    switch (l.limitation_slug) {
      case 'video-cast':
        lines.push(`Video Casting is ${Number(l.limitation_value) ? 'enabled' : 'disabled'}.`)
        break
      case 'ads':
        lines.push(Number(l.limitation_value) ? 'Ads included' : 'Ad-free experience')
        break
      case 'device-limit':
        lines.push(`You can use up to ${l.limit ?? l.limitation_value} device(s) simultaneously`)
        break
      case 'profile-limit':
        lines.push(`Up to ${l.limit ?? l.limitation_value} profile(s)`)
        break
      case 'download-status': {
        try {
          const res = JSON.parse(l.limit ?? '{}')
          const on = Object.keys(res).filter((k) => res[k] === 1 || res[k] === '1')
          if (on.length) lines.push(`Download resolutions: ${on.join(', ')}`)
        } catch { /* ignore */ }
        break
      }
      case 'supported-device-type': {
        try {
          const dev = JSON.parse(l.limit ?? '{}')
          const on = Object.keys(dev).filter((k) => dev[k] === 1 || dev[k] === '1')
          if (on.length) lines.push(`Supported devices: ${on.map((d) => d[0].toUpperCase() + d.slice(1)).join(', ')}`)
        } catch { /* ignore */ }
        break
      }
      default:
        if (l.title) lines.push(`${l.title}${l.limitation_value ? `: ${l.limitation_value}` : ''}`)
    }
  }
  return lines
}

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

function CheckoutModal({ plan, currentPlan, onClose }: { plan: any; currentPlan: boolean; onClose: (done: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const couponId = useId()
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [coupon, setCoupon] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<'coupon' | 'payment' | null>(null)
  const requestKey = useRef(crypto.randomUUID())
  const paying = useRef(false)
  const mounted = useRef(true)
  const router = useRouter()

  useEffect(() => {
    mounted.current = true
    const node = dialog.current
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    node?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      mounted.current = false
      node?.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setMsg(null)
    getCheckoutInfo({ data: { planId: plan.id } }).then(info => {
      if (!alive) return
      setQuote(info.quote)
      setAvailable(info.gateways.some(g => g.id === 'stripe'))
      if ('error' in info) setMsg(info.error ?? null)
      else if (!info.gateways.length) setMsg('Online checkout is temporarily unavailable. Please try again later.')
    }).catch(() => { if (alive) setMsg('We could not load checkout. Please try again.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [plan.id, attempt])

  async function applyCoupon(code: string) {
    if (busy) return
    setBusy('coupon'); setMsg(null)
    try {
      const result = await validateCoupon({ data: { code, planId: plan.id } })
      if (!mounted.current) return
      if (!result.ok) { setMsg(result.error); return }
      setQuote(result.quote)
      setCoupon(result.quote.couponCode)
      requestKey.current = crypto.randomUUID()
    } catch { setMsg('We could not check this coupon. Please try again.') }
    finally { setBusy(null) }
  }

  async function pay() {
    if (!quote || !available || busy || paying.current) return
    paying.current = true
    setBusy('payment'); setMsg(null)
    try {
      const result = await subscribePlan({ data: {
        planId: quote.planId, gateway: 'stripe', couponCode: quote.couponCode,
        expectedTotalCents: quote.totalCents, requestKey: requestKey.current,
      } })
      if (!mounted.current) return
      if ('needsAuth' in result && result.needsAuth) { onClose(false); await router.navigate({ to: '/login' }); return }
      if (!result.ok) { setMsg(result.error); return }
      if ('checkoutUrl' in result && result.checkoutUrl) { window.location.assign(result.checkoutUrl); return }
      onClose(true)
    } catch { setMsg('Checkout could not open. Try again; this will reuse your payment session.') }
    finally { paying.current = false; setBusy(null) }
  }

  return createPortal(
    <dialog ref={dialog} className="subscription-checkout" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(false) }}
      onClick={event => { if (event.target === event.currentTarget) onClose(false) }}>
      <div className="subscription-checkout-shell">
        <button type="button" className="subscription-close" aria-label="Close checkout" onClick={() => onClose(false)}><X size={22} /></button>
        <aside className="subscription-summary">
          <span className="subscription-brand"><IconCrown size={26} /> GoodNews Halobox</span>
          <p className="subscription-eyebrow">Your next chapter</p>
          <h2 id={titleId}>{quote?.name ?? plan.name}</h2>
          <p className="subscription-term">{quote ? `${quote.durationValue} ${quote.duration}${quote.durationValue === 1 ? '' : 's'} of access` : 'Review your plan'}</p>
          <div className="subscription-total-display">{quote ? money(quote.totalCents) : '—'}<small>USD · one payment</small></div>
          <ul className="subscription-promises">
            <li><Check size={18} /> No automatic renewal</li>
            <li><Check size={18} /> Access after payment is confirmed</li>
            <li><Check size={18} /> Manage your plan in your account</li>
          </ul>
        </aside>
        <section className="subscription-review" aria-busy={loading || !!busy}>
          <span className="subscription-eyebrow">Secure checkout</span>
          <h3>Review your subscription</h3>
          <p className="subscription-subtitle">One payment with no automatic renewal. Your payment details stay with Stripe, then you return here.</p>
          {loading ? <p className="subscription-status" role="status">Loading your current plan price…</p> : quote && <>
            <dl className="subscription-breakdown">
              <div><dt>Plan price</dt><dd>{money(quote.priceCents)}</dd></div>
              {quote.discountCents > 0 && <div><dt>Coupon discount</dt><dd>−{money(quote.discountCents)}</dd></div>}
              <div className="subscription-amount-due"><dt>Due today</dt><dd>{money(quote.totalCents)} <small>USD</small></dd></div>
            </dl>
            <form className="subscription-coupon" onSubmit={event => { event.preventDefault(); void applyCoupon(coupon.trim()) }}>
              <label htmlFor={couponId}>Have a coupon?</label>
              <div><input id={couponId} value={coupon} onChange={event => setCoupon(event.target.value)} maxLength={100} placeholder="Coupon code" autoComplete="off" disabled={!!busy} />
                <button type="submit" disabled={!!busy || !coupon.trim()}>{busy === 'coupon' ? 'Checking…' : 'Apply'}</button></div>
              {quote.couponCode && <p className="subscription-coupon-applied"><Check size={15} /> {quote.couponCode} applied <button type="button" onClick={() => void applyCoupon('')} disabled={!!busy}>Remove</button></p>}
            </form>
            <div className="subscription-payment-method"><CreditCard size={23} /><div><strong>Pay securely with Stripe</strong><span>Choose an available payment method at checkout.</span></div><LockKeyhole size={18} /></div>
            {currentPlan && <p className="subscription-replacement">This purchase starts a new access period when payment completes and replaces your current plan.</p>}
          </>}
          {msg && <p className="subscription-error" role="alert">{msg}</p>}
          {!loading && !available && <button type="button" className="subscription-retry" onClick={() => setAttempt(value => value + 1)}>Retry checkout</button>}
          <button type="button" className="subscription-pay" disabled={loading || !!busy || !quote || !available} onClick={() => void pay()}>
            {busy === 'payment' ? 'Opening secure checkout…' : 'Continue to payment'}<ArrowRight size={19} />
          </button>
          <p className="subscription-assurance"><ShieldCheck size={16} /> Secure payment · No card details stored by Halobox</p>
        </section>
      </div>
    </dialog>, document.body,
  )
}

function SubscriptionPlan() {
  const { plans, limits, activeSub } = Route.useLoaderData() as any
  const [cycle, setCycle] = useState<'month' | 'year'>('month')
  const [notice, setNotice] = useState<string | null>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<any>(null)
  const router = useRouter()
  const shown = plans.filter((p: any) => p.duration === cycle)

  return (
    <div className="plans-page">
      <h1 className="page-title-center">Subscription Plan</h1>

      {activeSub ? (
        <div className="no-plan-banner has-plan">
          <span className="np-crown"><IconCrown size={30} /></span>
          <div className="np-text">
            <h2>{activeSub.name}</h2>
            <p>Your plan is active{activeSub.end_date ? ` until ${String(activeSub.end_date).slice(0, 10)}` : ''}.</p>
          </div>
        </div>
      ) : (
        <div className="no-plan-banner">
          <span className="np-crown"><IconCrown size={30} /></span>
          <div className="np-text">
            <h2>No Active Plan</h2>
            <p>You do not have an active subscription.</p>
          </div>
          <button className="np-subscribe" onClick={() => setNotice('Choose a plan below to subscribe.')}>Subscribe</button>
        </div>
      )}

      <div className="plan-toggle-wrap">
        <div className="plan-toggle">
          <button className={cycle === 'month' ? 'active' : ''} onClick={() => setCycle('month')}>Monthly</button>
          <button className={cycle === 'year' ? 'active' : ''} onClick={() => setCycle('year')}>Yearly</button>
        </div>
      </div>

      {notice && <div className="plan-notice">{notice}</div>}

      <div className="plans-grid">
        {shown.map((p: any) => {
          const feats = featureLines(limits.filter((l: any) => l.plan_id === p.id))
          const price = Number(p.price || 0).toFixed(2)
          const per = `/ ${p.duration_value} ${p.duration === 'month' ? (p.duration_value > 1 ? 'Months' : 'Month') : (p.duration_value > 1 ? 'Years' : 'Year')}`
          return (
            <div key={p.id} className="plan-card">
              <h3>{p.name}</h3>
              {p.description && <p className="plan-desc">{String(p.description).replace(/<[^>]*>/g, '').trim()}</p>}
              <div className="plan-price-row">
                <span className="plan-price">${price}</span>
                <span className="plan-per">{per}</span>
              </div>
              <ul className="plan-feats">
                {feats.map((f, i) => (
                  <li key={i}>
                    <span className="feat-check">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button className="btn btn-primary plan-btn" onClick={() => setCheckoutPlan(p)}>
                Subscribe Now
              </button>
            </div>
          )
        })}
      </div>
      {shown.length === 0 && <div className="empty">No {cycle}ly plans available.</div>}
      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          currentPlan={!!activeSub}
          onClose={(done) => {
            setCheckoutPlan(null)
            if (done) { setNotice('Your plan is active. You can manage it in your account.'); router.invalidate() }
          }}
        />
      )}
    </div>
  )
}
