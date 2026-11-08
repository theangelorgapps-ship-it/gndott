import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Share2, X, Maximize, Minimize } from 'lucide-react'
import { img, plainText, IconPlay, IconPlus } from './Poster'
import { WatchlistButton, WatchSection, type WatchSectionProps } from './Detail'
import { TitlePreview } from './TitlePreview'
import { enterPlayerFullscreen, togglePlayerFullscreen } from './playerFullscreen'

export function PlaybackDialog({ playback, onClose }: { playback: WatchSectionProps; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const [mounted, setMounted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenMessage, setFullscreenMessage] = useState('')
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const dialog = dialogRef.current
    if (!dialog) return
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.dispatchEvent(new Event('gndott:playback-open'))
    dialog.showModal()
    void enterPlayerFullscreen(surfaceRef.current).catch(() => undefined)
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === surfaceRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    surfaceRef.current?.focus({ preventScroll: true })
    return () => {
      if (document.fullscreenElement && dialog.contains(document.fullscreenElement)) void document.exitFullscreen().catch(() => undefined)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
    }
  }, [mounted])

  if (!mounted) return null
  return createPortal(
    <dialog ref={dialogRef} data-lenis-prevent className="tv-playback-dialog tv-immersive-dialog" aria-labelledby={headingId} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={surfaceRef} tabIndex={-1} className="tv-playback-content tv-playback-surface">
        <header className="tv-playback-heading">
          <h2 id={headingId}>{playback.title}</h2>
          <button ref={closeRef} type="button" className="tv-detail-utility" aria-label="Close playback" onClick={onClose}><X size={23} /></button>
          <button type="button" className="tv-detail-utility tv-player-fullscreen" aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'} onClick={() => { setFullscreenMessage(''); void togglePlayerFullscreen(surfaceRef.current).catch(() => setFullscreenMessage('Start the video, then tap full screen again. If your browser does not support it, the player will continue filling this window.')) }}>{fullscreen ? <Minimize size={22} /> : <Maximize size={22} />}</button>
        </header>
        {fullscreenMessage && <p className="tv-fullscreen-status" role="status">{fullscreenMessage}</p>}
        <WatchSection {...playback} />
      </div>
    </dialog>, document.body,
  )
}

function ShareButton({ title }: { title: string }) {
  const [message, setMessage] = useState('')
  const [fallbackUrl, setFallbackUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const statusId = useId()
  async function shareTitle() {
    setBusy(true)
    setMessage('')
    setFallbackUrl('')
    const url = new URL(window.location.href)
    url.hash = ''
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url: url.href })
          setMessage('Shared.')
          return
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return
        }
      }
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url.href)
          setMessage('Link copied.')
          return
        } catch { /* Show the real link when clipboard access is unavailable. */ }
      }
      setFallbackUrl(url.href)
      setMessage('Copy this link to share.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="tv-detail-share">
      <button type="button" className="tv-detail-utility" aria-label={`Share ${title}`} aria-describedby={message ? statusId : undefined} disabled={busy} onClick={shareTitle}><Share2 size={21} /></button>
      {message && <div className="tv-share-feedback" id={statusId} role="status">{message}{fallbackUrl && <input aria-label="Link to this title" readOnly value={fallbackUrl} onFocus={(event) => event.currentTarget.select()} />}</div>}
    </div>
  )
}

export function TitleDetail({ title, poster, landscape, description, kind, genres = [], metadata = [], watchlist, playback, onPlay, children }: {
  title: string
  poster?: string | null
  landscape?: string | null
  description?: string | null
  kind: string
  genres?: { id: number; name: string }[]
  metadata?: (string | null | undefined)[]
  watchlist?: { entertainmentId: number; initialAdded: boolean; viewerId: number | null }
  playback: WatchSectionProps
  onPlay?: (episodeId?: number) => void
  children?: ReactNode
}) {
  const router = useRouter()
  const hash = useRouterState({ select: (state) => state.location.hash })
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const consumedIntent = useRef('')
  const descriptionId = useId()
  const copy = plainText(description)
  const canExpand = copy.length > 180
  const summary = canExpand && !expanded ? `${copy.slice(0, 177).replace(/\s+\S*$/, '')}…` : copy
  const openPlayback = () => onPlay ? onPlay() : setPlaying(true)

  useEffect(() => {
    const intent = `${playback.contentType}:${playback.contentId}:${hash}`
    const episodeMatch = hash.match(/^watch-episode-(\d+)$/)
    if ((hash === 'watch' || (episodeMatch && onPlay)) && consumedIntent.current !== intent) {
      consumedIntent.current = intent
      if (onPlay) onPlay(episodeMatch ? Number(episodeMatch[1]) : undefined)
      else setPlaying(true)
    }
  }, [hash, playback.contentType, playback.contentId, onPlay])

  return (
    <div className="tv-title-page">
      <section className="tv-title-hero" aria-labelledby={`title-${playback.contentType}-${playback.contentId}`}>
        <picture className="tv-title-art" aria-hidden="true">
          <source media="(min-width: 760px)" srcSet={img(landscape || poster)} />
          <img src={img(poster || landscape)} alt="" fetchPriority="high" />
        </picture>
        <TitlePreview title={title} trailerUrl={playback.trailerUrl} bunnyLibraryId={playback.bunnyLibraryId} bunnyTrailerId={playback.bunnyTrailerId}
          directVideoUrl={playback.movieAccess !== 'paid' || playback.myPurchase ? playback.directVideoUrl : null} />
        <div className="tv-title-shade" />
        <div className="tv-title-utilities">
          <button type="button" className="tv-detail-utility" aria-label="Go back" onClick={() => { if (router.history.canGoBack()) router.history.back(); else router.navigate({ to: '/' }) }}><ChevronLeft size={26} /></button>
          <ShareButton title={title} />
        </div>
        <div className="tv-title-copy">
          <h1 id={`title-${playback.contentType}-${playback.contentId}`}>{title}</h1>
          <p className="tv-title-genres">{[kind, ...genres.slice(0, 2).map((genre) => genre.name)].filter(Boolean).join(' · ')}</p>
          <div className="tv-title-actions">
            <button type="button" className="tv-title-play" onClick={openPlayback}><IconPlay size={22} /> Play</button>
            {watchlist ? <WatchlistButton {...watchlist} /> : <button className="tv-watchlist-unavailable" type="button" disabled title="Watchlist is not available for videos" aria-label="Watchlist is not available for videos"><IconPlus size={22} /></button>}
          </div>
          {!watchlist && <p className="tv-title-availability">Watchlist is not available for videos.</p>}
          {copy && <div className="tv-title-synopsis"><p id={descriptionId}>{summary}</p>{canExpand && <button type="button" aria-controls={descriptionId} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Less' : 'More'}</button>}</div>}
          {metadata.filter(Boolean).length > 0 && <p className="tv-title-metadata">{metadata.filter(Boolean).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</p>}
        </div>
      </section>
      {children}
      {playing && <PlaybackDialog playback={playback} onClose={() => setPlaying(false)} />}
    </div>
  )
}
