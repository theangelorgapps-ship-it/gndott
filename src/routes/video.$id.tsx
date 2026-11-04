import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getVideo } from '../lib/api'
import {
  PosterCard, Rail,
  IconPlay, IconPlus, IconShare, IconCalendar, IconClock, IconStar,
} from '../components/Poster'
import { TrailerPlayer, DetailTabs, ReviewCard, ClipsRail } from '../components/Detail'

export const Route = createFileRoute('/video/$id')({
  loader: async ({ params }) => await getVideo({ data: Number(params.id) }),
  component: VideoDetail,
})

function VideoDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('more')
  if (!data) return <div className="empty">Video not found.</div>
  const { video, similar, reviews, clips } = data
  const tabs = [
    { key: 'more', label: 'More Like This' },
    { key: 'reviews', label: 'Reviews' },
  ]
  return (
    <div>
      <div className="detail-player">
        <TrailerPlayer url={video.trailer_url} poster={video.thumbnail_url || video.poster_url} title={video.name} />
      </div>
      <div className="detail-info">
        <h1 className="detail-title">{video.name}</h1>
        {video.description && <p className="detail-desc">{String(video.description).replace(/<[^>]*>/g, '')}</p>}
        <div className="hero-meta">
          {video.release_date && <span><IconCalendar /> {String(video.release_date).slice(0, 4)}</span>}
          {video.duration && <span><IconClock /> {video.duration}</span>}
          {video.IMDb_rating && <span><IconStar /> {video.IMDb_rating} (IMDb)</span>}
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary"><IconPlay /> Play</button>
          <button className="btn btn-dark btn-circle" aria-label="Add to watchlist"><IconPlus /></button>
          <button className="btn btn-dark btn-circle" aria-label="Share"><IconShare /></button>
        </div>
      </div>

      <ClipsRail clips={clips} />

      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'more' && (
        <Rail title="More Like This">
          {similar.map((m: any) => <PosterCard key={m.id} item={m} base="/video" />)}
        </Rail>
      )}
      {tab === 'reviews' && (
        <section className="section">
          <div className="section-head"><h2>{reviews.length} Reviews for {video.name}</h2></div>
          <div className="review-list">
            {reviews.map((r: any) => <ReviewCard key={r.id} review={r} />)}
          </div>
          {reviews.length === 0 && <div className="empty">No reviews yet.</div>}
        </section>
      )}
    </div>
  )
}
