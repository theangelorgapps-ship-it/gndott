import { img } from '@/components/Poster'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ArrowRight, Search, ShoppingBag, X } from 'lucide-react'
import { StoreLoading } from '../components/StorePurchaseBar'
import { getStoreProducts } from '../lib/store'
import { productPath, storeMoney, storeText } from '../lib/storeTypes'
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
  const results = useRef<HTMLElement>(null)
  const cats = [...new Map(products.flatMap(p => p.categories).map(c => [c.slug, c])).values()]
  const filtered = products.filter(p => (!category || p.categories.some(c => c.slug === category)) && storeText(p.name).toLowerCase().includes(query.trim().toLowerCase()))
  if (sort === 'name') filtered.sort((a, b) => storeText(a.name).localeCompare(storeText(b.name)))
  const featured = products.find(p => p.is_in_stock && p.images.length)
  const chooseCategory = (slug: string) => { setCategory(slug); results.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }
  return <>
    <header className="store-hero"><div><h1>Store.</h1><p>Inspiration for your everyday.</p></div><span className="store-hero-symbol" aria-hidden="true"><ShoppingBag /></span></header>
    {!error && <>
      <section className="store-collections" aria-labelledby="store-collections-title"><h2 id="store-collections-title">Find your next good thing.</h2>
        <div className="store-category-rail">{cats.map(c => {
          const cover = products.find(p => p.categories.some(category => category.slug === c.slug) && p.images.length)
          return <button key={c.slug} type="button" className="store-category-tile" aria-pressed={category === c.slug} onClick={() => chooseCategory(c.slug)}>
            {cover && <img src={img(cover.images[0].src)} alt="" loading="lazy" />}<span>{storeText(c.name)}</span>
          </button>
        })}</div>
      </section>
      {featured && !query && !category && <section className="store-discover" aria-labelledby="store-discover-title"><h2 id="store-discover-title">A little inspiration. A lasting impact.</h2>
        <Link to={productPath(featured) as any} className="store-featured"><div><span className="store-eyebrow">EXPLORE THE COLLECTION</span><h3>{storeText(featured.name)}</h3><p>{storeText(featured.short_description).slice(0, 180) || 'Discover your next read, a thoughtful gift, or something to make your day.'}</p><strong>{featured.type === 'variable' ? 'From ' : ''}{storeMoney(featured.prices.price, featured.prices.currency_code, featured.prices.currency_minor_unit)}</strong><span className="store-featured-cta">Explore product <ArrowRight size={18} /></span></div><img src={img(featured.images[0].src)} alt={featured.images[0].alt || storeText(featured.name)} loading="lazy" /></Link>
      </section>}
    </>}
    <section ref={results} className="store-catalogue" aria-labelledby="store-products-title">
      <div className="store-section-head"><h2 id="store-products-title">{storeText(cats.find(c => c.slug === category)?.name) || 'All products'}</h2><span role="status">{filtered.length} products</span></div>
      <CatalogueFilterBar label="Store" category={category}
        categories={[{ value: '', label: 'All products' }, ...cats.map(c => ({ value: c.slug, label: storeText(c.name) }))]}
        onCategoryChange={setCategory} activeCount={Number(!!category) + Number(sort !== 'featured')}
        onReset={() => { setCategory(''); setSort('featured') }}>
        <ChoicePicker label="Category" value={category} options={[{ value: '', label: 'All products' }, ...cats.map(c => ({ value: c.slug, label: storeText(c.name) }))]} onChange={setCategory} />
        <ChoicePicker label="Relevance" value={sort} options={[{ value: 'featured', label: 'Featured' }, { value: 'name', label: 'Name: A–Z' }]} onChange={setSort} />
      </CatalogueFilterBar>
      <form className="catalogue-toolbar catalogue-toolbar-search" role="search" aria-label="Search the store" onSubmit={event => event.preventDefault()}>
        <div className="catalogue-search beam-search">
          <input type="search" aria-label="Search products" placeholder="Search the store" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} />
          {query && <button type="button" className="catalogue-search-clear" aria-label="Clear product search" onClick={() => setQuery('')}><X size={18} aria-hidden="true" /></button>}
          <button type="submit" className="catalogue-search-submit" aria-label="Search products"><Search size={21} aria-hidden="true" /></button>
        </div>
      </form>
      {error ? <div role="alert"><p>{error}</p><button type="button" className="btn btn-primary" onClick={() => void router.invalidate()}>Retry store</button> <a className="btn" href="https://uebertangel.org/shop/">Visit the original store</a></div> : filtered.length ? <div className="store-product-grid">{filtered.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="store-empty"><Search size={32} /><h3>No matching products</h3><p>Try another category or search.</p><button type="button" className="btn" onClick={() => { setCategory(''); setQuery('') }}>Clear filters</button></div>}
    </section>
  </>
}
