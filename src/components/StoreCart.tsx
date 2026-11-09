import { img } from '@/lib/imageUrls'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ShoppingBag, X, ArrowRight } from 'lucide-react'
import { getStoreCart, updateStoreCart } from '../lib/store'
import { storeMoney, storeText } from '../lib/storeTypes'
import { StorePurchaseBar } from './StorePurchaseBar'

type CartContext = {
  cart: any; busy: boolean; loading: boolean; error: string; open: boolean;
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
  useEffect(() => { setOpen(false) }, [path])
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  const update = async (data: Parameters<typeof updateStoreCart>[0]['data']) => {
    // Lock immediately: two clicks before React commits must never add twice.
    if (mutation.current) return false
    mutation.current = true; revision.current++; setLoading(false); setBusy(true); setError('')
    try {
      setCart(await updateStoreCart({ data }))
      if (data.action === 'add') setOpen(true)
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update your cart.'); return false }
    finally { mutation.current = false; setBusy(false) }
  }
  const overview = path === '/shop' || path === '/shop/'
  return <StoreContext.Provider value={{ cart, busy: busy || loading, loading, error, open, update, refresh, toggleCart: () => setOpen(value => !value) }}>
    {children}
    {overview && <StorePurchaseBar><div className="store-purchase-summary"><strong>Your cart</strong><span>{loading ? 'Loading your cart…' : error && !cart ? 'Open your cart to retry.' : cart?.items?.length ? `${cart.items_count} items · ${storeMoney(cart.totals.total_items, cart.totals.currency_code, cart.totals.currency_minor_unit)}` : 'Choose something inspiring.'}</span></div><StoreCartActions /></StorePurchaseBar>}
    {path !== '/shop/checkout' && open && <aside id="store-cart-preview" className="store-cart-preview" aria-label="Shopping cart">
      <div className="store-cart-preview-heading"><h2>Your cart</h2><button type="button" aria-label="Close cart" onClick={() => setOpen(false)}><X size={20} /></button></div>
      <div className="store-mini-cart">
        {loading ? <p role="status">Loading your cart…</p> : cart?.items?.length ? cart.items.map((item: any) => <div key={item.key} className="store-mini-item"><img src={img(item.images?.[0]?.thumbnail || item.images?.[0]?.src)} alt="" /><div><strong>{storeText(item.name)}</strong>{item.variation?.map((variation: any) => <small key={variation.attribute}>{storeText(variation.attribute)}: {storeText(variation.value)} </small>)}<p>{item.quantity} × {storeMoney(item.prices.price, item.prices.currency_code, item.prices.currency_minor_unit)}</p></div></div>) : <p>Your cart is empty.</p>}
        {error && <p role="alert">{error} <button type="button" disabled={busy || loading} onClick={() => void refresh()}>Retry</button></p>}
        {!!cart?.items?.length && !busy && <Link className="btn btn-primary" to="/shop/checkout">Review & checkout <ArrowRight size={18} /></Link>}
      </div>
    </aside>}
  </StoreContext.Provider>
}
