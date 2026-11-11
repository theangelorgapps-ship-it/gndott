import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { BellRing, ChevronLeft, ChevronRight, ShoppingBag, Truck } from 'lucide-react'
import {
  buyNowProduct, getContentProducts, getStoreAddress, saveStoreAddress, saveStoreReminder,
  type ContentType, type RecommendedProduct, type StoreAddress,
} from '../lib/recommendedProducts'
import { storeMoney } from '../lib/storeTypes'

// "Recommended Resources" — shop products linked to the title being watched.
// Get Now one-steps to store checkout when the viewer has saved delivery
// details; otherwise it says so and offers Remind Me, which re-prompts after
// playback ends or the player closes.

function AddressForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<StoreAddress>({ firstName: '', lastName: '', phone: '', address1: '', address2: '', city: '', state: '', postcode: '', country: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const set = (key: keyof StoreAddress) => (e: any) => setForm(f => ({ ...f, [key]: e.target.value }))
  return (
    <form className="resource-address" onSubmit={async e => {
      e.preventDefault()
      setBusy(true); setMessage('')
      try {
        await saveStoreAddress({ data: form })
        onSaved()
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your delivery details.') }
      finally { setBusy(false) }
    }}>
      <label>First name<input value={form.firstName} onChange={set('firstName')} autoComplete="given-name" /></label>
      <label>Last name<input value={form.lastName} onChange={set('lastName')} autoComplete="family-name" placeholder="Optional" /></label>
      <label>Phone<input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="Optional" /></label>
      <label>Country code<input value={form.country} onChange={set('country')} placeholder="GB" maxLength={2} autoComplete="country" /></label>
      <label>Address line 1<input value={form.address1} onChange={set('address1')} autoComplete="address-line1" /></label>
      <label>Address line 2<input value={form.address2} onChange={set('address2')} autoComplete="address-line2" placeholder="Optional" /></label>
      <label>City<input value={form.city} onChange={set('city')} autoComplete="address-level2" /></label>
      <label>State / county<input value={form.state} onChange={set('state')} autoComplete="address-level1" placeholder="Optional" /></label>
      <label>Postcode<input value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" /></label>
      {message && <p className="resource-message" role="status">{message}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save delivery details'}</button>
    </form>
  )
}

function ResourceCard({ product, contentType, contentId, viewerId }: { product: RecommendedProduct; contentType: ContentType; contentId: number; viewerId: number | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'buy' | 'remind' | null>(null)
  const [message, setMessage] = useState('')
  const [reminded, setReminded] = useState(false)
  const [needsDetails, setNeedsDetails] = useState(false)
  const [addressForm, setAddressForm] = useState(false)

  async function getNow() {
    if (!viewerId) { router.navigate({ to: '/login' }); return }
    setBusy('buy'); setMessage('')
    try {
      const result = await buyNowProduct({ data: { productId: product.id } })
      if (result.ok && 'checkoutUrl' in result && result.checkoutUrl) { window.location.assign(result.checkoutUrl); return }
      if (result.ok) { setMessage('You already own this order.'); return }
      if ('needsDetails' in result && result.needsDetails) { setNeedsDetails(true); setMessage('Your delivery details are not saved, so we can’t check you out instantly yet. Save them once — or choose Remind Me and we’ll bring you back after this video.') }
      else if ('error' in result && result.error) setMessage(result.error)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout is temporarily unavailable. Please try again.')
    } finally { setBusy(null) }
  }

  async function remindMe() {
    if (!viewerId) { router.navigate({ to: '/login' }); return }
    setBusy('remind'); setMessage('')
    try {
      await saveStoreReminder({ data: { productId: product.id, contentType, contentId } })
      setReminded(true)
      setMessage('Saved. We’ll remind you when this video finishes or you close the player.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the reminder. Please try again.')
    } finally { setBusy(null) }
  }

  return (
    <div className="resource-card">
      <div className="resource-art">
        <img src={product.image} alt={product.name} loading="lazy" />
        <div className="resource-art-overlay">
          <strong>{product.name}</strong>
          <span className="resource-price">{storeMoney(product.price, product.currency, product.minorUnit)}</span>
          {!product.inStock && <span className="resource-out">Out of stock</span>}
        </div>
      </div>
      <div className="resource-card-body">
        <div className="resource-actions">
          <button type="button" className="resource-buy" disabled={busy !== null || !product.inStock} onClick={() => void getNow()}>
            <ShoppingBag size={15} /> {busy === 'buy' ? 'Checking…' : 'Get Now'}
          </button>
          <button type="button" className="resource-remind" disabled={busy !== null || reminded} onClick={() => void remindMe()}>
            <BellRing size={15} /> {reminded ? 'Reminder set' : busy === 'remind' ? 'Saving…' : 'Remind Me'}
          </button>
        </div>
        {message && <p className="resource-message" role="status">{message}</p>}
        {needsDetails && !addressForm && (
          <button type="button" className="resource-save-details" onClick={() => setAddressForm(true)}>
            <Truck size={15} /> Save delivery details
          </button>
        )}
        {addressForm && <AddressForm onSaved={() => { setAddressForm(false); setNeedsDetails(false); setMessage('Delivery details saved. Tap Get Now to check out instantly.') }} />}
      </div>
    </div>
  )
}

function ResourceCarousel({ products, contentType, contentId, viewerId }: { products: RecommendedProduct[]; contentType: ContentType; contentId: number; viewerId: number | null }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const updateEdges = () => {
    const rail = railRef.current
    if (!rail) return
    setEdge({ start: rail.scrollLeft <= 4, end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4 })
  }
  useEffect(() => { updateEdges() }, [products])
  const step = (direction: 1 | -1) => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: direction * rail.clientWidth * 0.85, behavior: 'smooth' })
  }
  return (
    <div className="resource-carousel">
      {products.length > 1 && (
        <div className="resource-carousel-nav">
          <button type="button" aria-label="Previous products" disabled={edge.start} onClick={() => step(-1)}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="More products" disabled={edge.end} onClick={() => step(1)}><ChevronRight size={16} /></button>
        </div>
      )}
      <div className="resource-rail" ref={railRef} onScroll={updateEdges} data-lenis-prevent>
        {products.map(p => <ResourceCard key={p.id} product={p} contentType={contentType} contentId={contentId} viewerId={viewerId} />)}
      </div>
    </div>
  )
}

export function RecommendedResources({ contentType, contentId, viewerId }: { contentType: ContentType; contentId: number; viewerId: number | null }) {
  const [products, setProducts] = useState<RecommendedProduct[] | null>(null)
  useEffect(() => {
    let alive = true
    getContentProducts({ data: { contentType, contentId } })
      .then(res => { if (alive) setProducts(res.products) })
      .catch(() => { if (alive) setProducts([]) })
    return () => { alive = false }
  }, [contentType, contentId])
  if (!products || products.length === 0) return null
  return (
    <details className="tv-player-description tv-resources">
      <summary>Recommended Resources</summary>
      <ResourceCarousel products={products} contentType={contentType} contentId={contentId} viewerId={viewerId} />
    </details>
  )
}
