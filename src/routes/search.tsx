import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { searchContent, getGenres, getTrending } from '../lib/api'
import { PosterCard, IconSearch } from '../components/Poster'

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => ({
    results: deps.q ? await searchContent({ data: deps.q }) : null,
    genres: await getGenres(),
    popular: (await getTrending()).slice(0, 5),
  }),
  component: Search,
})

const CATEGORIES = [
  { label: 'Movies', q: 'movie' },
  { label: 'TV Shows', q: 'show' },
  { label: 'Videos', q: 'video' },
  { label: 'Seasons', q: 'season' },
  { label: 'Episodes', q: 'episode' },
  { label: 'Live TV', q: 'live' },
  { label: 'Actors', q: 'actor' },
  { label: 'Directors', q: 'director' },
]

function Search() {
  const q = Route.useSearch().q
  const { results, genres, popular } = Route.useLoaderData() as any
  const navigate = useNavigate()
  const [term, setTerm] = useState(q)

  function go(t: string) {
    setTerm(t)
    navigate({ to: '/search', search: { q: t } as any })
  }

  const total = results
    ? results.movies.length + results.tvshows.length + results.videos.length + results.channels.length
    : 0

  return (
    <div>
      <div className="search-hero">
        <h1 className="page-title-center">Discover Your Next Favorite</h1>
        <p className="search-sub">Search through thousands of movies, TV shows, and documentaries</p>
        <form className="search-bar" onSubmit={(e) => { e.preventDefault(); go(term) }}>
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search..." autoFocus />
          <button type="submit" aria-label="Search"><IconSearch size={20} /></button>
        </form>
      </div>

      <div className="search-active">Active filters:</div>
      <div className="search-cols">
        <div>
          <h3>Categories</h3>
          <div className="spills">
            {CATEGORIES.map((c) => <button key={c.label} className="spill" onClick={() => go(c.q)}>{c.label}</button>)}
          </div>
        </div>
        <div>
          <h3>Genres</h3>
          <div className="spills">
            {genres.slice(0, 8).map((g: any) => <button key={g.id} className="spill" onClick={() => go(g.name)}>{g.name}</button>)}
          </div>
        </div>
        <div>
          <h3>Popular Search</h3>
          {popular.map((p: any) => (
            <button key={p.id} className="pop-item" onClick={() => go(p.name)}>
              <IconSearch size={14} /> {p.name}
            </button>
          ))}
        </div>
      </div>

      {results && (
        <div style={{ paddingBottom: 30 }}>
          {total === 0 && (
            <div className="empty">
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Sorry, Couldn't Find Your Search!</div>
              <div>Try something new</div>
            </div>
          )}
          {results.movies.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>Movies</h2></div>
              <div className="grid" style={{ padding: 0 }}>{results.movies.map((m: any) => <PosterCard key={m.id} item={m} base="/movie" />)}</div>
            </section>
          )}
          {results.tvshows.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>TV Shows</h2></div>
              <div className="grid" style={{ padding: 0 }}>{results.tvshows.map((m: any) => <PosterCard key={m.id} item={m} base="/tv-show" />)}</div>
            </section>
          )}
          {results.videos.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>Videos</h2></div>
              <div className="grid" style={{ padding: 0 }}>{results.videos.map((m: any) => <PosterCard key={m.id} item={m} base="/video" />)}</div>
            </section>
          )}
          {results.channels.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>Live Channels</h2></div>
              <div className="grid" style={{ padding: 0 }}>{results.channels.map((m: any) => <PosterCard key={m.id} item={m} base="/channel" />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
