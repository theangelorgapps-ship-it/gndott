import { img } from '@/components/Poster'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, CreditCard, LockKeyhole, MapPin, Percent, ShieldCheck, ShoppingBag, Trash2, Truck, X } from 'lucide-react'
import { useStoreCart } from '../components/StoreCart'
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

const STEPS = [
  { step: 1, label: 'Review', icon: ShoppingBag },
  { step: 2, label: 'Delivery', icon: Truck },
  { step: 3, label: 'Payment', icon: CreditCard },
]

function Checkout() {
  const { viewer } = Route.useLoaderData()
  const { cancelled } = Route.useSearch()
  const { cart, busy, error, update, refresh } = useStoreCart()
  const [coupon, setCoupon] = useState(''), [message, setMessage] = useState(cancelled ? 'Checkout was cancelled — your cart is unchanged.' : '')
  const [currentStep, setCurrentStep] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [address, setAddress] = useState<Address>(() => ({ ...EMPTY_ADDRESS, first_name: viewer?.first_name ?? '', last_name: viewer?.last_name ?? '' }))
  const [quote, setQuote] = useState<{ checkoutId: string; quote: Quote } | null>(null)
  const [quoting, setQuoting] = useState(false), [processing, setProcessing] = useState(false)
  const checkoutLock = useRef(false)
  const requestKey = useRef(crypto.randomUUID())

  // Any cart change invalidates the quote — totals must be recomputed by the store.
  const itemsCount = cart?.items_count ?? 0
  const quotedFor = useRef<number | null>(null)
  useEffect(() => {
    if (quotedFor.current !== null && quotedFor.current !== itemsCount) { setQuote(null); setCurrentStep(step => Math.min(step, 2)) }
  }, [itemsCount])

  if (!viewer) return <section className="store-checkout">
    <h1>Sign in to check out.</h1>
    <p>Your Halobox account keeps your order, delivery updates and receipt in one place.</p>
    <Link className="btn btn-primary" to="/login">Sign in or create an account</Link>
    <p><Link to="/shop">← Continue shopping</Link></p>
  </section>

  if (!cart) return <section className="store-checkout"><h1>Checkout</h1><p role="status">{error || 'Loading your cart…'}</p>{error && <button className="btn btn-primary" onClick={() => void refresh()}>Retry</button>}</section>
  const total = cart.totals
  const money = (amount: string) => storeMoney(amount, total.currency_code, total.currency_minor_unit)
  // Bridge quote amounts are decimal strings ('96.04'); storeMoney wants minor units.
  const quoteMoney = (amount: string) => storeMoney(String(Math.round(Number(amount) * 100)), quote?.quote.currency ?? 'GBP', 2)

  const field = (key: keyof Address, label: string, props: Record<string, unknown> = {}) => (
    <label>{label}<input value={address[key]} autoComplete={key.replaceAll('_', '-')} disabled={busy || processing} onChange={event => { setAddress(current => ({ ...current, [key]: event.target.value })); setQuote(null) }} {...props} /></label>
  )

  const quoteNow = async (shippingRate?: string): Promise<boolean> => {
    if (quoting || processing || !cart.items.length) return false
    setQuoting(true); setMessage('')
    try {
      const result = await quoteStoreCheckout({ data: { address, ...(shippingRate ? { shippingRate } : {}) } })
      if (!result.ok) { setMessage(result.error); if ('needsAuth' in result && result.needsAuth) setMessage('Sign in to check out.'); return false }
      quotedFor.current = itemsCount
      setQuote({ checkoutId: result.checkoutId, quote: result.quote as Quote })
      // A single available rate is selected by the store; re-quote to lock it into the total.
      const rates = (result.quote as Quote).shipping_rates
      if (!shippingRate && rates.length === 1 && !rates[0].selected) return await quoteNow(rates[0].id)
      return true
    } finally { setQuoting(false) }
  }

  const pay = async () => {
    if (checkoutLock.current || busy || !quote || !agreed) return
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

  const continueToDelivery = () => { setMessage(''); setCurrentStep(2) }
  const continueToPayment = async () => { if (quote || await quoteNow()) setCurrentStep(3) }

  if (!cart.items.length) return <section className="store-checkout">
    <Link to="/shop" className="store-checkout-back"><ChevronLeft size={16} /> Back to shop</Link>
    <div className="store-empty"><ShoppingBag size={40} /><h2>Make room for inspiration.</h2><p>Your cart is empty.</p><Link className="btn btn-primary" to="/shop">Explore the shop</Link></div>
  </section>

  return <section className="store-checkout">
    <header className="checkout-head">
      <Link to="/shop" className="store-checkout-back"><ChevronLeft size={16} /> Back to shop</Link>
      <div className="checkout-head-title"><h1>Checkout</h1><p>Complete your purchase securely</p></div>
      <span className="checkout-secure-badge"><ShieldCheck size={14} /> SSL secured</span>
    </header>

    <ol className="checkout-steps" aria-label="Checkout steps">
      {STEPS.map(({ step, label, icon: Icon }, index) => <li key={step}>
        <span className={`checkout-step${currentStep >= step ? ' active' : ''}${currentStep > step ? ' done' : ''}`} aria-current={currentStep === step ? 'step' : undefined}>
          <span className="checkout-step-dot">{currentStep > step ? <Check size={15} /> : <Icon size={15} />}</span>
          <span className="checkout-step-label">{label}</span>
        </span>
        {index < STEPS.length - 1 && <span className={`checkout-step-line${currentStep > step ? ' done' : ''}`} aria-hidden="true" />}
      </li>)}
    </ol>

    <div className="store-checkout-grid">
      <div className="checkout-main">
        {currentStep === 1 && <div className="checkout-card">
          <h2 className="checkout-card-title"><ShoppingBag size={19} /> Review your order</h2>
          <div className="store-cart-items">{cart.items.map((item: any) => <article key={item.key} className="store-cart-item">
            <img src={img(item.images?.[0]?.src)} alt="" />
            <div><h2>{storeText(item.name)}</h2>{item.variation?.map((variation: any) => <p key={variation.attribute}>{storeText(variation.attribute)}: {storeText(variation.value)}</p>)}
              <label>Quantity<select disabled={busy || processing} value={item.quantity} onChange={event => { if (!checkoutLock.current) void update({ action: 'update', key: item.key, quantity: Number(event.target.value) }) }}>{Array.from({ length: 20 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
              <button className="store-remove" disabled={busy || processing} aria-label={`Remove ${storeText(item.name)}`} onClick={() => { if (!checkoutLock.current) void update({ action: 'remove', key: item.key }) }}><Trash2 size={17} />Remove</button>
            </div><strong>{money(item.totals.line_total)}</strong>
          </article>)}</div>
          <form className="store-coupon" onSubmit={async event => {
            event.preventDefault()
            if (busy || checkoutLock.current || !coupon.trim()) return
            if (await update({ action: 'coupon', code: coupon })) setCoupon('')
          }}><input disabled={busy || processing} aria-label="Store coupon code" placeholder="Coupon code" value={coupon} onChange={event => setCoupon(event.target.value)} /><button disabled={busy || processing || !coupon.trim()}>Apply</button></form>
          {cart.coupons?.map((entry: any) => <span key={entry.code} className="checkout-promo"><Percent size={13} /> {storeText(entry.code)}<button className="store-coupon-remove" disabled={busy || processing} aria-label={`Remove coupon ${storeText(entry.code)}`} onClick={() => { if (!checkoutLock.current) void update({ action: 'remove-coupon', code: entry.code }) }}><X size={13} /></button></span>)}
          <div className="checkout-card-actions">
            <span />
            <button type="button" className="btn btn-primary" onClick={continueToDelivery}>Continue to delivery <ArrowRight size={17} /></button>
          </div>
        </div>}

        {currentStep === 2 && <form className="checkout-card" onSubmit={event => { event.preventDefault(); void continueToPayment() }}>
          <h2 className="checkout-card-title"><MapPin size={19} /> Delivery information</h2>
          <p className="checkout-note">Order confirmation and delivery updates go to <strong>{viewer.email}</strong>.</p>
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
          {!quote && <div className="checkout-card-actions">
            <button type="button" className="btn btn-dark" disabled={busy || quoting || processing} onClick={() => void quoteNow()}>{quoting ? 'Calculating…' : 'Calculate delivery & total'}</button>
          </div>}
          {quote && quote.quote.shipping_rates.length > 0 && <div className="store-shipping">
            <h3>Delivery method</h3>
            {quote.quote.shipping_rates.map(rate => <label key={rate.id} className={rate.selected ? 'selected' : ''}>
              <input type="radio" name="shipping-rate" checked={rate.selected} disabled={quoting || processing} onChange={() => void quoteNow(rate.id)} />
              <span>{storeText(rate.label)}</span><strong>{quoteMoney(rate.cost)}</strong>
            </label>)}
          </div>}
          <div className="checkout-card-actions">
            <button type="button" className="btn btn-dark" onClick={() => setCurrentStep(1)}><ChevronLeft size={16} /> Back</button>
            <button type="submit" className="btn btn-primary" disabled={busy || quoting || processing}>{quoting ? 'Calculating…' : quote ? 'Continue to payment' : 'Calculate & continue'} <ArrowRight size={17} /></button>
          </div>
        </form>}

        {currentStep === 3 && quote && <div className="checkout-card">
          <h2 className="checkout-card-title"><CreditCard size={19} /> Review & pay</h2>
          <div className="checkout-review">
            <div><h3>Deliver to</h3><p>{address.first_name} {address.last_name}<br />{address.address_1}{address.address_2 ? `, ${address.address_2}` : ''}<br />{address.city}{address.state ? `, ${address.state}` : ''} {address.postcode}<br />{COUNTRIES.find(([code]) => code === address.country)?.[1]}</p></div>
            <div><h3>Delivery method</h3><p>{storeText(quote.quote.shipping_rates.find(rate => rate.selected)?.label || 'Standard')} — {quoteMoney(quote.quote.shipping_total)}</p></div>
            <div><h3>Payment</h3><p><LockKeyhole size={14} /> Secure card payment via Stripe — Apple Pay and Google Pay appear automatically when your device supports them.</p></div>
          </div>
          <label className="checkout-terms"><input type="checkbox" checked={agreed} disabled={processing} onChange={event => setAgreed(event.target.checked)} />
            <span>I agree to the <Link to="/page/$slug" params={{ slug: 'terms-conditions' }} target="_blank">Terms & Conditions</Link> and <Link to="/page/$slug" params={{ slug: 'privacy-policy' }} target="_blank">Privacy Policy</Link>.</span>
          </label>
          <div className="checkout-card-actions">
            <button type="button" className="btn btn-dark" disabled={processing} onClick={() => setCurrentStep(2)}><ChevronLeft size={16} /> Back</button>
            <button type="button" className="btn btn-primary checkout-pay-btn" disabled={busy || processing || !agreed} onClick={() => void pay()}><LockKeyhole size={16} /> {processing ? 'Opening secure payment…' : `Pay ${quoteMoney(quote.quote.total)} securely`}</button>
          </div>
          {message && <p role="alert" className="checkout-message">{message}</p>}
        </div>}
        {message && currentStep !== 3 && <p role="alert" className="checkout-message">{message}</p>}
      </div>

      <aside className="store-order-summary">
        <h2>Order summary</h2>
        <div className="checkout-summary-items">{cart.items.map((item: any) => <div key={item.key} className="checkout-summary-item">
          <span className="checkout-summary-thumb"><img src={img(item.images?.[0]?.thumbnail || item.images?.[0]?.src)} alt="" /><b>{item.quantity}</b></span>
          <span className="checkout-summary-name">{storeText(item.name)}</span>
          <strong>{money(item.totals.line_total)}</strong>
        </div>)}</div>
        <div><span>Items</span><strong>{money(total.total_items)}</strong></div>
        {Number(total.total_discount) > 0 && <div><span>Discount</span><strong>−{money(total.total_discount)}</strong></div>}
        {quote ? <>
          <div><span>Delivery</span><strong>{quoteMoney(quote.quote.shipping_total)}</strong></div>
          {Number(quote.quote.tax_total) > 0 && <div><span>Tax</span><strong>{quoteMoney(quote.quote.tax_total)}</strong></div>}
          <div className="store-subtotal"><span>Total</span><strong>{quoteMoney(quote.quote.total)}</strong></div>
        </> : <div><span>Delivery & tax</span><span>Calculated at delivery step</span></div>}
        <div className="checkout-secure-card"><ShieldCheck size={20} /><div><strong>Secure & encrypted</strong><span>Payment is handled by Stripe — your card never touches Halobox. Fulfilled by the uebertangel.org store.</span></div></div>
      </aside>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>
}
