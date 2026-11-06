import { createFileRoute } from '@tanstack/react-router'
import { getTeachings } from '../lib/api'
import { PosterCard, HeroSlider } from '../components/Poster'

export const Route = createFileRoute('/teachings')({
  loader: async () => await getTeachings(),
  component: Teachings,
})

function Teachings() {
  const teachings = Route.useLoaderData()
  const slides = teachings.filter((m: any) => m.thumbnail_url || m.poster_url).slice(0, 5)
  return (
    <div>
      <HeroSlider slides={slides} baseFor={() => '/teaching'} ctaLabel="Watch now" />
      <section className="section">
        <div className="section-head">
          <h2>Teachings</h2>
        </div>
        <div className="grid" style={{ padding: 0 }}>
          {teachings.map((m: any) => <PosterCard key={m.id} item={m} base="/teaching" />)}
        </div>
        {teachings.length === 0 && <div className="empty">No teachings available yet.</div>}
      </section>
    </div>
  )
}
