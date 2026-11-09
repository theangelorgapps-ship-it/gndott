import { img } from '@/components/Poster'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ArrowRight, LockKeyhole, ShoppingBag, Trash2 } from 'lucide-react'
import { useStoreCart } from '../components/StoreCart'
import { StorePurchaseBar } from '../components/StorePurchaseBar'
import { startStoreCheckout } from '../lib/store'
import { storeMoney, storeText } from '../lib/storeTypes'

export const Route = createFileRoute('/shop/checkout')({ component: Checkout })
function Checkout() {
  const { cart, busy, error, update, refresh } = useStoreCart()
  const [coupon, setCoupon] = useState(''), [processing, setProcessing] = useState(false), [message, setMessage] = useState('')
  const checkoutLock = useRef(false)
  const checkout = async () => {
    if (checkoutLock.current || busy || !cart?.items?.length) return
    checkoutLock.current = true; setProcessing(true); setMessage('')
    try { const result = await startStoreCheckout(); window.location.assign(result.url) }
    catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to start checkout.')
      checkoutLock.current = false; setProcessing(false)
    }
  }
  if (!cart) return <section className="store-checkout"><h1>Your cart</h1><p role="status">{error || 'Loading your cart…'}</p>{error && <button className="btn btn-primary" onClick={() => void refresh()}>Retry</button>}</section>
  const total = cart.totals
  const money = (amount: string) => storeMoney(amount, total.currency_code, total.currency_minor_unit)
  const subtotal = money(String(Number(total.total_items) - Number(total.total_discount)))
  return <section className="store-checkout">
    <Link to="/shop">← Continue shopping</Link><h1>Your cart.</h1>
    <ol className="store-checkout-steps" aria-label="Checkout steps"><li aria-current="step">1 · Review</li><li>2 · Delivery</li><li>3 · Secure payment</li></ol>
    {!cart.items.length ? <div className="store-empty"><ShoppingBag size={40} /><h2>Make room for inspiration.</h2><p>Your cart is empty.</p><Link className="btn btn-primary" to="/shop">Explore the shop</Link></div> : <div className="store-checkout-grid">
      <div className="store-cart-items">{cart.items.map((item: any) => <article key={item.key} className="store-cart-item">
        <img src={img(item.images?.[0]?.src)} alt="" />
        <div><h2>{storeText(item.name)}</h2>{item.variation?.map((variation: any) => <p key={variation.attribute}>{storeText(variation.attribute)}: {storeText(variation.value)}</p>)}
          <label>Quantity<select disabled={busy || processing} value={item.quantity} onChange={event => { if (!checkoutLock.current) void update({ action: 'update', key: item.key, quantity: Number(event.target.value) }) }}>{Array.from({ length: 20 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
          <button className="store-remove" disabled={busy || processing} aria-label={`Remove ${storeText(item.name)}`} onClick={() => { if (!checkoutLock.current) void update({ action: 'remove', key: item.key }) }}><Trash2 size={17} />Remove</button>
        </div><strong>{money(item.totals.line_total)}</strong>
      </article>)}</div>
      <aside className="store-order-summary">
        <h2>Order summary</h2><div><span>Items</span><strong>{money(total.total_items)}</strong></div>
        {Number(total.total_discount) > 0 && <div><span>Discount</span><strong>−{money(total.total_discount)}</strong></div>}
        <div><span>Shipping & tax</span><span>Calculated at checkout</span></div>
        <form className="store-coupon" onSubmit={async event => {
          event.preventDefault()
          if (busy || checkoutLock.current || !coupon.trim()) return
          if (await update({ action: 'coupon', code: coupon })) setCoupon('')
        }}><input disabled={busy || processing} aria-label="Store coupon code" placeholder="Coupon code" value={coupon} onChange={event => setCoupon(event.target.value)} /><button disabled={busy || processing || !coupon.trim()}>Apply</button></form>
        {cart.coupons?.map((entry: any) => <button key={entry.code} className="store-coupon-remove" disabled={busy || processing} onClick={() => { if (!checkoutLock.current) void update({ action: 'remove-coupon', code: entry.code }) }}>{storeText(entry.code)} ×</button>)}
        <div className="store-subtotal"><span>Subtotal</span><strong>{subtotal}</strong></div>
        <p><LockKeyhole size={16} /> Your cart opens securely at uebertangel.org, where you choose delivery and pay. Final prices and availability are confirmed there.</p>
      </aside>
    </div>}
    {error && <p role="alert">{error}</p>}
    {!!cart.items.length && <StorePurchaseBar>
      <div className="store-purchase-summary"><strong>Subtotal {subtotal}</strong><span>Delivery and tax at checkout</span></div>
      <button type="button" className="btn btn-primary" disabled={busy || processing} onClick={() => void checkout()}>{processing ? 'Opening checkout…' : 'Continue to checkout'}<ArrowRight size={19} /></button>
      {message && <p className="store-checkout-bar-message" role="alert">{message}</p>}
    </StorePurchaseBar>}
  </section>
}
