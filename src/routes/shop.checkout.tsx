import { img } from '@/components/Poster'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LockKeyhole, ShoppingBag, Trash2 } from 'lucide-react'
import { useStoreCart } from '../components/StoreCart'
import { StorePurchaseBar } from '../components/StorePurchaseBar'
import { quoteStoreCheckout, startStoreCheckout } from '../lib/store'
import { getSessionUser } from '../lib/api'
import { storeMoney, storeText } from '../lib/storeTypes'

export const Route = createFileRoute('/shop/checkout')({
  validateSearch: (search: Record<string, unknown>): { cancelled?: true } => ({ cancelled: search.cancelled === '1' ? true : undefined }),
  loader: async () => ({ viewer: await getSessionUser() }),
  component: Checkout,
})

const COUNTRIES: [string, string][] = [
  ['GB', 'United Kingdom'], ['US', 'United States'], ['CA', 'Canada'], ['AU', 'Australia'],
  ['IE', 'Ireland'], ['NG', 'Nigeria'], ['ZA', 'South Africa'], ['GH', 'Ghana'],
  ['KE', 'Kenya'], ['DE', 'Germany'], ['FR', 'France'], ['NL', 'Netherlands'],
  ['ES', 'Spain'], ['IT', 'Italy'], ['AE', 'United Arab Emirates'], ['IN', 'India'],
]

const EMPTY_ADDRESS = { first_name: '', last_name: '', address_1: '', address_2: '', city: '', state: '', postcode: '', country: 'GB', phone: '' }
type Address = typeof EMPTY_ADDRESS
type Quote = { quote_id: string; currency: string; items_total: string; discount_total: string; shipping_total: string; tax_total: string; total: string; shipping_rates: { id: string; label: string; cost: string; selected: boolean }[] }

