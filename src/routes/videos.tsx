import { createFileRoute } from '@tanstack/react-router'
import { getVideos } from '../lib/api'
import { PosterCard, HeroSlider } from '../components/Poster'

export const Route = createFileRoute('/videos')({
  loader: async () => await getVideos(),
  component: Videos,
})

function Videos() {
  const videos = Route.useLoaderData()
  const slides = videos.filter((m: any) => m.thumbnail_url || m.poster_url).slice(0, 5)
  return (
    <div>
      <HeroSlider slides={slides} baseFor={() => '/video'} ctaLabel="Watch now" />
      <section className="section">
        <div className="section-head">
          <h2>Videos</h2>
        </div>
        <div className="grid" style={{ padding: 0 }}>
          {videos.map((m: any) => <PosterCard key={m.id} item={m} base="/video" />)}
        </div>
        {videos.length === 0 && <div className="empty">No videos available yet.</div>}
      </section>
    </div>
  )
}
