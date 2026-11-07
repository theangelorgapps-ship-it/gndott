import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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

function CheckoutModal({ plan, onClose }: { plan: any; onClose: (done: boolean) => void }) {
  const [gateways, setGateways] = useState<{ id: string; label: string }[] | null>(null)
  const [gateway, setGateway] = useState('')
  const [coupon, setCoupon] = useState('')
  const [couponInfo, setCouponInfo] = useState<any>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCheckoutInfo().then((info: any) => {
      setGateways(info?.gateways ?? [])
      if (info?.gateways?.length) setGateway(info.gateways[0].id)
      if (!info?.gateways?.length) setMsg('No payment gateway is enabled. Ask the administrator to enable one in settings.')
    })
  }, [])

  const price = Number(plan.price || 0)
  const discount = couponInfo?.ok ? couponInfo.discount : 0
  const total = Math.max(0, price - discount)

  return (
    <div className="profile-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(false) }}>
      <div className="profile-form checkout-form">
        <h3>Subscribe — {plan.name}</h3>
        <div className="checkout-row"><span>Plan price</span><strong>${price.toFixed(2)}</strong></div>

        <label className="checkout-label">Coupon code</label>
        <div className="coupon-row">
          <input type="text" value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponInfo(null) }} placeholder="Enter coupon code" />
          <button
            type="button"
            className="btn btn-dark"
            disabled={!coupon.trim()}
            onClick={async () => setCouponInfo(await validateCoupon({ data: { code: coupon.trim(), amount: price } }))}
          >
            Apply
          </button>
        </div>
        {couponInfo && (
          <p className="form-msg" style={{ color: couponInfo.ok ? 'var(--green, #4caf50)' : 'var(--red, #f66)' }}>
            {couponInfo.ok ? `Coupon applied: −$${discount.toFixed(2)}` : couponInfo.error}
          </p>
        )}

        <label className="checkout-label">Payment method</label>
        <div className="gateway-list">
          {(gateways ?? []).map((g) => (
            <label key={g.id} className={`gateway-item${gateway === g.id ? ' active' : ''}`}>
              <input type="radio" name="gateway" checked={gateway === g.id} onChange={() => setGateway(g.id)} />
              {g.label}
            </label>
          ))}
          {gateways === null && <p className="muted">Loading payment methods…</p>}
        </div>

        <div className="checkout-row checkout-total"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
        {msg && <p className="form-msg">{msg}</p>}

        <div className="profile-form-actions">
          <button type="button" className="btn btn-dark" onClick={() => onClose(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={busy || !gateway}
            onClick={async () => {
              setBusy(true); setMsg(null)
              const res: any = await subscribePlan({
                data: { planId: plan.id, gateway, couponCode: couponInfo?.ok ? coupon.trim() : undefined, origin: window.location.origin },
              })
              setBusy(false)
              if (res?.needsAuth) { router.navigate({ to: '/login' }); return }
              if (res?.checkoutUrl) { window.location.href = res.checkoutUrl; return }
              if (res?.ok) { onClose(true); return }
              setMsg(res?.error ?? 'Payment failed.')
            }}
          >
            {busy ? 'Processing…' : `Pay $${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
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
          onClose={(done) => {
            setCheckoutPlan(null)
            if (done) { setNotice('Subscription activated! Enjoy unlimited streaming.'); router.invalidate() }
          }}
        />
      )}
    </div>
  )
}