function Checkout() {
  const { viewer } = Route.useLoaderData()
  const { cancelled } = Route.useSearch()
  const { cart, busy, error, update, refresh } = useStoreCart()
  const [coupon, setCoupon] = useState(''), [message, setMessage] = useState(cancelled ? 'Checkout was cancelled — your cart is unchanged.' : '')
  const [address, setAddress] = useState<Address>(() => ({ ...EMPTY_ADDRESS, first_name: viewer?.first_name ?? '', last_name: viewer?.last_name ?? '' }))
  const [quote, setQuote] = useState<{ checkoutId: string; quote: Quote } | null>(null)
  const [quoting, setQuoting] = useState(false), [processing, setProcessing] = useState(false)
  const checkoutLock = useRef(false)
  const requestKey = useRef(crypto.randomUUID())

  // Any cart change invalidates the quote — totals must be recomputed by the store.
  const itemsCount = cart?.items_count ?? 0
  const quotedFor = useRef<number | null>(null)
  useEffect(() => {
    if (quotedFor.current !== null && quotedFor.current !== itemsCount) setQuote(null)
  }, [itemsCount])

  if (!viewer) return <section className="store-checkout">
    <h1>Sign in to check out.</h1>
    <p>Your Halobox account keeps your order, delivery updates and receipt in one place.</p>
    <Link className="btn btn-primary" to="/login">Sign in or create an account</Link>
    <p><Link to="/shop">← Continue shopping</Link></p>
  </section>

  if (!cart) return <section className="store-checkout"><h1>Your cart</h1><p role="status">{error || 'Loading your cart…'}</p>{error && <button className="btn btn-primary" onClick={() => void refresh()}>Retry</button>}</section>
  const total = cart.totals
  const money = (amount: string) => storeMoney(amount, total.currency_code, total.currency_minor_unit)
  const subtotal = money(String(Number(total.total_items) - Number(total.total_discount)))
  const quoteMoney = (amount: string) => storeMoney(amount, quote?.quote.currency ?? 'GBP', 2)

  const field = (key: keyof Address, label: string, props: Record<string, unknown> = {}) => (
    <label>{label}<input value={address[key]} autoComplete={key.replaceAll('_', '-')} disabled={busy || processing} onChange={event => { setAddress(current => ({ ...current, [key]: event.target.value })); setQuote(null) }} {...props} /></label>
  )

  const quoteNow = async (shippingRate?: string) => {
    if (quoting || processing || !cart.items.length) return
    setQuoting(true); setMessage('')
    try {
      const result = await quoteStoreCheckout({ data: { address, ...(shippingRate ? { shippingRate } : {}) } })
      if (!result.ok) { setMessage(result.error); if ('needsAuth' in result && result.needsAuth) setMessage('Sign in to check out.'); return }
      quotedFor.current = itemsCount
      setQuote({ checkoutId: result.checkoutId, quote: result.quote as Quote })
      // A single available rate is selected by the store; re-quote to lock it into the total.
      const rates = (result.quote as Quote).shipping_rates
      if (!shippingRate && rates.length === 1 && !rates[0].selected) await quoteNow(rates[0].id)
    } finally { setQuoting(false) }
  }

  const pay = async () => {
    if (checkoutLock.current || busy || !quote) return
    checkoutLock.current = true; setProcessing(true); setMessage('')
    try {
      const result = await startStoreCheckout({ data: { checkoutId: quote.checkoutId, requestKey: requestKey.current, expectedTotalMinor: Math.round(Number(quote.quote.total) * 100) } })
      if (!result.ok) throw new Error(result.error)
      if ('checkoutUrl' in result && result.checkoutUrl) { window.location.assign(result.checkoutUrl); return }
      if ('already' in result) { setMessage('This order is already paid.'); return }
      throw new Error('Unable to start checkout.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to start checkout.')
      checkoutLock.current = false; setProcessing(false)
    }
  }

  return <section className="store-checkout">
    <Link to="/shop">← Continue shopping</Link><h1>Your cart.</h1>
    <ol className="store-checkout-steps" aria-label="Checkout steps"><li aria-current="step">1 · Review</li><li>2 · Delivery</li><li>3 · Secure payment</li></ol>
    {!cart.items.length ? <div className="store-empty"><ShoppingBag size={40} /><h2>Make room for inspiration.</h2><p>Your cart is empty.</p><Link className="btn btn-primary" to="/shop">Explore the shop</Link></div> : <div className="store-checkout-grid">
      <div>
        <div className="store-cart-items">{cart.items.map((item: any) => <article key={item.key} className="store-cart-item">
          <img src={img(item.images?.[0]?.src)} alt="" />
          <div><h2>{storeText(item.name)}</h2>{item.variation?.map((variation: any) => <p key={variation.attribute}>{storeText(variation.attribute)}: {storeText(variation.value)}</p>)}
            <label>Quantity<select disabled={busy || processing} value={item.quantity} onChange={event => { if (!checkoutLock.current) void update({ action: 'update', key: item.key, quantity: Number(event.target.value) }) }}>{Array.from({ length: 20 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
            <button className="store-remove" disabled={busy || processing} aria-label={`Remove ${storeText(item.name)}`} onClick={() => { if (!checkoutLock.current) void update({ action: 'remove', key: item.key }) }}><Trash2 size={17} />Remove</button>
          </div><strong>{money(item.totals.line_total)}</strong>
        </article>)}</div>

        <form className="store-address" onSubmit={event => { event.preventDefault(); void quoteNow() }}>
          <h2>Delivery</h2>
          <p>Order confirmation and delivery updates go to <strong>{viewer.email}</strong>.</p>
          <div className="store-address-grid">
            {field('first_name', 'First name', { required: true })}
            {field('last_name', 'Last name', { required: true })}
            {field('address_1', 'Street address', { required: true })}
            {field('address_2', 'Flat, suite, etc. (optional)')}
            {field('city', 'Town / City', { required: true })}
            {field('state', 'County / State')}
            {field('postcode', 'Postcode / ZIP', { required: true })}
            <label>Country<select value={address.country} disabled={busy || processing} onChange={event => { setAddress(current => ({ ...current, country: event.target.value })); setQuote(null) }}>{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
            {field('phone', 'Phone (optional)', { type: 'tel' })}
          </div>
          <button type="submit" className="btn btn-dark" disabled={busy || quoting || processing}>{quoting ? 'Calculating…' : quote ? 'Recalculate delivery & total' : 'Calculate delivery & total'}</button>
        </form>

        {quote && quote.quote.shipping_rates.length > 0 && <div className="store-shipping">
          <h2>Delivery method</h2>
          {quote.quote.shipping_rates.map(rate => <label key={rate.id}>
            <input type="radio" name="shipping-rate" checked={rate.selected} disabled={quoting || processing} onChange={() => void quoteNow(rate.id)} />
            <span>{storeText(rate.label)}</span><strong>{quoteMoney(rate.cost)}</strong>
          </label>)}
        </div>}
      </div>

      <aside className="store-order-summary">
        <h2>Order summary</h2><div><span>Items</span><strong>{money(total.total_items)}</strong></div>
        {Number(total.total_discount) > 0 && <div><span>Discount</span><strong>−{money(total.total_discount)}</strong></div>}
        <form className="store-coupon" onSubmit={async event => {
          event.preventDefault()
          if (busy || checkoutLock.current || !coupon.trim()) return
          if (await update({ action: 'coupon', code: coupon })) setCoupon('')
        }}><input disabled={busy || processing} aria-label="Store coupon code" placeholder="Coupon code" value={coupon} onChange={event => setCoupon(event.target.value)} /><button disabled={busy || processing || !coupon.trim()}>Apply</button></form>
        {cart.coupons?.map((entry: any) => <button key={entry.code} className="store-coupon-remove" disabled={busy || processing} onClick={() => { if (!checkoutLock.current) void update({ action: 'remove-coupon', code: entry.code }) }}>{storeText(entry.code)} ×</button>)}
        {quote ? <>
          <div><span>Delivery</span><strong>{quoteMoney(quote.quote.shipping_total)}</strong></div>
          {Number(quote.quote.tax_total) > 0 && <div><span>Tax</span><strong>{quoteMoney(quote.quote.tax_total)}</strong></div>}
          <div className="store-subtotal"><span>Total</span><strong>{quoteMoney(quote.quote.total)}</strong></div>
        </> : <div><span>Delivery & tax</span><span>Enter your address to calculate</span></div>}
        <p><LockKeyhole size={16} /> Payment is handled securely by Stripe — your card never touches Halobox. Your order is fulfilled by the uebertangel.org store.</p>
      </aside>
    </div>}
    {error && <p role="alert">{error}</p>}
    {!!cart.items.length && quote && <StorePurchaseBar>
      <div className="store-purchase-summary"><strong>Total {quoteMoney(quote.quote.total)}</strong><span>Secure Stripe payment</span></div>
      <button type="button" className="btn btn-primary" disabled={busy || processing} onClick={() => void pay()}>{processing ? 'Opening secure payment…' : 'Pay securely with Stripe'}<ArrowRight size={19} /></button>
      {message && <p className="store-checkout-bar-message" role="alert">{message}</p>}
    </StorePurchaseBar>}
    {!!cart.items.length && !quote && message && <p role="alert">{message}</p>}
  </section>
}
