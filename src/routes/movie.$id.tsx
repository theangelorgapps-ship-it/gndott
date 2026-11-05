import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getMovie } from '../lib/api'
import {
  PosterCard, CircleCard, Rail,
  IconPlay, IconShare, IconCalendar, IconGlobe, IconClock, IconStar,
} from '../components/Poster'
import { DetailTabs, ClipsRail, WatchSection, WatchlistButton, BiblePanel, ContentNotes } from '../components/Detail'

export const Route = createFileRoute('/movie/$id')({
  loader: async ({ params }) => await getMovie({ data: Number(params.id) }),
  component: MovieDetail,
})

function MovieDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('cast')
  if (!data) return <div className="empty">Movie not found.</div>
  const { movie, genres, cast, similar, clips, bunnyLibraryId, inWatchlist, myPurchase, viewerId } = data
  const rating = movie.IMDb_rating ?? movie.imdb_rating
  const actors = cast.filter((c: any) => c.type !== 'director')
  const directors = cast.filter((c: any) => c.type === 'director')

  const tabs = [
    { key: 'cast', label: 'Casts & Directors' },
    { key: 'more', label: 'Featured' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div>
      <div className="detail-player">
        <WatchSection
          contentType="movie"
          contentId={movie.id}
          title={movie.name}
          poster={movie.thumbnail_url || movie.poster_url}
          bunnyLibraryId={bunnyLibraryId}
          bunnyVideoId={movie.bunny_video_url}
          trailerUrl={movie.trailer_url}
          movieAccess={movie.movie_access}
          price={movie.price}
          myPurchase={myPurchase}
          viewerId={viewerId}
        />
      </div>

      <div className="detail-info">
        {genres.length > 0 && (
          <div className="hero-genres">
            {genres.map((g: any) => <span key={g.id}>{g.name}</span>)}
          </div>
        )}
        <h1 className="detail-title">{movie.name}</h1>
        {movie.content_rating && <div className="crating">{movie.content_rating}</div>}
        {movie.description && <p className="detail-desc">{String(movie.description).replace(/<[^>]*>/g, '')}</p>}
        <div className="hero-meta">
          {movie.release_date && <span><IconCalendar /> {String(movie.release_date).slice(0, 4)}</span>}
          {movie.language && <span><IconGlobe /> {movie.language}</span>}
          {movie.duration && <span><IconClock /> {movie.duration}</span>}
          {rating && <span><IconStar /> {rating} (IMDb)</span>}
        </div>
        <div className="hero-actions">
          <button className="btn btn-play" onClick={() => { const l = (window as any).__lenis; if (l) l.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' }) }}><IconPlay /> Watch now</button>
          <WatchlistButton entertainmentId={movie.id} initialAdded={!!inWatchlist} viewerId={viewerId} />
          <button className="btn btn-dark btn-circle" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => null) }}><IconShare /></button>
        </div>
      </div>

      <ClipsRail clips={clips} />

      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'cast' && (
        <div>
          {actors.length > 0 && (
            <Rail title="Casts" seeAll="/cast">
              {actors.map((c: any) => <CircleCard key={c.id} name={c.name} image={c.file_url} to={`/cast/${c.id}`} />)}
            </Rail>
          )}
          {directors.length > 0 && (
            <Rail title="Directors" seeAll="/cast">
              {directors.map((c: any) => <CircleCard key={c.id} name={c.name} image={c.file_url} to={`/cast/${c.id}`} />)}
            </Rail>
          )}
          {actors.length === 0 && directors.length === 0 && <div className="empty">No cast information available.</div>}
        </div>
      )}

      {tab === 'more' && (
        <Rail title="Featured">
          {similar.map((m: any) => <PosterCard key={m.id} item={m} base="/movie" />)}
        </Rail>
      )}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'notes' && <ContentNotes contentType="movie" contentId={movie.id} title={movie.name} />}
    </div>
  )
}
