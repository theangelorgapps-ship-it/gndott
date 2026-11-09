import { contentIdFromPath } from '../lib/contentRoutes'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getMovie } from '../lib/api'
import { RecommendationGroups } from '../components/Poster'
import { AboutPanel, DetailTabs, ClipsRail, BiblePanel, ContentNotes } from '../components/Detail'
import { TitleDetail } from '../components/TitleDetail'

export const Route = createFileRoute('/sermon/$id')({
  loader: async ({ params }) => await getMovie({ data: contentIdFromPath(params.id) }),
  component: SermonDetail,
})

function SermonDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('more')
  if (!data) return <div className="empty">Sermon not found.</div>
  const { movie, similar, clips = [], bunnyLibraryId, viewerId, genres = [], cast = [], inWatchlist, myPurchase } = data
  const tabs = [
    { key: 'more', label: 'Featured' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
    { key: 'about', label: 'About' },
  ]
  return (
    <TitleDetail
      key={movie.id}
      title={movie.name}
      poster={movie.poster_url}
      landscape={movie.thumbnail_url}
      description={movie.description}
      kind="Sermon"
      genres={genres}
      watchlist={{ entertainmentId: movie.id, initialAdded: !!inWatchlist, viewerId }}
      metadata={[movie.release_date && String(movie.release_date).slice(0, 4), movie.duration]}
      playback={{ contentType: 'movie', contentId: movie.id, title: movie.name, description: movie.description, portrait: movie.poster_url, metadata: [movie.release_date && String(movie.release_date).slice(0, 4), movie.duration], directVideoUrl: movie.video_url_input, bunnyTrailerId: movie.bunny_trailer_url, poster: movie.thumbnail_url || movie.poster_url, bunnyLibraryId, bunnyVideoId: movie.bunny_video_url, trailerUrl: movie.trailer_url, movieAccess: movie.movie_access, price: movie.price, myPurchase, viewerId, hasSubscriptionAccess: movie.hasSubscriptionAccess, recommendations: data.recommendations?.forYou ?? similar }}
    >
      <ClipsRail clips={clips} />
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'more' && <RecommendationGroups recommendations={data.recommendations} fallback={similar} recentFallback={similar} />}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'notes' && <ContentNotes contentType="movie" contentId={movie.id} title={movie.name} />}
      {tab === 'about' && <AboutPanel cast={cast} locations={data.locations ?? []} />}
    </TitleDetail>
  )
}
