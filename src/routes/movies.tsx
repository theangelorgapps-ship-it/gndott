import { createFileRoute } from '@tanstack/react-router'
import { getMovies } from '../lib/api'
import { PosterCard, HeroSlider } from '../components/Poster'

export const Route = createFileRoute('/movies')({
  loader: async () => await getMovies(),
  component: Movies,
})

function Movies() {
  const movies = Route.useLoaderData()
  const slides = movies.filter((m: any) => m.thumbnail_url || m.poster_url).slice(0, 5)
  return (
    <div>
      <HeroSlider slides={slides} baseFor={() => '/movie'} ctaLabel="Watch now" />
      <section className="section">
        <div className="section-head">
          <h2>Sermons</h2>
        </div>
        <div className="grid" style={{ padding: 0 }}>
          {movies.map((m: any) => <PosterCard key={m.id} item={m} base="/movie" />)}
        </div>
        {movies.length === 0 && <div className="empty">No sermons available yet.</div>}
      </section>
    </div>
  )
}
