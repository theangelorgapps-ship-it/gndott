import { MobileLiquidGlass } from '../components/ui/liquid-glass'
import { createFileRoute, Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Home, X } from 'lucide-react'
import { searchContent, getGenresPage, getGenreContent, getTrending } from '../lib/api'
import { PosterCard, IconSearch, img } from '../components/Poster'

const CATEGORIES = [
  { key: 'movies', label: 'Sermons', base: '/movie', to: '/movies' },
  { key: 'tvshows', label: 'Shows', base: '/tv-show', to: '/tv-shows' },
  { key: 'teachings', label: 'Teachings', base: '/teaching', to: '/teachings' },
  { key: 'videos', label: 'Videos', base: '/video', to: '/videos' },
  { key: 'channels', label: 'Live TV', base: '/channel', to: '/live-tv' },
] as const

type ResultKind = typeof CATEGORIES[number]['key']
type SearchResults = Record<ResultKind, any[]>

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q.slice(0, 200) : '',
    type: CATEGORIES.some((category) => category.key === search.type) ? String(search.type) : 'all',
    genre: Number.isInteger(Number(search.genre)) && Number(search.genre) > 0 ? Number(search.genre) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [matches, genres, popular] = await Promise.all([
      deps.genre ? getGenreContent({ data: deps.genre }) : searchContent({ data: deps.q.trim() }),
      getGenresPage(),
      !deps.q && !deps.genre ? getTrending() : Promise.resolve([]),
    ])
    if (deps.genre && 'items' in matches) {
      const results: SearchResults = { movies: [], tvshows: [], teachings: [], videos: [], channels: [] }
      for (const item of matches.items) {
        if (deps.q && !item.name.toLowerCase().includes(deps.q.toLowerCase())) continue
        const key: ResultKind = item.type === 'tvshow' ? 'tvshows' : item.type === 'teaching' ? 'teachings' : 'movies'
        results[key].push(item)
      }
      return { results, genres, popular, genreName: (matches.genre as any)?.name ?? 'Genre' }
    }
    return { results: matches as SearchResults, genres, popular, genreName: '' }
  },
  component: Search,
})

