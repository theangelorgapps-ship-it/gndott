import { useState } from 'react'
import { RecommendationGroups, img, plainText, IconShare, IconCalendar } from './Poster'
import { AboutPanel, DetailTabs, ClipsRail, WatchSection, WatchlistButton, BiblePanel, ContentNotes } from './Detail'

export function ShowDetail({ data, kind }: { data: any; kind: 'tvshow' | 'teaching' }) {
  const [tab, setTab] = useState('more')
  const [seasonIdx, setSeasonIdx] = useState(0)
  if (!data) return <div className="empty">{kind === 'teaching' ? 'Teaching' : 'Show'} not found.</div>
  const { show, seasons, episodes, genres, cast, clips, similar, bunnyLibraryId, inWatchlist, myPurchase, viewerId } = data
  const season = seasons[Math.min(seasonIdx, Math.max(seasons.length - 1, 0))]
  const seasonEps = season ? episodes.filter((episode: any) => episode.season_id === season.id) : episodes
  const isTeaching = kind === 'teaching'
  const seasonNoun = isTeaching ? (seasons.length === 1 ? 'Volume' : 'Volumes') : (seasons.length === 1 ? 'Season' : 'Seasons')
  const tabs = [
    { key: 'more', label: 'Featured' },
    { key: 'episodes', label: isTeaching ? 'Volumes' : 'Episodes' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
    { key: 'about', label: 'About' },
  ]

  return (
    <div>
      <div className="detail-player">
        <WatchSection contentType={show.type as any} contentId={show.id} title={show.name} poster={show.thumbnail_url || show.poster_url} bunnyLibraryId={bunnyLibraryId} bunnyVideoId={show.bunny_video_url} trailerUrl={show.trailer_url} movieAccess={show.movie_access} price={show.price} myPurchase={myPurchase} viewerId={viewerId} />
      </div>
      <div className="detail-info">
        {genres.length > 0 && <div className="hero-genres">{genres.map((genre: any) => <span key={genre.id}>{genre.name}</span>)}</div>}
        <h1 className="detail-title">{show.name}</h1>
        {show.description && <p className="detail-desc">{plainText(show.description)}</p>}
        <div className="hero-meta">
          {show.release_date && <span><IconCalendar /> {String(show.release_date).slice(0, 4)}</span>}
          <span>{seasons.length} {seasonNoun} · {episodes.length} Episodes</span>
        </div>
        <div className="hero-actions">
          <WatchlistButton entertainmentId={show.id} initialAdded={!!inWatchlist} viewerId={viewerId} />
          <button className="btn btn-dark btn-circle" aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href).catch(() => null) }}><IconShare /></button>
        </div>
      </div>
      <ClipsRail clips={clips} />
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'episodes' && (
        <section className="section episodes-panel">
          <div className="season-selector-layout">
            {season && (
              <aside className="season-summary">
                {season.poster_url && <img className="season-summary-poster" src={img(season.poster_url)} alt="" loading="lazy" />}
                <div className="season-summary-copy">
                  {season.season_index != null && <span className="season-summary-kicker">{isTeaching ? `Volume ${season.season_index}` : `Season ${season.season_index}`}</span>}
                  <h2 className="season-summary-title">{season.name ?? (isTeaching ? `Volume ${season.season_index}` : `Season ${season.season_index}`)}</h2>
                  <div className="season-summary-meta">{seasonEps.length} {seasonEps.length === 1 ? 'Episode' : 'Episodes'}</div>
                  {season.short_desc && <p className="season-summary-desc">{plainText(season.short_desc)}</p>}
                </div>
              </aside>
            )}
            <div className="season-selector">
              {seasons.length > 1 && (
                <div className="filter-pills season-pills">
                  {seasons.map((item: any, index: number) => (
                    <button key={item.id} type="button" className={`filter-pill${index === seasonIdx ? ' active' : ''}`} aria-pressed={index === seasonIdx} onClick={() => setSeasonIdx(index)}>
                      {item.name ?? (isTeaching ? `Volume ${item.season_index}` : `Season ${item.season_index}`)}
                    </button>
                  ))}
                </div>
              )}
              <div className="episode-list">
                {seasonEps.length === 0 ? (
                  <div className="empty episode-empty">{isTeaching ? 'No episodes listed for this volume.' : 'No episodes listed for this season.'}</div>
                ) : seasonEps.map((episode: any, index: number) => (
                  <div className="episode-row" key={episode.id}>
                    <img className="thumb" src={img(episode.poster_url)} alt={episode.name} loading="lazy" />
                    <div className="episode-copy">
                      <div className="ep-name">E{index + 1} · {episode.name}</div>
                      <div className="ep-meta">
                        {episode.duration && <span>{episode.duration}</span>}
                        {episode.release_date && <span>{String(episode.release_date).slice(0, 10)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      {tab === 'more' && <RecommendationGroups recommendations={data.recommendations} fallback={similar} recentFallback={similar} />}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'notes' && <ContentNotes contentType={show.type} contentId={show.id} title={show.name} />}
      {tab === 'about' && <AboutPanel cast={cast} />}
    </div>
  )
}
