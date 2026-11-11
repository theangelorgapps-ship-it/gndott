import { img } from '@/lib/imageUrls'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ShoppingBag, X, ArrowRight, Minus, Plus, Trash2, Check } from 'lucide-react'
import { getStoreCart, updateStoreCart } from '../lib/store'
import { storeMoney, storeText } from '../lib/storeTypes'
import { StorePurchaseBar } from './StorePurchaseBar'

type CartContext = {
  cart: any; busy: boolean; loading: boolean; error: string; open: boolean; status: string;
  update: (data: Parameters<typeof updateStoreCart>[0]['data']) => Promise<boolean>;
  refresh: () => Promise<void>; toggleCart: () => void;
}
const StoreContext = createContext<CartContext | null>(null)
export function useStoreCart() { const context = useContext(StoreContext); if (!context) throw new Error('Store cart provider missing'); return context }

export function StoreCartActions() {
  const { cart, busy, loading, error, open, toggleCart } = useStoreCart()
  const canCheckout = !!cart?.items?.length && !busy
  return <div className="store-cart-actions">
    <button type="button" className="store-cart-toggle" aria-expanded={open} aria-controls="store-cart-preview" onClick={toggleCart}>
      <ShoppingBag size={19} /><span>Cart <b>{loading ? '…' : error && !cart ? '—' : cart?.items_count || 0}</b></span>
    </button>
    {canCheckout ? <Link className="store-bar-checkout" to="/shop/checkout">Checkout <ArrowRight size={17} /></Link> : <button type="button" className="store-bar-checkout" disabled>Checkout <ArrowRight size={17} /></button>}
  </div>
}

export function StoreCartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<any>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const mutation = useRef(false), revision = useRef(0)
  const path = useRouterState({ select: state => state.location.pathname })
  const refresh = useCallback(async () => {
    if (mutation.current) return
    const request = ++revision.current
    setLoading(true)
    try {
      const next = await getStoreCart()
      if (revision.current === request) { setCart(next); setError('') }
    } catch { if (revision.current === request) setError('Unable to load your cart. Please retry.') }
    finally { if (revision.current === request) setLoading(false) }
  }, [])
  useEffect(() => { void refresh(); return () => { revision.current++ } }, [refresh])
  useEffect(() => { setOpen(false); setStatus('') }, [path])
  const update = async (data: Parameters<typeof updateStoreCart>[0]['data']) => {
    // Lock immediately: two clicks before React commits must never add twice.
    if (mutation.current) return false
    mutation.current = true; revision.current++; setLoading(false); setBusy(true); setError(''); setStatus('')
    try {
      setCart(await updateStoreCart({ data }))
      setStatus(data.action === 'add' ? 'Added to your cart' : data.action === 'remove' ? 'Resource removed' : data.action === 'update' ? 'Quantity updated' : 'Cart updated')
      if (data.action === 'add') setOpen(true)
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update your cart.'); return false }
    finally { mutation.current = false; setBusy(false) }
  }
  const overview = path === '/shop' || path === '/shop/'
  return <StoreContext.Provider value={{ cart, busy: busy || loading, loading, error, open, status, update, refresh, toggleCart: () => setOpen(value => !value) }}>
    {children}
    {overview && <StorePurchaseBar><div className="store-purchase-summary"><strong>Your cart</strong><span>{loading ? 'Loading your cart…' : error && !cart ? 'Open your cart to retry.' : cart?.items?.length ? `${cart.items_count} items · ${storeMoney(cart.totals.total_items, cart.totals.currency_code, cart.totals.currency_minor_unit)}` : 'Your cart is empty.'}</span></div><StoreCartActions /></StorePurchaseBar>}
    {path !== '/shop/checkout' && open && <CartDrawer onClose={() => setOpen(false)} />}
  </StoreContext.Provider>
}

