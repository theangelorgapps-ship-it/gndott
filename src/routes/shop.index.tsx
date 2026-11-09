import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { StoreLoading } from '../components/StorePurchaseBar'
import { getStoreProducts } from '../lib/store'
import { storeText } from '../lib/storeTypes'
import { ProductCard } from '../components/ui/product-card-1'
import { ChoicePicker } from '../components/ui/choice-picker'
import { CatalogueFilterBar } from '../components/ui/catalogue-filter-bar'

export const Route = createFileRoute('/shop/')({ loader: () => getStoreProducts(), staleTime: 120000, preloadStaleTime: 120000, pendingMs: 150, pendingMinMs: 200, pendingComponent: StoreLoading, component: ShopIndex })
function ShopIndex() {
  const { products, error } = Route.useLoaderData()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('featured')
  const cats = [...new Map(products.flatMap(p => p.categories).map(c => [c.slug, c])).values()]
  const filtered = products.filter(p => (!category || p.categories.some(c => c.slug === category)) && storeText(p.name).toLowerCase().includes(query.trim().toLowerCase()))
  if (sort === 'name') filtered.sort((a, b) => storeText(a.name).localeCompare(storeText(b.name)))
  return <>
    <section className="store-catalogue" aria-labelledby="store-products-title">
      <div className="store-section-head"><h1 id="store-products-title">Resources</h1><span role="status">{filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}</span></div>
      <CatalogueFilterBar label="Store" category={category}
        categories={[{ value: '', label: 'All resources' }, ...cats.map(c => ({ value: c.slug, label: storeText(c.name) }))]}
        onCategoryChange={setCategory} activeCount={Number(!!category) + Number(sort !== 'featured')}
        onReset={() => { setCategory(''); setSort('featured') }}>
        <ChoicePicker label="Category" value={category} options={[{ value: '', label: 'All resources' }, ...cats.map(c => ({ value: c.slug, label: storeText(c.name) }))]} onChange={setCategory} />
        <ChoicePicker label="Relevance" value={sort} options={[{ value: 'featured', label: 'Featured' }, { value: 'name', label: 'Name: A–Z' }]} onChange={setSort} />
      </CatalogueFilterBar>
      <form className="catalogue-toolbar catalogue-toolbar-search" role="search" aria-label="Search resources" onSubmit={event => event.preventDefault()}>
        <div className="catalogue-search beam-search">
          <input type="search" aria-label="Search resources" placeholder="Search resources" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} />
          {query && <button type="button" className="catalogue-search-clear" aria-label="Clear resource search" onClick={() => setQuery('')}><X size={18} aria-hidden="true" /></button>}
          <button type="submit" className="catalogue-search-submit" aria-label="Search resources"><Search size={21} aria-hidden="true" /></button>
        </div>
      </form>
      {error ? <div role="alert"><p>{error}</p><button type="button" className="btn btn-primary" onClick={() => void router.invalidate()}>Retry store</button> <a className="btn" href="https://uebertangel.org/shop/">Visit the original store</a></div> : filtered.length ? <div className="store-product-grid">{filtered.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="store-empty"><Search size={32} /><h3>No matching resources</h3><p>Try another category or search.</p><button type="button" className="btn" onClick={() => { setCategory(''); setQuery('') }}>Clear filters</button></div>}
    </section>
  </>
}
