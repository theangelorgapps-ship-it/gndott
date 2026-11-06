import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getMovie } from '../lib/api'
import { IconShare, IconCalendar, IconClock, RecommendationGroups } from '../components/Poster'
import { AboutPanel, DetailTabs, ClipsRail, WatchSection, WatchlistButton, BiblePanel, ContentNotes } from '../components/Detail'

export const Route = createFileRoute('/movie/$id')({
  loader: async ({ params }) => await getMovie({ data: Number(params.id) }),
  component: MovieDetail,
})

function MovieDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('more')
  if (!data) return <div className="empty">Movie not found.</div>
  const { movie, genres, cast, similar, clips, bunnyLibraryId, inWatchlist, myPurchase, viewerId } = data
  const tabs = [
    { key: 'more', label: 'Featured' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
    { key: 'about', label: 'About' },
  ]
  return (
    <div>
      <div className="detail-player">
        <WatchSection contentType="movie" contentId={movie.id} title={movie.name} poster={movie.thumbnail_url || movie.poster_url} bunnyLibraryId={bunnyLibraryId} bunnyVideoId={movie.bunny_video_url} trailerUrl={movie.trailer_url} movieAccess={movie.movie_access} price={movie.price} myPurchase={myPurchase} viewerId={viewerId} />
      </div>
      <div className="detail-info">
        {genres.length > 0 && <div className="hero-genres">{genres.map((genre: any) => <span key={genre.id}>{genre.name}</span>)}</div>}
        <h1 className="detail-title">{movie.name}</h1>
        {movie.description && <p className="detail-desc">{String(movie.description).replace(/<[^>]*>/g, '')}</p>}
        <div className="hero-meta">
          {movie.release_date && <span><IconCalendar /> {String(movie.release_date).slice(0, 4)}</span>}
          {movie.duration && <span><IconClock /> {movie.duration}</span>}
        </div>
        <div className="hero-actions">
          <WatchlistButton entertainmentId={movie.id} initialAdded={!!inWatchlist} viewerId={viewerId} />
          <button className="btn btn-dark btn-circle" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => null) }}><IconShare /></button>
        </div>
      </div>
      <ClipsRail clips={clips} />
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'more' && <RecommendationGroups recommendations={data.recommendations} fallback={similar} recentFallback={similar} />}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'notes' && <ContentNotes contentType="movie" contentId={movie.id} title={movie.name} />}
      {tab === 'about' && <AboutPanel cast={cast} />}
    </div>
  )
}
