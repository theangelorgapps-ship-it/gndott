import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { img, IconStar, IconPlay, IconPlus } from './Poster'

export function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  return m ? m[1] : null
}

export function TrailerPlayer({ url, poster, title }: { url?: string | null; poster?: string | null; title: string }) {
  const [playing, setPlaying] = useState(false)
  const yt = youtubeId(url)
  return (
    <div className="trailer-wrap">
      {playing && yt ? (
        <iframe
          className="trailer-frame"
          src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button className="trailer-poster" style={{ backgroundImage: `url(${img(poster)})` }} onClick={() => yt && setPlaying(true)} aria-label={`Play trailer for ${title}`}>
          <span className="trailer-play"><IconPlay size={26} /></span>
        </button>
      )}
    </div>
  )
}

export function Stars({ rating }: { rating: number }) {
  const n = Math.round(Number(rating) || 0)
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar key={i} size={13} filled={i <= n} />
      ))}
    </span>
  )
}

export function ReviewCard({ review }: { review: any }) {
  return (
    <div className="review-card">
      <span className="review-avatar">{(review.author ?? '?')[0].toUpperCase()}</span>
      <div className="review-body">
        <div className="review-head">
          <div>
            <div className="review-author">{review.author}</div>
            <div className="review-date">{String(review.created_at ?? '').slice(0, 10)}</div>
          </div>
          <Stars rating={review.rating} />
        </div>
        <p className="review-text">{review.review}</p>
      </div>
    </div>
  )
}

