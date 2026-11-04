import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getComingSoon } from '../lib/api'
import { img, IconGlobe } from '../components/Poster'

export const Route = createFileRoute('/coming-soon')({
  loader: async () => await getComingSoon(),
  component: ComingSoon,
})

type Kind = 'all' | 'movie' | 'tvshow' | 'video'

function daysToGo(date: string): number {
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  return Math.max(d, 0)
}

function ComingSoonCard({ item, base }: { item: any; base: string }) {
  const genres = item.genres ? String(item.genres).split(',').slice(0, 3) : []
  return (
    <div className="cs-card">
      <Link to={`${base}/${item.id}` as any} className="cs-thumb" style={{ backgroundImage: `url(${img(item.thumbnail_url || item.poster_url)})` }}>
        <span className="cs-ribbon">COMING SOON</span>
        {item.release_date && <span className="cs-days">{daysToGo(item.release_date)} days to go</span>}
      </Link>
      <div className="cs-body">
        {item.release_date && <div className="cs-date">{item.release_date}</div>}
        <Link to={`${base}/${item.id}` as any} className="cs-name">{item.name}</Link>
        {genres.length > 0 && (
          <div className="chips" style={{ marginBottom: 10 }}>
            {genres.map((g: string) => <span key={g} className="chip">{g.trim()}</span>)}
          </div>
        )}
        {item.description && <p className="cs-desc">{item.description}</p>}
        {item.language && <div className="cs-lang"><IconGlobe size={13} /> {item.language}</div>}
        <div className="cs-actions">
          {item.trailer_url ? (
            <a href={item.trailer_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-xs" style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
              Watch Trailer
            </a>
          ) : (
            <Link to={`${base}/${item.id}` as any} className="btn btn-primary" style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
              Watch Trailer
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function ComingSoon() {
  const { entertainment, videos } = Route.useLoaderData() as any
  const [kind, setKind] = useState<Kind>('all')
  const items: { item: any; base: string; kind: Kind }[] = [
    ...entertainment.map((m: any) => ({ item: m, base: m.type === 'tvshow' ? '/tv-show' : '/movie', kind: m.type as Kind })),
    ...videos.map((v: any) => ({ item: v, base: '/video', kind: 'video' as Kind })),
  ]
  const shown = kind === 'all' ? items : items.filter((i) => i.kind === kind)

  return (
    <div>
      <h1 className="page-title-center" style={{ color: 'var(--primary)', marginTop: 30 }}>Coming Soon</h1>
      <p className="search-sub" style={{ textAlign: 'center' }}>Get ready for the most anticipated movies and shows launching soon. Be the first to watch premium content.</p>
      <div className="filter-pills">
        {([['all', 'All'], ['movie', 'Movie'], ['tvshow', 'TV Show'], ['video', 'Video']] as [Kind, string][]).map(([k, label]) => (
          <button key={k} className={`filter-pill${kind === k ? ' active' : ''}`} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cs-grid">
          {shown.map(({ item, base, kind }) => <ComingSoonCard key={`${kind}-${item.id}`} item={item} base={base} />)}
        </div>
        {shown.length === 0 && <div className="empty">Nothing coming soon in this category.</div>}
      </section>
    </div>
  )
}
