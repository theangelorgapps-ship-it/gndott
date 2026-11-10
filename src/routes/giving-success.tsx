import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Check, CreditCard, LoaderCircle } from 'lucide-react'
import { confirmGivingCheckout } from '../lib/giving'

export const Route = createFileRoute('/giving-success')({
  validateSearch: (s: Record<string, unknown>) => ({ session_id: typeof s.session_id === 'string' ? s.session_id.slice(0, 256) : '' }),
  component: GivingSuccess,
})

const KIND_LABEL: Record<string, string> = { offering: 'Offering', tithe: 'Tithe', partner: 'Partnership', seed: 'Seed' }

function Confetti() {
  const colors = ['#ffd700', '#ff8a5c', '#7ee2a8', '#8ecfff', '#e0b0ff']
  return (
    <div className="giving-confetti" aria-hidden="true">
      <style>{`@keyframes giving-fall{0%{transform:translateY(-8vh) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}`}</style>
      {Array.from({ length: 70 }).map((_, i) => (
        <span key={i} style={{
          left: `${(i * 37) % 100}%`,
          top: `${-10 - ((i * 13) % 20)}vh`,
          background: colors[i % colors.length],
          animation: `giving-fall ${2.6 + (i % 5) * 0.7}s ${(i % 9) * 0.25}s linear forwards`,
        }} />
      ))}
    </div>
  )
}

function Barcode({ value }: { value: string }) {
  const bars = Array.from({ length: 48 }).map((_, i) => {
    const seed = value.charCodeAt(i % value.length) + i * 31
    return { wide: seed % 7 > 3 }
  })
  return (
    <div className="giving-barcode" aria-hidden="true">
      <svg viewBox="0 0 220 48" width="220" height="48">
        {bars.map((bar, i) => <rect key={i} x={i * 4.4} y="4" width={bar.wide ? 2.6 : 1.3} height="40" fill="currentColor" />)}
      </svg>
      <p>{value.slice(0, 8).toUpperCase()}</p>
    </div>
  )
}

type Confirmed = { kind: string; frequency: string; amountCents: number; name: string; id: string; paidAt: string | null }

function GivingSuccess() {
  const { session_id } = Route.useSearch()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ loading: boolean; msg: string; ok: boolean; donation: Confirmed | null }>({ loading: true, msg: 'Confirming your giving…', ok: false, donation: null })
  const [confetti, setConfetti] = useState(false)

  useEffect(() => {
    let alive = true
    if (!session_id) { setState({ loading: false, msg: 'This page is missing a payment reference.', ok: false, donation: null }); return }
    setState({ loading: true, msg: 'Confirming your giving securely. This can take a moment.', ok: false, donation: null })
    confirmGivingCheckout({ data: { sessionId: session_id } }).then(result => {
      if (!alive) return
      if (result.ok && 'donation' in result) {
        setState({ loading: false, ok: true, msg: '', donation: result.donation as Confirmed })
        if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          setConfetti(true)
          window.setTimeout(() => alive && setConfetti(false), 5200)
        }
      } else setState({ loading: false, ok: false, donation: null, msg: result.ok ? 'Confirmed.' : result.error })
    }).catch(() => { if (alive) setState({ loading: false, ok: false, donation: null, msg: 'We could not verify the payment yet. Check again; you will not be charged twice.' }) })
    return () => { alive = false }
  }, [session_id, attempt])

  if (state.ok && state.donation) {
    const d = state.donation
    const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d.amountCents / 100)
    const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d.paidAt ? new Date(d.paidAt.replace(' ', 'T') + 'Z') : new Date())
    return (
      <div className="auth-page giving-success-page">
        {confetti && <Confetti />}
        <div className="giving-ticket">
          <span className="giving-ticket-cut left" aria-hidden="true" />
          <span className="giving-ticket-cut right" aria-hidden="true" />
          <div className="giving-ticket-head">
            <span className="giving-ticket-check"><Check size={34} strokeWidth={2.6} /></span>
            <h1>Thank you for giving!</h1>
            <p>Your {KIND_LABEL[d.kind]?.toLowerCase() ?? 'gift'} is confirmed{state.donation.frequency === 'monthly' ? ' and repeats monthly' : ''}.</p>
          </div>
          <div className="giving-ticket-body">
            <div className="giving-ticket-dash" aria-hidden="true" />
            <div className="giving-ticket-grid">
              <div><p>Gift ID</p><strong>{d.id.slice(0, 8).toUpperCase()}</strong></div>
              <div><p>Amount</p><strong className="giving-ticket-amount">{amount}</strong></div>
              <div><p>Campaign</p><strong>{KIND_LABEL[d.kind] ?? d.kind}{d.frequency === 'monthly' ? ' · Monthly' : ''}</strong></div>
              <div><p>Date</p><strong>{when}</strong></div>
            </div>
            <div className="giving-ticket-donor">
              <span className="giving-ticket-heart">♥</span>
              <div><strong>{d.name}</strong><p>A receipt and thank-you note are on their way to your email.</p></div>
            </div>
            <div className="giving-ticket-dash" aria-hidden="true" />
            <Barcode value={d.id} />
          </div>
        </div>
        <div className="subscription-result-links">
          <Link to="/">Continue watching <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page subscription-result-page">
      <section className="subscription-result" aria-busy={state.loading}>
        <span className={`subscription-result-icon${state.loading ? ' is-loading' : ''}`}>{state.loading ? <LoaderCircle size={30} /> : <CreditCard size={30} />}</span>
        <h1>{state.loading ? 'Confirming your giving' : 'Let’s check your payment'}</h1>
        <p role="status">{state.msg}</p>
        {!state.loading && !state.ok && session_id && <button type="button" className="subscription-pay" onClick={() => setAttempt(value => value + 1)}>Check payment again</button>}
        <div className="subscription-result-links">
          <Link to="/">Continue watching <span aria-hidden="true">→</span></Link>
        </div>
        {!state.ok && !state.loading && <a className="subscription-support" href="mailto:Hello@halobox.tv">Contact support</a>}
      </section>
    </div>
  )
}