export function DetailTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="tabs detail-tabs">
      {tabs.map((t) => (
        <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function ClipsRail({ clips }: { clips: any[] }) {
  if (!clips.length) return null
  return (
    <section className="section">
      <div className="section-head"><h2>Clips</h2></div>
      <div className="rail" style={{ gridAutoColumns: '260px' }}>
        {clips.map((c: any) => {
          const inner = (
            <>
              <span className="clip-thumb" style={{ backgroundImage: `url(${img(c.poster_url)})` }}>
                <span className="trailer-play sm"><IconPlay size={16} /></span>
              </span>
              <span className="p-name">{c.title}</span>
            </>
          )
          const yt = youtubeId(c.url)
          return yt ? (
            <a key={c.id} href={`https://youtu.be/${yt}`} target="_blank" rel="noreferrer" className="p-card">{inner}</a>
          ) : (
            <span key={c.id} className="p-card">{inner}</span>
          )
        })}
      </div>
    </section>
  )
}

// ---------- watchlist toggle ----------

import { toggleWatchlist, submitReview, fetchVastMedia, purchasePayPerView } from '../lib/api'
import { useRouter } from '@tanstack/react-router'

export function WatchlistButton({ entertainmentId, initialAdded, viewerId }: { entertainmentId: number; initialAdded: boolean; viewerId: number | null }) {
  const [added, setAdded] = useState(initialAdded)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  return (
    <button
      className={`btn btn-dark btn-circle${added ? ' active-watch' : ''}`}
      aria-label={added ? 'Remove from watchlist' : 'Add to watchlist'}
      title={added ? 'Remove from watchlist' : 'Add to watchlist'}
      disabled={busy}
      onClick={async () => {
        if (!viewerId) { router.navigate({ to: '/login' }); return }
        setBusy(true)
        const res: any = await toggleWatchlist({ data: { entertainmentId } })
        setBusy(false)
        if (res?.ok) setAdded(!!res.added)
        else if (res?.needsAuth) router.navigate({ to: '/login' })
      }}
    >
      {added ? <IconCheck /> : <IconPlus />}
    </button>
  )
}

// ---------- review form ----------

export function ReviewForm({ entertainmentId, myReview, viewerId }: { entertainmentId: number; myReview: any; viewerId: number | null }) {
  const [rating, setRating] = useState<number>(myReview?.rating ?? 0)
  const [text, setText] = useState<string>(myReview?.review ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  if (!viewerId)
    return (
      <div className="review-form">
        <p className="muted">Sign in to write a review.</p>
        <Link to="/login" className="btn btn-dark">Sign in</Link>
      </div>
    )
  return (
    <form
      className="review-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setMsg(null)
        const res: any = await submitReview({ data: { entertainmentId, rating, review: text } })
        setBusy(false)
        if (res?.ok) { setMsg(res.updated ? 'Your review was updated.' : 'Thanks! Your review was posted.'); router.invalidate() }
        else setMsg(res?.error ?? 'Could not save your review.')
      }}
    >
      <h3>{myReview ? 'Edit your review' : 'Write a review'}</h3>
      <div className="star-input" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button type="button" key={i} className={i <= rating ? 'on' : ''} onClick={() => setRating(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`}>
            <IconStar size={20} filled={i <= rating} />
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share your thoughts about this title…"
        rows={3}
        maxLength={2000}
        required
      />
      {msg && <p className="form-msg">{msg}</p>}
      <button className="btn btn-primary" disabled={busy || rating === 0 || !text.trim()}>
        {busy ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review'}
      </button>
    </form>
  )
}

// ---------- bunny player ----------

export function BunnyPlayer({ libraryId, videoId, poster, title }: { libraryId: string; videoId: string; poster?: string | null; title: string }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="trailer-wrap">
      {playing ? (
        <iframe
          className="trailer-frame"
          src={`https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=true&preload=false`}
          title={title}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button className="trailer-poster" style={{ backgroundImage: `url(${img(poster)})` }} onClick={() => setPlaying(true)} aria-label={`Play ${title}`}>
          <span className="trailer-play"><IconPlay size={26} /></span>
        </button>
      )}
    </div>
  )
}

// ---------- ads (VAST pre-roll / custom overlay) ----------

function VastPreRoll({ ad, onDone }: { ad: any; onDone: () => void }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const skipAfter = Number(ad.enable_skip) === 1 ? Number(ad.skip_after) || 5 : null
  useEffect(() => {
    let alive = true
    fetchVastMedia({ data: ad.url }).then((res: any) => {
      if (!alive) return
      if (res?.ok) setMediaUrl(res.mediaUrl)
      else setErr(res?.error ?? 'Ad unavailable')
    })
    return () => { alive = false }
  }, [ad.url])
  if (err) return null
  return (
    <div className="ad-overlay">
      {mediaUrl ? (
        <video
          className="ad-video"
          src={mediaUrl}
          autoPlay
          onEnded={onDone}
          onTimeUpdate={(e) => setElapsed(Math.floor((e.target as HTMLVideoElement).currentTime))}
        />
      ) : (
        <div className="ad-loading">Loading ad…</div>
      )}
      <span className="ad-badge">Ad{ad.name ? ` · ${ad.name}` : ''}</span>
      {skipAfter != null && (
        elapsed >= skipAfter
          ? <button className="ad-skip" onClick={onDone}>Skip Ad</button>
          : <span className="ad-skip disabled">Skip in {Math.max(0, skipAfter - elapsed)}s</span>
      )}
    </div>
  )
}

function CustomOverlayAd({ ad, onDone }: { ad: any; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const duration = Number(ad.duration) || 10
  const skipAfter = Number(ad.skip_enabled) === 1 ? Number(ad.skip_after) || 5 : null
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (elapsed >= duration) onDone()
  }, [elapsed, duration, onDone])
  const src = ad.url_type === 'url' ? ad.media : img(ad.media)
  return (
    <div className="ad-overlay ad-custom">
      {ad.redirect_url ? (
        <a href={ad.redirect_url} target="_blank" rel="noreferrer">
          {ad.type === 'video' ? <video className="ad-video" src={src} autoPlay muted /> : <img className="ad-image" src={src} alt={ad.name ?? 'Advertisement'} />}
        </a>
      ) : (
        ad.type === 'video' ? <video className="ad-video" src={src} autoPlay muted /> : <img className="ad-image" src={src} alt={ad.name ?? 'Advertisement'} />
      )}
      <span className="ad-badge">Ad{ad.name ? ` · ${ad.name}` : ''}</span>
      {skipAfter != null && (
        elapsed >= skipAfter
          ? <button className="ad-skip" onClick={onDone}>Skip Ad</button>
          : <span className="ad-skip disabled">Skip in {Math.max(0, skipAfter - elapsed)}s</span>
      )}
    </div>
  )
}

// ---------- unified watch section (ads → player, PPV gate) ----------

export function WatchSection({
  contentType, contentId, title, poster, ads, bunnyLibraryId, bunnyVideoId, trailerUrl,
  movieAccess, price, myPurchase, viewerId,
}: {
  contentType: 'movie' | 'video' | 'episode' | 'tvshow'
  contentId: number
  title: string
  poster?: string | null
  ads?: { vast: any[]; custom: any[] }
  bunnyLibraryId?: string | null
  bunnyVideoId?: string | null
  trailerUrl?: string | null
  movieAccess?: string | null
  price?: number | null
  myPurchase?: any
  viewerId: number | null
}) {
  const preRoll = ads?.vast?.find((a: any) => a.type === 'pre-roll')
  const customAd = ads?.custom?.find((a: any) => a.placement === 'video_player') ?? null
  const [stage, setStage] = useState<'idle' | 'ad' | 'main'>('idle')
  const [rentMsg, setRentMsg] = useState<string | null>(null)
  const [rentBusy, setRentBusy] = useState(false)
  const [owned, setOwned] = useState(!!myPurchase)
  const router = useRouter()

  const needsPurchase = movieAccess === 'paid' && !owned
  const hasBunny = !!(bunnyLibraryId && bunnyVideoId)

  const startPlayback = () => setStage(preRoll || customAd ? 'ad' : 'main')

  return (
    <div className="watch-section">
      {stage === 'ad' && preRoll && <VastPreRoll ad={preRoll} onDone={() => setStage('main')} />}
      {stage === 'ad' && !preRoll && customAd && <CustomOverlayAd ad={customAd} onDone={() => setStage('main')} />}

      {stage !== 'main' && (
        <div className="trailer-wrap">
          <div className="trailer-poster" style={{ backgroundImage: `url(${img(poster)})` }}>
            {needsPurchase ? (
              <div className="rent-box">
                <span className="rent-price">${Number(price || 0).toFixed(2)}</span>
                <p>Rent this title to watch it in full.</p>
                {rentMsg && <p className="form-msg">{rentMsg}</p>}
                <button
                  className="btn btn-primary"
                  disabled={rentBusy}
                  onClick={async () => {
                    if (!viewerId) { router.navigate({ to: '/login' }); return }
                    setRentBusy(true); setRentMsg(null)
                    const res: any = await purchasePayPerView({
                      data: { type: contentType === 'tvshow' ? 'movie' : contentType, id: contentId, gateway: 'cash' },
                    })
                    setRentBusy(false)
                    if (res?.ok) { setOwned(true); setRentMsg(res.already ? 'You already own this rental.' : `Rented until ${res.expiry}. Enjoy!`) }
                    else if (res?.needsAuth) router.navigate({ to: '/login' })
                    else setRentMsg(res?.error ?? 'Purchase failed.')
                  }}
                >
                  {rentBusy ? 'Processing…' : 'Rent Now'}
                </button>
              </div>
            ) : (
              <button className="trailer-play" onClick={startPlayback} aria-label={`Play ${title}`}>
                <IconPlay size={26} />
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'main' && (
        hasBunny ? (
          <div className="trailer-wrap">
            <iframe
              className="trailer-frame"
              src={`https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${bunnyVideoId}?autoplay=true&preload=false`}
              title={title}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : trailerUrl ? (
          <TrailerPlayer url={trailerUrl} poster={poster} title={title} />
        ) : (
          <div className="trailer-wrap"><div className="empty" style={{ paddingTop: '18%' }}>No video source configured for this title yet.</div></div>
        )
      )}
    </div>
  )
}
