import { useState } from 'react'
import { RecommendationGroups, img, plainText, IconPlay } from './Poster'
import { AboutPanel, DetailTabs, ClipsRail, BiblePanel, ContentNotes, hasPlaybackSource, type WatchSectionProps } from './Detail'
import { PlaybackDialog, TitleDetail } from './TitleDetail'
import { orderedEpisodes } from './playbackEnding'

export function ShowDetail({ data, kind }: { data: any; kind: 'tvshow' | 'teaching' }) {
  if (!data) return <div className="empty">{kind === 'teaching' ? 'Teaching' : 'Show'} not found.</div>
  return <ShowDetailContent key={`${kind}:${data.show.id}`} data={data} kind={kind} />
}

function ShowDetailContent({ data, kind }: { data: any; kind: 'tvshow' | 'teaching' }) {
  const [tab, setTab] = useState('episodes')
  const [episodeMessage, setEpisodeMessage] = useState('')
  const [seasonIdx, setSeasonIdx] = useState(0)
  const [selectedPlayback, setSelectedPlayback] = useState<WatchSectionProps | null>(null)
  const { show, seasons = [], episodes = [], genres = [], cast = [], clips = [], similar, bunnyLibraryId, inWatchlist, myPurchase, viewerId } = data
  const season = seasons[Math.min(seasonIdx, Math.max(seasons.length - 1, 0))]
  const ordered = orderedEpisodes<any>(episodes, seasons)
  const seasonEps = season ? ordered.filter((episode: any) => String(episode.season_id) === String(season.id)) : ordered
  const isTeaching = kind === 'teaching'
  const seasonLabel = (item: any, index: number) => item.name || `${isTeaching ? 'Volume' : 'Season'} ${item.season_index ?? index + 1}`
  const episodeUrl = (episode: any) => episode.trailer_url || (/^https?:\/\/.*\.(mp4|webm|ogg|m4v|m3u8)(?:[?#]|$)/i.test(episode.video_url_input ?? '') ? episode.video_url_input : null)
  const canPlayEpisode = (episode: any) => hasPlaybackSource(bunnyLibraryId, episode.bunny_video_url, episodeUrl(episode))
  // Paid source fields are intentionally absent until both entitlements pass.
  // Keep the rental gate reachable without treating a redacted URL as an error.
  const needsEpisodeRental = (episode: any) => (show.movie_access === 'paid' && !myPurchase) || ((episode.access ?? episode.movie_access) === 'paid' && !episode.myPurchase)
  const needsEpisodeSubscription = (episode: any) => show.hasSubscriptionAccess === false || episode.hasSubscriptionAccess === false
  const canOpenEpisode = (episode: any) => canPlayEpisode(episode) || needsEpisodeRental(episode) || needsEpisodeSubscription(episode)
  const showPlayback: WatchSectionProps = {
    contentType: kind, contentId: show.id, title: show.name, description: show.description, portrait: show.poster_url, metadata: [show.release_date && String(show.release_date).slice(0, 4)], bunnyTrailerId: show.bunny_trailer_url, directVideoUrl: show.video_url_input, poster: show.thumbnail_url || show.poster_url,
    bunnyLibraryId, bunnyVideoId: show.bunny_video_url, trailerUrl: show.trailer_url,
    movieAccess: show.movie_access, price: show.price, myPurchase, viewerId,
    hasSubscriptionAccess: show.hasSubscriptionAccess,
    recommendations: data.recommendations?.forYou ?? similar,
  }
  function episodePlayback(episode: any): WatchSectionProps {
    const next = ordered[ordered.findIndex(item => Number(item.id) === Number(episode.id)) + 1]
    return {
      locations: episode.locations ?? [],
      contentType: 'episode',
      contentId: episode.id,
      title: `${show.name} · ${episode.name}`,
      description: episode.description || episode.short_desc || show.description,
      portrait: show.poster_url,
      metadata: [episode.release_date && String(episode.release_date).slice(0, 4), episode.duration],
      directVideoUrl: episode.video_url_input,
      poster: episode.thumbnail_url || episode.poster_url || show.thumbnail_url || show.poster_url,
      bunnyLibraryId,
      bunnyVideoId: episode.bunny_video_url,
      trailerUrl: episodeUrl(episode),
      movieAccess: episode.access ?? episode.movie_access,
      price: episode.price,
      myPurchase: episode.myPurchase,
      hasSubscriptionAccess: episode.hasSubscriptionAccess,
      parentGate: show.movie_access === 'paid' || show.hasSubscriptionAccess === false ? { contentType: kind, contentId: show.id, title: show.name, movieAccess: show.movie_access, price: show.price, myPurchase, hasSubscriptionAccess: show.hasSubscriptionAccess } : undefined,
      viewerId,
      recommendations: data.recommendations?.forYou ?? similar,
      upNext: next && canOpenEpisode(next) ? {
        title: next.name, poster: next.thumbnail_url || next.poster_url || show.thumbnail_url || show.poster_url,
        description: next.description || next.short_desc, subtitle: `${seasons.find((item: any) => String(item.id) === String(next.season_id))?.name || (isTeaching ? 'Volume' : 'Season')} · Episode ${next.episode_index ?? next.episode_number ?? ordered.indexOf(next) + 1}`,
        requiresPurchase: needsEpisodeRental(next), requiresSubscription: needsEpisodeSubscription(next), onPlay: () => setSelectedPlayback(episodePlayback(next)),
      } : undefined,
    }
  }
  const firstPlayableEpisode = seasonEps.find(canOpenEpisode)
  const primaryPlayback = hasPlaybackSource(bunnyLibraryId, show.bunny_video_url, show.trailer_url) || !firstPlayableEpisode ? showPlayback : episodePlayback(firstPlayableEpisode)
  const tabs = [
    { key: 'episodes', label: 'Episodes' },
    { key: 'more', label: 'Featured' },
    { key: 'bible', label: 'Bible' },
    { key: 'notes', label: 'Notes' },
    { key: 'about', label: 'About' },
  ]

  return (
    <TitleDetail
      title={show.name}
      poster={show.poster_url}
      landscape={show.thumbnail_url}
      description={show.description}
      kind={isTeaching ? 'Teaching' : 'TV Show'}
      genres={genres}
      metadata={[
        show.release_date && String(show.release_date).slice(0, 4),
        seasons.length > 0 ? `${seasons.length} ${isTeaching ? (seasons.length === 1 ? 'Volume' : 'Volumes') : (seasons.length === 1 ? 'Season' : 'Seasons')}` : null,
        `${episodes.length} ${episodes.length === 1 ? 'Episode' : 'Episodes'}`,
      ]}
      watchlist={{ entertainmentId: show.id, initialAdded: !!inWatchlist, viewerId }}
      playback={showPlayback}
      onPlay={(episodeId) => {
        if (episodeId == null) { setSelectedPlayback(primaryPlayback); return }
        const episode = episodes.find((item: any) => Number(item.id) === episodeId)
        if (!episode || !canOpenEpisode(episode)) { setTab('episodes'); setEpisodeMessage('This episode is no longer available. Choose an episode below.'); return }
        const index = seasons.findIndex((item: any) => String(item.id) === String(episode.season_id))
        if (index >= 0) setSeasonIdx(index)
        setEpisodeMessage('')
        setSelectedPlayback(episodePlayback(episode))
      }}
    >
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
      {episodeMessage && <p className="tv-episode-intent-status" role="status">{episodeMessage}</p>}
      {tab === 'episodes' && (
        <section className="tv-episodes-panel" aria-label="Episodes">
          <div className="tv-season-heading">
            {seasons.length > 1 ? (
              <label className="tv-season-select"><span className="tv-sr-only">{isTeaching ? 'Choose a volume' : 'Choose a season'}</span><select value={seasonIdx} onChange={(event) => setSeasonIdx(Number(event.target.value))}>{seasons.map((item: any, index: number) => <option key={item.id} value={index}>{seasonLabel(item, index)}</option>)}</select></label>
            ) : <h2>{season ? seasonLabel(season, seasonIdx) : 'Episodes'}</h2>}
            <span>{seasonEps.length} {seasonEps.length === 1 ? 'episode' : 'episodes'}</span>
          </div>
          {season?.short_desc && <p className="tv-season-description">{plainText(season.short_desc)}</p>}
          <div className="tv-episode-rail" data-lenis-prevent>
            {seasonEps.length === 0 ? <p className="tv-episode-empty">{isTeaching ? 'No episodes listed for this volume.' : 'No episodes listed for this season.'}</p> : seasonEps.map((episode: any, index: number) => {
              const playable = canOpenEpisode(episode)
              const needsRental = needsEpisodeRental(episode)
              const needsSubscription = needsEpisodeSubscription(episode)
              return (
                <button type="button" className="tv-episode-card" key={episode.id} disabled={!playable} onClick={() => setSelectedPlayback(episodePlayback(episode))} aria-label={needsSubscription ? `View subscription options for ${episode.name}` : needsRental ? `View rental options for ${episode.name}` : playable ? `Play ${episode.name}` : `${episode.name}. Playback unavailable`}>
                  <span className="tv-episode-art"><img src={img(episode.thumbnail_url || episode.poster_url || show.thumbnail_url || show.poster_url)} alt="" loading="lazy" />{playable && <span className="tv-episode-play"><IconPlay size={22} /></span>}</span>
                  <span className="tv-episode-number">Episode {episode.episode_index ?? episode.episode_number ?? index + 1}</span>
                  <span className="tv-episode-name">{episode.name}</span>
                  {(episode.short_desc || episode.description) && <span className="tv-episode-description">{plainText(episode.short_desc || episode.description)}</span>}
                  <span className="tv-episode-meta">{[episode.duration, episode.release_date && String(episode.release_date).slice(0, 10)].filter(Boolean).join(' · ')}</span>
                  {needsSubscription ? <span className="tv-episode-unavailable">Subscription required</span> : needsRental && <span className="tv-episode-unavailable">Rental required</span>}
                  {!playable && <span className="tv-episode-unavailable">Playback unavailable</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}
      {tab === 'more' && <RecommendationGroups recommendations={data.recommendations} fallback={similar} recentFallback={similar} />}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'notes' && <ContentNotes contentType={kind} contentId={show.id} title={show.name} />}
      {tab === 'about' && <AboutPanel cast={cast} locations={data.locations ?? []} />}
      <ClipsRail clips={clips} />
      {selectedPlayback && <PlaybackDialog playback={selectedPlayback} onClose={() => setSelectedPlayback(null)} />}
    </TitleDetail>
  )
}
