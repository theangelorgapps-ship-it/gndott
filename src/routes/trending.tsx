import { createFileRoute } from '@tanstack/react-router'
import { getTrending } from '../lib/api'
import { PosterCard } from '../components/Poster'

export const Route = createFileRoute('/trending')({
  loader: async () => await getTrending(),
  component: Trending,
})

function baseFor(item: any) {
  return item.type === 'teaching' ? '/teaching' : item.type === 'tvshow' ? '/tv-show' : '/movie'
}

function Trending() {
  const items = Route.useLoaderData() as any[]
  return (
    <div>
      <h1 className="page-title-center" style={{ margin: '34px 0 30px' }}>Trending Sermons in your Country</h1>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="grid" style={{ padding: 0 }}>
          {items.map((m) => (
            <PosterCard key={m.id} item={m} base={baseFor(m)} />
          ))}
        </div>
        {items.length === 0 && <div className="empty">Nothing trending right now — check back soon.</div>}
      </section>
    </div>
  )
}
