import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Play, RotateCcw, X } from 'lucide-react'
import { img, plainText } from './Poster'
import { createNextCountdown, endRecommendations, NEXT_COUNTDOWN_SECONDS, type NextPlayback } from './playbackEnding'

export function PlaybackEndScreen({ title, poster, metadata = [], contentType, contentId, recommendations, upNext, ended, onReplay, onDismiss, onNavigate }: {
  title: string; poster?: string | null; metadata?: (string | null | undefined)[]
  contentType: string; contentId: number; recommendations?: any[]; upNext?: NextPlayback
  ended: boolean; onReplay: () => void; onDismiss: () => void; onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const items = endRecommendations(recommendations, { contentType, contentId })
  const suggestion = !upNext ? items[0] : undefined
  const next: NextPlayback | undefined = upNext || (suggestion ? {
    title: suggestion.name, poster: suggestion.poster, description: suggestion.description, requiresPurchase: suggestion.paid, requiresSubscription: suggestion.subscription,
    onPlay: () => { onNavigate?.(); void navigate({ to: suggestion.href as any, hash: 'watch' }) },
  } : undefined)
  const nextRef = useRef(next)
  nextRef.current = next
  const [seconds, setSeconds] = useState(NEXT_COUNTDOWN_SECONDS)
  const [cancelled, setCancelled] = useState(false)
  const countdown = useRef<ReturnType<typeof createNextCountdown> | null>(null)
  const canAdvance = !!next && !next.requiresPurchase && !next.requiresSubscription
  const gateLabel = next?.requiresSubscription ? 'Subscription required' : next?.requiresPurchase ? 'Rental required' : ''
  useEffect(() => {
    if (!ended || cancelled || !canAdvance) return
    const controller = createNextCountdown(setSeconds, () => nextRef.current?.onPlay())
    countdown.current = controller
    const visibility = () => controller.setVisible(!document.hidden)
    document.addEventListener('visibilitychange', visibility)
    visibility()
    return () => { controller.cancel(); countdown.current = null; document.removeEventListener('visibilitychange', visibility) }
  }, [ended, cancelled, canAdvance])
  const cancel = () => { countdown.current?.cancel(); setCancelled(true) }
  const chooseNext = () => { cancel(); nextRef.current?.onPlay() }
  return <section className="tv-end-screen" aria-label="After watching" data-ended={ended}>
    <button type="button" className="tv-end-dismiss" aria-label={ended ? 'Return to player' : 'Keep watching'} onClick={() => { cancel(); onDismiss() }}><X size={23} /></button>
    <div className="tv-end-pair">
      <div className="tv-end-previous">
        <h2>Just Played</h2>
        <button type="button" className="tv-end-card" onClick={() => { cancel(); onReplay() }} aria-label={`Replay ${title}`}>
          <span className="tv-end-art"><img src={img(poster)} alt="" /><span><RotateCcw size={29} /></span></span>
          <strong>{title}</strong><small>{metadata.filter(Boolean).join(' · ') || 'Play again'}</small>
        </button>
      </div>
      {next ? <div className="tv-end-next">
        <h2>Up Next{ended && !cancelled && canAdvance ? <span aria-hidden="true"> · {seconds}</span> : null}</h2>
        <div className="tv-end-next-content">
          <button type="button" className="tv-end-card" onClick={chooseNext} aria-label={gateLabel ? `View access options for ${next.title}` : `Play ${next.title}`}>
            <span className="tv-end-art"><img src={img(next.poster)} alt="" /><span><Play size={30} fill="currentColor" /></span></span>
            <strong>{next.title}</strong><small>{gateLabel || next.subtitle || 'Play next'}</small>
          </button>
          {next.description && <p>{plainText(next.description)}</p>}
        </div>
        <div className="tv-end-countdown">
          <p role="status">{gateLabel ? 'Choose this title to view access options.' : cancelled ? 'Autoplay cancelled.' : ended ? 'The next title will play automatically.' : 'The next title starts after this one finishes.'}</p>
          {!cancelled && canAdvance && <button type="button" onClick={cancel}>Cancel autoplay</button>}
        </div>
      </div> : <div className="tv-end-next tv-end-finished"><h2>Thanks for watching</h2><p>Replay this title whenever you like.</p></div>}
    </div>
    {items.length > 0 && <div className="tv-end-recommendations"><h2>Recommended For You</h2><div className="tv-end-rail" data-lenis-prevent>
      {items.map(item => <Link key={`${item.type}:${item.id}`} to={item.href as any} hash="watch" className="tv-end-recommendation" onClick={() => { cancel(); onNavigate?.() }}>
        <img src={img(item.poster)} alt="" loading="lazy" /><strong>{item.name}</strong>{item.subscription ? <small>Subscription required</small> : item.paid && <small>Rental required</small>}
      </Link>)}
    </div></div>}
  </section>
}
