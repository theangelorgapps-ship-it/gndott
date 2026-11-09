import type { ReactNode } from 'react'

/** A store-only surface; product forms keep their native submit ownership. */
export function StorePurchaseBar({ children, product = false }: { children: ReactNode; product?: boolean }) {
  return <aside className={`store-purchase-bar${product ? ' store-purchase-bar-product' : ''}`} aria-label={product ? 'Purchase this product' : 'Shopping controls'}>
    <div className="store-purchase-bar-inner">{children}</div>
  </aside>
}

export function StoreLoading({ product = false }: { product?: boolean }) {
  return <section className="store-loading" aria-busy="true" aria-label={product ? 'Loading product' : 'Loading store'}>
    <p role="status">{product ? 'Loading your product…' : 'Opening the store…'}</p>
    <div className={product ? 'store-loading-product' : 'store-product-grid'} aria-hidden="true">
      {Array.from({ length: product ? 2 : 8 }, (_, index) => <div className="store-loading-tile" key={index} />)}
    </div>
  </section>
}
