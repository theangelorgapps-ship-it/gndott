import { img } from '@/components/Poster'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Check, ShoppingBag, Truck, ShieldCheck } from 'lucide-react'
import { getStoreProduct } from '../lib/store'
import { StoreCartActions, useStoreCart } from '../components/StoreCart'
import { StoreLoading, StorePurchaseBar } from '../components/StorePurchaseBar'
import { storeText, storeMoney } from '../lib/storeTypes'

export const Route = createFileRoute('/shop/$slug')({
  loader: ({ params }) => getStoreProduct({ data: Number(params.slug.match(/-(\d+)$/)?.[1]) }),
  staleTime: 30000, pendingMs: 150, pendingMinMs: 200,
  pendingComponent: () => <StoreLoading product />,
  component: ProductPage,
  errorComponent: ({ error }) => <section className="store-catalogue"><h1>Product unavailable</h1><p>{error instanceof Error ? error.message : 'Please try again.'}</p><Link to="/shop">Back to shop</Link></section>,
})
function ProductPage() { const p = Route.useLoaderData(); return <ProductContent key={p.id} p={p} /> }
function ProductContent({ p }: { p: import('../lib/storeTypes').StoreProduct }) {
  const [index, setIndex] = useState(0), [selected, setSelected] = useState<Record<string, string>>({}), [quantity, setQuantity] = useState(1), [added, setAdded] = useState(false)
  const { update, busy, error } = useStoreCart()
  const attributes = p.attributes.filter(attribute => attribute.has_variations)
  const complete = attributes.every(attribute => !!selected[attribute.name])
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 20
  const available = p.is_purchasable && p.is_in_stock
  const canAdd = !busy && available && complete && validQuantity
  const price = `${p.has_options ? 'From ' : ''}${storeMoney(p.prices.price, p.prices.currency_code, p.prices.currency_minor_unit)}`
  return <section className="store-product-detail" key={p.id}>
    <div className="store-gallery"><div className="store-gallery-main"><img src={img(p.images[index]?.src)} alt={p.images[index]?.alt || storeText(p.name)} /></div><div className="store-gallery-thumbs">{p.images.map((image, imageIndex) => <button key={image.id} type="button" aria-label={`Product image ${imageIndex + 1}`} aria-pressed={imageIndex === index} onClick={() => setIndex(imageIndex)}><img src={img(image.src)} alt="" /></button>)}</div></div>
    <div className="store-product-information"><Link to="/shop">← All products</Link><span className="store-eyebrow">{storeText(p.categories[0]?.name)}</span><h1>{storeText(p.name)}</h1><p className="store-detail-price">{price}</p><p className="store-product-description">{storeText(p.short_description || p.description)}</p>
      <form onSubmit={async event => {
        event.preventDefault()
        if (!canAdd) return
        setAdded(false)
        const ok = await update({ action: 'add', id: p.id, quantity, variation: attributes.map(attribute => ({ attribute: attribute.taxonomy || attribute.name, value: selected[attribute.name] })) })
        setAdded(ok)
      }}>
        {attributes.map(attribute => <fieldset key={attribute.name}><legend>{storeText(attribute.name)}</legend><div className="store-options">{attribute.terms.map(term => {
          const value = attribute.taxonomy ? term.slug : term.name
          return <button type="button" key={term.slug} disabled={busy} aria-pressed={selected[attribute.name] === value} onClick={() => { setAdded(false); setSelected({ ...selected, [attribute.name]: value }) }}>{storeText(term.name)}</button>
        })}</div></fieldset>)}
        {!complete && <p id="store-product-options-hint" className="muted">Choose your options to add this item.</p>}
        {error && <p role="alert">{error}</p>}
        <StorePurchaseBar product>
          <div className="store-purchase-summary"><strong>{storeText(p.name)}</strong><span>{!available ? 'Currently unavailable' : !complete ? 'Choose options above' : price}</span></div>
          <div className="store-purchase-controls">
            <label className="store-bar-quantity">Quantity<input aria-label="Quantity" type="number" min={1} max={20} step={1} disabled={busy || !available} value={quantity} onChange={event => { setAdded(false); setQuantity(Number(event.target.value)) }} /></label>
            <button className="btn btn-primary" disabled={!canAdd} aria-describedby={!complete ? 'store-product-options-hint' : undefined}>{added ? <Check size={20} /> : <ShoppingBag size={20} />} {busy ? 'Please wait…' : !available ? 'Unavailable' : added ? 'Added to cart' : 'Add to cart'}</button>
            {!validQuantity && <span role="status" className="store-quantity-error">Choose 1–20.</span>}
          </div>
          <StoreCartActions />
        </StorePurchaseBar>
        {added && <p className="store-add-confirmation" role="status">Added to your cart.</p>}
      </form>
      <div className="store-product-service"><p><Truck size={20} /> Shipping options and delivery cost at checkout</p><p><ShieldCheck size={20} /> Orders fulfilled by uebertangel.org</p></div><details><summary>About this product</summary><p className="store-product-description">{storeText(p.description)}</p></details>
    </div>
  </section>
}
