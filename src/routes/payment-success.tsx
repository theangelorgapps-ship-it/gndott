import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { confirmStripeSession } from '../lib/api'

export const Route = createFileRoute('/payment-success')({
  validateSearch: (s: Record<string, unknown>) => ({ session_id: String(s.session_id ?? '') }),
  component: PaymentSuccess,
})

function PaymentSuccess() {
  const { session_id } = Route.useSearch() as any
  const [state, setState] = useState<{ loading: boolean; msg: string; ok: boolean }>({
    loading: true, msg: 'Confirming your payment…', ok: false,
  })

  useEffect(() => {
    if (!session_id) { setState({ loading: false, msg: 'Missing payment session.', ok: false }); return }
    confirmStripeSession({ data: { sessionId: session_id } }).then((res: any) => {
      if (res?.ok) setState({ loading: false, ok: true, msg: 'Payment confirmed — your subscription is now active.' })
      else setState({ loading: false, ok: false, msg: res?.error ?? 'Could not confirm payment.' })
    })
  }, [session_id])

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{state.loading ? 'Processing…' : state.ok ? 'Payment Successful' : 'Payment Issue'}</h1>
        <p className="form-msg">{state.msg}</p>
        <div className="profile-form-actions" style={{ justifyContent: 'center' }}>
          <Link to="/" className="btn btn-primary">Go to Home</Link>
          <Link to="/account-setting" className="btn btn-dark">My Account</Link>
        </div>
      </div>
    </div>
  )
}