function Search() {
  const { q, type, genre } = Route.useSearch()
  const { results, genres, popular, genreName } = Route.useLoaderData()
  const navigate = useNavigate()
  const loading = useRouterState({ select: (state) => state.isLoading })
  const [term, setTerm] = useState(q)
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestedQueries = useRef(new Set<string>())
  const searching = loading || term.trim() !== q.trim()
  const browsing = !q && !genre && type === 'all'
  const visibleCategories = CATEGORIES.filter((category) => type === 'all' || category.key === type)
  const total = visibleCategories.reduce((sum, category) => sum + results[category.key].length, 0)

  // The URL is authoritative, including navigation with the browser back/forward buttons.
  useEffect(() => {
    // An older response must not erase text entered while its loader was running.
    if (requestedQueries.current.has(q)) requestedQueries.current.delete(q)
    else setTerm(q)
  }, [q])
  useEffect(() => {
    const restoreHistory = () => {
      requestedQueries.current.clear()
      setTerm(new URLSearchParams(window.location.search).get('q') ?? '')
    }
    window.addEventListener('popstate', restoreHistory)
    return () => window.removeEventListener('popstate', restoreHistory)
  }, [])
  useEffect(() => {
    if (composing || term.trim() === q.trim()) return
    const timer = setTimeout(() => {
      requestedQueries.current.add(term.trim())
      void navigate({ to: '/search', search: { q: term.trim(), type, genre }, replace: true, resetScroll: false })
    }, 280)
    return () => clearTimeout(timer)
  }, [term, q, type, genre, composing, navigate])

  function submit() {
    if (composing) return
    requestedQueries.current.add(term.trim())
    void navigate({ to: '/search', search: { q: term.trim(), type, genre }, resetScroll: false })
    inputRef.current?.blur()
  }

  return (
    <div className="tv-search-page">
      <header className="tv-search-heading"><h1>Search</h1>{genreName && <p>{genreName}</p>}</header>
      <div className="tv-search-entry">
        <Link to="/" className="search-home" aria-label="Home"><Home size={23} /></Link>
        <MobileLiquidGlass asChild><form className="tv-search-field" role="search" onSubmit={(event) => { event.preventDefault(); submit() }}>
          <IconSearch size={22} />
          <input ref={inputRef} type="search" name="q" value={term} aria-label="Search sermons, shows, and more" placeholder="Sermons, Shows, and More" maxLength={200}
            autoComplete="off" enterKeyHint="search" onChange={(event) => setTerm(event.target.value)}
            onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
            onKeyDown={(event) => { if (event.key === 'Escape') { setTerm(''); inputRef.current?.blur(); void navigate({ to: '/search', search: { q: '', type: 'all', genre: undefined }, replace: true }) } }} />
          {term && <button type="button" aria-label="Clear search" onClick={() => { setTerm(''); inputRef.current?.focus() }}><X size={18} /></button>}
          <button type="submit" className="search-submit" aria-label="Submit search"><IconSearch size={20} /></button>
        </form></MobileLiquidGlass>
      </div>

      {!browsing && <nav className="tv-search-filters" aria-label="Search result types">
        <Link to="/search" search={{ q, type: 'all', genre }} replace resetScroll={false} className={type === 'all' ? 'active' : ''} aria-current={type === 'all' ? 'true' : undefined}>All</Link>
        {CATEGORIES.map((category) => <Link key={category.key} to="/search" search={{ q, type: category.key, genre }} replace resetScroll={false} className={type === category.key ? 'active' : ''} aria-current={type === category.key ? 'true' : undefined}>{category.label}</Link>)}
        {genre && <Link to="/search" search={{ q, type, genre: undefined }} replace className="search-remove-genre">{genreName}<X size={14} /></Link>}
      </nav>}

      {browsing ? <>
        <section className="tv-search-categories" aria-label="Browse categories">
          {CATEGORIES.map((category) => {
            const cover = results[category.key].find((item) => item.poster_url || item.thumbnail_url)
            return <Link key={category.key} to={category.to} className={`search-category search-category-${category.key}`}>
              {cover && <img src={img(cover.poster_url || cover.thumbnail_url)} alt="" loading="lazy" decoding="async" />}
              <span>{category.label}</span>
            </Link>
          })}
          <Link to="/trending" className="search-category search-category-trending">
            {popular[0] && <img src={img(popular[0].poster_url || popular[0].thumbnail_url)} alt="" loading="lazy" decoding="async" />}
            <span>Trending</span>
          </Link>
        </section>
        {genres.length > 0 && <section className="tv-search-genres"><h2>Browse by genre</h2><div>{genres.map((item: any) => <Link key={item.id} to="/search" search={{ q: '', type: 'all', genre: Number(item.id) }}>{item.name}</Link>)}</div></section>}
        {popular.length > 0 && <section className="tv-popular-search"><h2>Popular searches</h2>{popular.slice(0, 5).map((item) => <button type="button" key={`${item.type}-${item.id}`} onClick={() => { setTerm(item.name); requestedQueries.current.add(item.name); void navigate({ to: '/search', search: { q: item.name, type: 'all', genre: undefined } }) }}><IconSearch size={17} />{item.name}</button>)}</section>}
      </> : <div className={`tv-search-results${searching ? ' is-searching' : ''}`} aria-busy={searching}>
        <p className="search-result-status" role="status">{searching ? 'Searching…' : `${total} ${total === 1 ? 'result' : 'results'}${q ? ` for “${q}”` : ''}`}</p>
        {!total && !searching && <div className="tv-search-empty"><h2>No results found</h2><p>Try another title or choose a different category.</p><Link to="/search" search={{ q: '', type: 'all', genre: undefined }}>Browse all categories</Link></div>}
        {visibleCategories.map((category) => results[category.key].length > 0 && <section className="section" key={category.key}>
          <div className="section-head"><h2>{category.label}</h2></div>
          <div className="grid">{results[category.key].map((item: any) => <PosterCard key={item.id} item={item} base={category.base} />)}</div>
        </section>)}
      </div>}
    </div>
  )
}
