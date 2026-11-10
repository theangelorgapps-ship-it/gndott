import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Check, CreditCard, LoaderCircle } from 'lucide-react'
import { confirmStripeSession } from '../lib/api'

export const Route = createFileRoute('/payment-success')({
  validateSearch: (s: Record<string, unknown>) => ({ session_id: typeof s.session_id === 'string' ? s.session_id.slice(0, 256) : '' }),
  component: PaymentSuccess,
})

function PaymentSuccess() {
  const { session_id } = Route.useSearch()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ loading: true, msg: 'Confirming your payment…', ok: false, needsAuth: false })
  const [orderPlaced, setOrderPlaced] = useState(false)

  useEffect(() => {
    let alive = true
    if (!session_id) { setState({ loading: false, msg: 'This page is missing a payment reference. Check your account for your current plan.', ok: false, needsAuth: false }); return }
    setState({ loading: true, msg: 'Confirming your payment securely. This can take a moment.', ok: false, needsAuth: false })
    confirmStripeSession({ data: { sessionId: session_id } }).then(result => {
      if (!alive) return
      if (result.ok) {
        const orderNumber = 'orderNumber' in result && result.orderNumber ? String(result.orderNumber) : ''
        setState({
          loading: false, ok: true, needsAuth: false,
          msg: orderNumber
            ? `Your payment is confirmed and order #${orderNumber} is with the store for fulfilment.`
            : `Your payment is confirmed and your plan is active${'end' in result && result.end ? ` until ${result.end}` : ''}.`,
        })
        setOrderPlaced(!!orderNumber)
      }
      else setState({ loading: false, ok: false, msg: result.error, needsAuth: 'needsAuth' in result && !!result.needsAuth })
    }).catch(() => { if (alive) setState({ loading: false, ok: false, needsAuth: false, msg: 'We could not verify the payment yet. Check again; you will not be charged twice.' }) })
    return () => { alive = false }
  }, [session_id, attempt])

  return (
    <div className="auth-page subscription-result-page">
      <section className="subscription-result" aria-busy={state.loading}>
        <span className={`subscription-result-icon${state.loading ? ' is-loading' : ''}`}>{state.loading ? <LoaderCircle size={30} /> : state.ok ? <Check size={30} /> : <CreditCard size={30} />}</span>
        <h1>{state.loading ? 'Confirming your payment' : state.ok ? (orderPlaced ? 'Order confirmed.' : 'You’re ready to watch.') : 'Let’s check your payment'}</h1>
        <p role="status">{state.msg}</p>
        {!state.loading && !state.ok && session_id && !state.needsAuth && <button type="button" className="subscription-pay" onClick={() => setAttempt(value => value + 1)}>Check payment again</button>}
        {state.needsAuth && <Link to="/login" className="subscription-pay">Sign in to verify</Link>}
        <div className="subscription-result-links">
          {orderPlaced && <Link to="/shop">Back to the shop</Link>}
          <Link to="/account-setting">My account</Link>
          {!orderPlaced && <Link to="/">Start watching <span aria-hidden="true">→</span></Link>}
        </div>
        {!state.ok && !state.loading && <a className="subscription-support" href="mailto:Hello@halobox.tv">Contact support</a>}
      </section>
    </div>
  )
}
