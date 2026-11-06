import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getVideo } from '../lib/api'
import { IconPlay, IconShare, IconCalendar, IconClock, RecommendationGroups } from '../components/Poster'
import { AboutPanel, DetailTabs, ClipsRail, WatchSection, BiblePanel, ContentNotes } from '../components/Detail'

export const Route = createFileRoute('/video/$id')({
  loader: async ({ params }) => await getVideo({ data: Number(params.id) }),
  component: VideoDetail,
})

function VideoDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('more')
  if (!data) return <div className="empty">Video not found.</div>
  const { video, similar, clips, bunnyLibraryId, viewerId } = data
  const tabs = [
    { key: 'more', label: 'Featured' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
    { key: 'about', label: 'About' },
  ]
  return (
    <div>
      <div className="detail-player">
        <WatchSection contentType="video" contentId={video.id} title={video.name} poster={video.thumbnail_url || video.poster_url} bunnyLibraryId={bunnyLibraryId} bunnyVideoId={video.bunny_video_url} trailerUrl={video.trailer_url} movieAccess={video.access} price={video.price} viewerId={viewerId} />
      </div>
      <div className="detail-info">
        <h1 className="detail-title">{video.name}</h1>
        {video.description && <p className="detail-desc">{String(video.description).replace(/<[^>]*>/g, '')}</p>}
        <div className="hero-meta">
          {video.release_date && <span><IconCalendar /> {String(video.release_date).slice(0, 4)}</span>}
          {video.duration && <span><IconClock /> {video.duration}</span>}
        </div>
        <div className="hero-actions">
          <button className="btn btn-play" onClick={() => { const lenis = (window as any).__lenis; if (lenis) lenis.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' }) }}><IconPlay /> Play</button>
          <button className="btn btn-dark btn-circle" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => null) }}><IconShare /></button>
        </div>
      </div>
      <ClipsRail clips={clips} />
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'more' && <RecommendationGroups recommendations={data.recommendations} fallback={similar} recentFallback={similar} />}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'notes' && <ContentNotes contentType="video" contentId={video.id} title={video.name} />}
      {tab === 'about' && <AboutPanel cast={data.cast ?? []} />}
    </div>
  )
}
