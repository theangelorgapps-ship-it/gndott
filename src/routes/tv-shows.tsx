import { createFileRoute } from '@tanstack/react-router'
import { getTvShows } from '../lib/api'
import { PosterCard, HeroSlider } from '../components/Poster'

export const Route = createFileRoute('/tv-shows')({
  loader: async () => await getTvShows(),
  component: TvShows,
})

function TvShows() {
  const shows = Route.useLoaderData()
  const slides = shows.filter((m: any) => m.thumbnail_url || m.poster_url).slice(0, 5)
  return (
    <div>
      <HeroSlider slides={slides} baseFor={() => '/tv-show'} ctaLabel="Watch now" />
      <section className="section">
        <div className="section-head">
          <h2>TV Shows</h2>
        </div>
        <div className="grid" style={{ padding: 0 }}>
          {shows.map((m: any) => <PosterCard key={m.id} item={m} base="/tv-show" />)}
        </div>
        {shows.length === 0 && <div className="empty">No TV shows available yet.</div>}
      </section>
    </div>
  )
}