function CartDrawer({ onClose }: { onClose: () => void }) {
  const { cart, busy, loading, error, status, update, refresh } = useStoreCart()
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  const totals = cart?.totals
  const money = (amount: string | number) => storeMoney(amount, totals?.currency_code, totals?.currency_minor_unit)
  const items = cart?.items ?? []
  return <dialog ref={dialogRef} id="store-cart-preview" className="store-cart-drawer" aria-labelledby="cart-drawer-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="store-cart-drawer-inner">
      <header className="cart-drawer-header"><div><h2 id="cart-drawer-title">Your cart</h2><p>{cart?.items_count ?? 0} {(cart?.items_count ?? 0) === 1 ? 'resource' : 'resources'}</p><Link className="cart-order-history" to="/payment-history" onClick={onClose}>Order history</Link></div><button type="button" autoFocus aria-label="Close cart" onClick={onClose}><X size={22} /></button></header>
      <p className="cart-update-status" role="status" aria-atomic="true">{status && !error && <span><Check size={15} aria-hidden="true" />{status}</span>}</p>
      <div className="cart-drawer-body" aria-busy={busy}>
        {loading ? <p role="status">Loading your cart…</p> : items.length ? items.map((item: any) => {
          const name = storeText(item.name)
          const minimum = Math.max(1, item.quantity_limits?.minimum ?? 1)
          const maximum = Math.min(20, item.quantity_limits?.maximum ?? 20)
          return <article key={item.key} className="cart-drawer-item">
            <img src={img(item.images?.[0]?.thumbnail || item.images?.[0]?.src)} alt="" width="88" height="104" />
            <div className="cart-drawer-item-copy"><h3>{name}</h3>{item.variation?.map((variation: any) => <p key={variation.attribute}>{storeText(variation.attribute)}: {storeText(variation.value)}</p>)}
              <strong>{storeMoney(item.prices.price, item.prices.currency_code, item.prices.currency_minor_unit)}</strong>
              <div className="cart-drawer-item-actions"><div className="cart-quantity" role="group" aria-label={`Quantity for ${name}`}>
                <button type="button" disabled={busy || item.quantity <= minimum} aria-label={`Decrease quantity for ${name}`} onClick={() => void update({ action: 'update', key: item.key, quantity: item.quantity - 1 })}><Minus size={15} /></button>
                <span aria-live="polite" aria-atomic="true">{item.quantity}</span>
                <button type="button" disabled={busy || item.quantity >= maximum} aria-label={`Increase quantity for ${name}`} onClick={() => void update({ action: 'update', key: item.key, quantity: item.quantity + 1 })}><Plus size={15} /></button>
              </div><button type="button" className="cart-remove" disabled={busy} aria-label={`Remove ${name}`} onClick={() => void update({ action: 'remove', key: item.key })}><Trash2 size={16} /><span>Remove</span></button></div>
            </div>
          </article>
        }) : <div className="cart-drawer-empty"><ShoppingBag size={36} /><h3>Your cart is empty</h3><p>Browse the resources and add your favourites.</p><button type="button" onClick={onClose}>Continue browsing</button></div>}
        {error && <div className="cart-drawer-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => void refresh()}>Retry</button></div>}
      </div>
      {!!items.length && totals && <footer className="cart-drawer-footer">
        <div><span>Items</span><strong>{money(totals.total_items)}</strong></div>
        {Number(totals.total_discount) > 0 && <div><span>Discount</span><strong>−{money(totals.total_discount)}</strong></div>}
        <div className="cart-drawer-subtotal" aria-live="polite"><span>Subtotal</span><strong>{money(Number(totals.total_items) - Number(totals.total_discount || 0))}</strong></div>
        <p>Delivery and tax calculated at checkout.</p>
        {busy ? <button type="button" className="cart-drawer-checkout" disabled>Updating cart…</button> : <Link to="/shop/checkout" className="cart-drawer-checkout">Review & checkout <ArrowRight size={18} /></Link>}
        <button type="button" className="cart-continue" onClick={onClose}>Continue browsing</button>
      </footer>}
    </div>
  </dialog>
}
