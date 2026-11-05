import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getTvShow } from '../lib/api'
import {
  PosterCard, CircleCard, Rail, img,
  IconPlay, IconShare, IconCalendar, IconGlobe, IconStar,
} from '../components/Poster'
import { DetailTabs, ClipsRail, WatchSection, WatchlistButton, BiblePanel, ContentNotes } from '../components/Detail'

export const Route = createFileRoute('/tv-show/$id')({
  loader: async ({ params }) => await getTvShow({ data: Number(params.id) }),
  component: TvShowDetail,
})

function TvShowDetail() {
  const data = Route.useLoaderData() as any
  const [tab, setTab] = useState('episodes')
  const [seasonIdx, setSeasonIdx] = useState(0)
  if (!data) return <div className="empty">Show not found.</div>
  const { show, seasons, episodes, genres, cast, clips, similar, bunnyLibraryId, inWatchlist, viewerId } = data
  const rating = show.IMDb_rating ?? show.imdb_rating
  const actors = cast.filter((c: any) => c.type !== 'director')
  const directors = cast.filter((c: any) => c.type === 'director')
  const season = seasons[Math.min(seasonIdx, Math.max(seasons.length - 1, 0))]
  const seasonEps = season ? episodes.filter((e: any) => e.season_id === season.id) : episodes

  const tabs = [
    ...(seasons.length ? [{ key: 'episodes', label: 'Episodes' }] : []),
    { key: 'cast', label: 'Casts & Directors' },
    { key: 'more', label: 'Featured' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
  ]
  const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? 'cast'

  return (
    <div>
      <div className="detail-player">
        <WatchSection
          contentType="tvshow"
          contentId={show.id}
          title={show.name}
          poster={show.thumbnail_url || show.poster_url}
          bunnyLibraryId={bunnyLibraryId}
          bunnyVideoId={show.bunny_video_url}
          trailerUrl={show.trailer_url}
          movieAccess={show.movie_access}
          price={show.price}
          viewerId={viewerId}
        />
      </div>

      <div className="detail-info">
        {genres.length > 0 && (
          <div className="hero-genres">
            {genres.map((g: any) => <span key={g.id}>{g.name}</span>)}
          </div>
        )}
        <h1 className="detail-title">{show.name}</h1>
        {show.content_rating && <div className="crating">{show.content_rating}</div>}
        {show.description && <p className="detail-desc">{String(show.description).replace(/<[^>]*>/g, '')}</p>}
        <div className="hero-meta">
          {show.release_date && <span><IconCalendar /> {String(show.release_date).slice(0, 4)}</span>}
          {show.language && <span><IconGlobe /> {show.language}</span>}
          <span>{seasons.length} {seasons.length === 1 ? 'Season' : 'Seasons'} · {episodes.length} Episodes</span>
          {rating && <span><IconStar /> {rating} (IMDb)</span>}
        </div>
        <div className="hero-actions">
          <button className="btn btn-play" onClick={() => { const l = (window as any).__lenis; if (l) l.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' }) }}><IconPlay /> Watch now</button>
          <WatchlistButton entertainmentId={show.id} initialAdded={!!inWatchlist} viewerId={viewerId} />
          <button className="btn btn-dark btn-circle" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => null) }}><IconShare /></button>
        </div>
      </div>

      <ClipsRail clips={clips} />

      <DetailTabs tabs={tabs} active={activeTab} onChange={setTab} />

      {activeTab === 'episodes' && (
        <section className="section">
          {seasons.length > 1 && (
            <div className="filter-pills" style={{ justifyContent: 'flex-start', margin: '0 0 20px' }}>
              {seasons.map((s: any, i: number) => (
                <button key={s.id} className={`filter-pill${i === seasonIdx ? ' active' : ''}`} onClick={() => setSeasonIdx(i)}>
                  {s.name ?? `Season ${s.season_index}`}
                </button>
              ))}
            </div>
          )}
          {seasonEps.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>No episodes listed for this season.</div>
          ) : (
            seasonEps.map((ep: any, i: number) => (
              <div className="episode-row" key={ep.id}>
                <img className="thumb" src={img(ep.poster_url)} alt={ep.name} loading="lazy" />
                <div style={{ flex: 1 }}>
                  <div className="ep-name">E{i + 1} · {ep.name}</div>
                  <div className="ep-meta">
                    {ep.duration && <span>{ep.duration} · </span>}
                    {ep.IMDb_rating && <span>{ep.IMDb_rating} IMDb · </span>}
                    {ep.release_date && <span>{String(ep.release_date).slice(0, 10)}</span>}
                  </div>
                </div>
                <button className="btn btn-dark btn-circle" aria-label={`Play ${ep.name}`} title={ep.bunny_video_url ? 'Play episode' : 'No source yet'}><IconPlay /></button>
              </div>
            ))
          )}
        </section>
      )}

      {activeTab === 'cast' && (
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

      {activeTab === 'more' && (
        <Rail title="Featured">
          {similar.map((m: any) => <PosterCard key={m.id} item={m} base="/tv-show" />)}
        </Rail>
      )}
      {activeTab === 'bible' && <BiblePanel />}
      {activeTab === 'notes' && <ContentNotes contentType="tvshow" contentId={show.id} title={show.name} />}
    </div>
  )
}
