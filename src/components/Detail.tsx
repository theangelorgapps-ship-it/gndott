import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BookOpen, Film, ListVideo, NotebookPen, Users } from 'lucide-react'
import { DiscreteTabs } from './ui/discrete-tab'
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

export function TrailerPlayer({ url, poster, title, showImmediately = false }: { url?: string | null; poster?: string | null; title: string; showImmediately?: boolean }) {
  const [playing, setPlaying] = useState(showImmediately)
  const yt = youtubeId(url)
  return (
    <div className="trailer-wrap">
      {playing && yt ? (
        <iframe
          className="trailer-frame"
          src={`https://www.youtube.com/embed/${yt}?autoplay=${showImmediately ? 0 : 1}&rel=0`}
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

const TAB_ICONS: Record<string, any> = {
  cast: Users,
  episodes: ListVideo,
  more: Film,
  bible: BookOpen,
  notes: NotebookPen,
}

export function DetailTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="tabs detail-tabs">
      <DiscreteTabs
        items={tabs.map((tab) => ({ id: tab.key, title: tab.label, icon: TAB_ICONS[tab.key] ?? Film }))}
        active={active}
        onChange={onChange}
      />
    </div>
  )
}

const BIBLE_READINGS = [
  {
    reference: 'Psalm 119:105',
    text: 'Thy word is a lamp unto my feet, and a light unto my path.',
  },
  {
    reference: 'Proverbs 3:5–6',
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
  },
  {
    reference: '2 Timothy 3:16',
    text: 'All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness.',
  },
]

export function BiblePanel() {
  return (
    <section className="section detail-supplement bible-panel" aria-labelledby="bible-reading-title">
      <div className="supplement-heading">
        <span className="supplement-kicker">King James Version</span>
        <h2 id="bible-reading-title">Bible reading</h2>
        <p>Pause for scripture and reflection alongside this title.</p>
      </div>
      <div className="bible-grid">
        {BIBLE_READINGS.map((reading) => (
          <blockquote className="bible-verse" key={reading.reference}>
            <p>“{reading.text}”</p>
            <cite>{reading.reference}</cite>
          </blockquote>
        ))}
      </div>
      <a className="btn btn-dark bible-link" href="https://www.bible.com/bible/1/PSA.119.KJV" target="_blank" rel="noreferrer">
        <BookOpen size={17} /> Open YouVersion Bible
      </a>
    </section>
  )
}

export function ContentNotes({ contentType, contentId, title }: { contentType: string; contentId: number; title: string }) {
  const storageKey = `streamit-notes:${contentType}:${contentId}`
  const [note, setNote] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setNote(window.localStorage.getItem(storageKey) ?? '')
    setSavedAt(window.localStorage.getItem(`${storageKey}:saved-at`))
    setStatus('')
  }, [storageKey])

  const saveNote = () => {
    const timestamp = new Date().toISOString()
    window.localStorage.setItem(storageKey, note)
    window.localStorage.setItem(`${storageKey}:saved-at`, timestamp)
    setSavedAt(timestamp)
    setStatus(note.trim() ? 'Note saved on this device.' : 'Empty note saved on this device.')
  }

  const clearNote = () => {
    window.localStorage.removeItem(storageKey)
    window.localStorage.removeItem(`${storageKey}:saved-at`)
    setNote('')
    setSavedAt(null)
    setStatus('Note cleared from this device.')
  }

  return (
    <section className="section detail-supplement notes-panel" aria-labelledby="notes-title">
      <div className="supplement-heading">
        <span className="supplement-kicker">Private to this browser</span>
        <h2 id="notes-title">Notes for {title}</h2>
        <p>Write down a thought, scripture, or moment to revisit. Your note stays on this device.</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          saveNote()
        }}
      >
        <label className="notes-label" htmlFor={`note-${contentType}-${contentId}`}>Your note</label>
        <textarea
          id={`note-${contentType}-${contentId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Write your note here…"
          rows={6}
          maxLength={5000}
        />
        <div className="notes-actions">
          <button className="btn btn-play" type="submit">Save note</button>
          <button className="btn btn-dark" type="button" onClick={clearNote} disabled={!note && !savedAt}>Clear</button>
        </div>
        <p className="notes-status" aria-live="polite">
          {status || (savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}.` : 'No note saved yet.')}
        </p>
      </form>
    </section>
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

import { toggleWatchlist, submitReview, purchasePayPerView } from '../lib/api'
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

// ---------- unified watch section (direct player, PPV gate) ----------

export function WatchSection({
  contentType, contentId, title, poster, bunnyLibraryId, bunnyVideoId, trailerUrl,
  movieAccess, price, myPurchase, viewerId,
}: {
  contentType: 'movie' | 'video' | 'episode' | 'tvshow'
  contentId: number
  title: string
  poster?: string | null
  bunnyLibraryId?: string | null
  bunnyVideoId?: string | null
  trailerUrl?: string | null
  movieAccess?: string | null
  price?: number | null
  myPurchase?: any
  viewerId: number | null
}) {
  const [stage, setStage] = useState<'idle' | 'main'>(movieAccess === 'paid' && !myPurchase ? 'idle' : 'main')
  const [rentMsg, setRentMsg] = useState<string | null>(null)
  const [rentBusy, setRentBusy] = useState(false)
  const [owned, setOwned] = useState(!!myPurchase)
  const router = useRouter()

  const needsPurchase = movieAccess === 'paid' && !owned
  const hasBunny = !!(bunnyLibraryId && bunnyVideoId)

  return (
    <div className="watch-section">
      {stage === 'idle' && (
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
              <button className="trailer-play" onClick={() => setStage('main')} aria-label={`Play ${title}`}>
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
              src={`https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${bunnyVideoId}?autoplay=false&preload=true`}
              title={title}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : trailerUrl ? (
          <TrailerPlayer url={trailerUrl} poster={poster} title={title} showImmediately />
        ) : (
          <div className="trailer-wrap"><div className="empty" style={{ paddingTop: '18%' }}>No video source configured for this title yet.</div></div>
        )
      )}
    </div>
  )
}
