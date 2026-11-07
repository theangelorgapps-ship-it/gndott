import { createFileRoute, Link } from '@tanstack/react-router'
import { getMovies } from '../lib/api'
import { PosterCard, HeroSlider } from '../components/Poster'
import { LiquidGlassLayers } from '../components/ui/liquid-glass'
import { catalogueCategories, filterCatalogue, parseCategory } from '../lib/catalogueFilters'

export const Route = createFileRoute('/movies')({
  validateSearch: (search: Record<string, unknown>): { category?: number } => ({ category: parseCategory(search.category) }),
  loader: async () => await getMovies(),
  component: Movies,
})

function Movies() {
  const movies = Route.useLoaderData()
  const { category } = Route.useSearch()
  const categories = catalogueCategories(movies)
  const filtered = filterCatalogue(movies, category)
  const slides = movies.filter((m: any) => m.thumbnail_url || m.poster_url).slice(0, 5)
  return (
    <div>
      <HeroSlider slides={slides} baseFor={() => '/movie'} ctaLabel="Watch now" />
      <section className="section">
        <div className="section-head">
          <h2>Sermons</h2>
        </div>
        <nav className="catalogue-filters" aria-label="Sermon categories" data-lenis-prevent>
          <Link to="/movies" activeOptions={{ exact: true, includeSearch: true, explicitUndefined: true }} search={{ category: undefined }} resetScroll={false} className={`catalogue-filter liquid-glass${!category ? ' active' : ''}`} aria-current={!category ? 'page' : undefined}><LiquidGlassLayers />All sermons</Link>
          {categories.map((item) => <Link key={item.id} to="/movies" activeOptions={{ exact: true, includeSearch: true, explicitUndefined: true }} search={{ category: item.id }} resetScroll={false} className={`catalogue-filter liquid-glass${category === item.id ? ' active' : ''}`} aria-current={category === item.id ? 'page' : undefined}><LiquidGlassLayers />{item.name}</Link>)}
        </nav>
        <p className="catalogue-result-count" role="status">{filtered.length} {filtered.length === 1 ? 'sermon' : 'sermons'}{category ? ` · ${categories.find(item => item.id === category)?.name || 'Selected category'}` : ''}</p>
        <div className="grid" style={{ padding: 0 }}>
          {filtered.map((m: any) => <PosterCard key={m.id} item={m} base="/movie" />)}
        </div>
        {filtered.length === 0 && <div className="empty"><p>{category ? 'No sermons in this category yet.' : 'No sermons available yet.'}</p>{category && <Link to="/movies" activeOptions={{ exact: true, includeSearch: true, explicitUndefined: true }} search={{ category: undefined }} resetScroll={false}>Show all sermons</Link>}</div>}
      </section>
    </div>
  )
}
