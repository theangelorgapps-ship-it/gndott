import { contentPath } from '@/lib/contentRoutes'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getPayPerView } from '../lib/api'
import { img } from '../components/Poster'

export const Route = createFileRoute('/pay-per-view')({
  loader: async () => await getPayPerView(),
  component: PayPerView,
})

type Kind = 'all' | 'movie' | 'video' | 'episode'

const KIND_LABELS: Record<Kind, string> = {
  all: 'All',
  movie: 'Sermon',
  video: 'Video',
  episode: 'Episode',
}

function RentCard({ item, to }: { item: any; to: string }) {
  return (
    <Link to={to as any} className="p-card">
      <span className="p-poster" style={{ backgroundImage: `url(${img(item.poster_url)})` }}>
        {item.price != null && <span className="price-chip">$ {Number(item.price).toFixed(1)}</span>}
        <span className="rent-badge">RENT</span>
      </span>
      <span className="p-name">{item.name}</span>
    </Link>
  )
}

function PayPerView() {
  const { movies, videos, episodes } = Route.useLoaderData() as any
  const [kind, setKind] = useState<Kind>('all')
  const items: { item: any; to: string; kind: Exclude<Kind, 'all'> }[] = [
    ...movies.map((m: any) => ({ item: m, to: contentPath(m,'/movie'), kind: 'movie' as const })),
    ...videos.map((v: any) => ({ item: v, to: contentPath(v,'/video'), kind: 'video' as const })),
    ...episodes.map((e: any) => ({ item: e, to: `${contentPath({id:e.entertainment_id,name:e.show_name,slug:e.show_slug},'/tv-show')}?episode=${e.id}`, kind: 'episode' as const })),
  ]
  const shown = kind === 'all' ? items : items.filter((i) => i.kind === kind)

  return (
    <div>
      <h1 className="page-title-center" style={{ marginTop: 30 }}>Pay Per View</h1>
      <div className="filter-pills">
        {(['all', 'movie', 'video', 'episode'] as Kind[]).map((k) => (
          <button key={k} className={`filter-pill${kind === k ? ' active' : ''}`} onClick={() => setKind(k)}>
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="grid" style={{ padding: 0 }}>
          {shown.map(({ item, to, kind }) => <RentCard key={`${kind}-${item.id}`} item={item} to={to} />)}
        </div>
        {shown.length === 0 && <div className="empty">No rentable content in this category.</div>}
      </section>
    </div>
  )
}
