import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getVideo } from '../lib/api'
import {
  PosterCard, Rail,
  IconPlay, IconPlus, IconShare, IconCalendar, IconClock, IconStar,
} from '../components/Poster'
import { DetailTabs, ReviewCard, ClipsRail, WatchSection, ReviewForm } from '../components/Detail'

export const Route = createFileRoute('/video/$id')({
  loader: async ({ params }) => await getVideo({ data: Number(params.id) }),
  component: VideoDetail,
})

function VideoDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('more')
  if (!data) return <div className="empty">Video not found.</div>
  const { video, similar, reviews, clips, bunnyLibraryId, ads, myReview, viewerId } = data
  const tabs = [
    { key: 'more', label: 'More Like This' },
    { key: 'reviews', label: 'Reviews' },
  ]
  return (
    <div>
      <div className="detail-player">
        <WatchSection
          contentType="video"
          contentId={video.id}
          title={video.name}
          poster={video.thumbnail_url || video.poster_url}
          ads={ads}
          bunnyLibraryId={bunnyLibraryId}
          bunnyVideoId={video.bunny_video_url}
          trailerUrl={video.trailer_url}
          movieAccess={video.access}
          price={video.price}
          viewerId={viewerId}
        />
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
          <button className="btn btn-play" onClick={() => { const l = (window as any).__lenis; if (l) l.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' }) }}><IconPlay /> Play</button>
          <button className="btn btn-dark btn-circle" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => null) }}><IconShare /></button>
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
          <ReviewForm entertainmentId={video.id} myReview={myReview} viewerId={viewerId} />
        </section>
      )}
    </div>
  )
}
