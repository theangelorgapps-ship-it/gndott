import { contentIdFromPath } from '../lib/contentRoutes'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getVideo } from '../lib/api'
import { RecommendationGroups } from '../components/Poster'
import { AboutPanel, DetailTabs, ClipsRail, BiblePanel, ContentNotes } from '../components/Detail'
import { TitleDetail } from '../components/TitleDetail'

export const Route = createFileRoute('/video/$id')({
  loader: async ({ params }) => await getVideo({ data: contentIdFromPath(params.id) }),
  component: VideoDetail,
})

function VideoDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('more')
  if (!data) return <div className="empty">Video not found.</div>
  const { video, similar, clips = [], bunnyLibraryId, viewerId } = data
  const tabs = [
    { key: 'more', label: 'Featured' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
    { key: 'about', label: 'About' },
  ]
  return (
    <TitleDetail
      key={video.id}
      title={video.name}
      poster={video.poster_url}
      landscape={video.thumbnail_url}
      description={video.description}
      kind="Video"
      metadata={[video.release_date && String(video.release_date).slice(0, 4), video.duration]}
      playback={{ contentType: 'video', contentId: video.id, title: video.name, description: video.description, portrait: video.poster_url, metadata: [video.release_date && String(video.release_date).slice(0, 4), video.duration], directVideoUrl: video.video_url_input, bunnyTrailerId: video.bunny_trailer_url, poster: video.thumbnail_url || video.poster_url, bunnyLibraryId, bunnyVideoId: video.bunny_video_url, trailerUrl: video.trailer_url, movieAccess: video.access, price: video.price, viewerId }}
    >
      <ClipsRail clips={clips} />
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'more' && <RecommendationGroups recommendations={data.recommendations} fallback={similar} recentFallback={similar} />}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'notes' && <ContentNotes contentType="video" contentId={video.id} title={video.name} />}
      {tab === 'about' && <AboutPanel cast={data.cast ?? []} />}
    </TitleDetail>
  )
}
