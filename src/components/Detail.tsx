import { ScrollRail } from './ScrollRail'
import { contentPath } from '@/lib/contentRoutes'
import { LibraryNoteEditor } from './LibraryNoteEditor'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { BibleReader } from './BibleReader'
import { CircleCard, img, IconPlay, IconPlus } from './Poster'
import { ImmersivePlayer } from './ImmersivePlayer'

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

function safeVideoUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch { return null }
}

export function hasPlaybackSource(bunnyLibraryId?: string | null, bunnyVideoId?: string | null, trailerUrl?: string | null) {
  return !!(bunnyLibraryId && bunnyVideoId) || !!safeVideoUrl(trailerUrl)
}


export function DetailTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <nav className="tv-detail-tabs" aria-label="Title information">
      {tabs.map((tab, index) => (
        <button key={tab.key} ref={(node) => { buttons.current[index] = node }} type="button" aria-pressed={active === tab.key} className={active === tab.key ? 'active' : ''} onClick={() => onChange(tab.key)} onKeyDown={(event) => {
          let next = index
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
          else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = tabs.length - 1
          else return
          event.preventDefault()
          buttons.current[next]?.focus()
          onChange(tabs[next].key)
        }}>{tab.label}</button>
      ))}
    </nav>
  )
}

export function AboutPanel({ cast = [] }: { cast?: any[] }) {
  const people = Array.isArray(cast) ? cast : []
  const personalities = people.filter((person) => person.type !== 'director')
  const locations = people.filter((person) => person.type === 'director')
  return (
    <section className="section detail-supplement about-panel" aria-label="About this title">
      <div className="about-grid">
        <div className="about-column">
          <div className="section-head"><h2>Personality</h2></div>
          {personalities.length ? (
            <div className="about-people">{personalities.map((person) => <CircleCard key={person.id} name={person.name} image={person.file_url} to={contentPath(person,'/cast')} />)}</div>
          ) : <p className="about-empty">No personality information is available for this title.</p>}
        </div>
        <div className="about-column">
          <div className="section-head"><h2>Location</h2></div>
          {locations.length ? (
            <div className="about-people">{locations.map((person) => <CircleCard key={person.id} name={person.name} image={person.file_url} to={contentPath(person,'/cast')} />)}</div>
          ) : <p className="about-empty">No location information is available for this title.</p>}
        </div>
      </div>
    </section>
  )
}

export function BiblePanel() { return <BibleReader /> }

export function ContentNotes({ contentType, contentId, title }: { contentType: string; contentId: number; title: string }) {
 return <LibraryNoteEditor key={`${contentType}:${contentId}`} noteKey={`${contentType}:${contentId}`} title={title}/>
}

export function ClipsRail({ clips }: { clips: any[] }) {
  if (!clips.length) return null
  return (
    <section className="section">
      <div className="section-head"><h2>Clips</h2></div>
      <ScrollRail label="Clips" style={{ gridAutoColumns: 'var(--wide-card-size, 260px)' }}>
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
          const href = yt ? `https://youtu.be/${yt}` : safeVideoUrl(c.url)
          return href ? (
            <a key={c.id} href={href} target="_blank" rel="noreferrer" className="p-card">{inner}</a>
          ) : (
            <span key={c.id} className="p-card">{inner}</span>
          )
        })}
      </ScrollRail>
    </section>
  )
}

// ---------- watchlist toggle ----------

import { toggleWatchlist, purchasePayPerView } from '../lib/api'
import { useRouter } from '@tanstack/react-router'

export function WatchlistButton({ entertainmentId, initialAdded, viewerId }: { entertainmentId: number; initialAdded: boolean; viewerId: number | null }) {
  const [added, setAdded] = useState(initialAdded)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const statusId = useId()
  const router = useRouter()
  useEffect(() => { setAdded(initialAdded); setMessage('') }, [initialAdded, entertainmentId])
  return (
    <div className="tv-watchlist-control">
      <button
        type="button"
        className={`tv-watchlist-button${added ? ' active-watch' : ''}`}
        aria-label={added ? 'Remove from watchlist' : 'Add to watchlist'}
        aria-pressed={added}
        aria-describedby={message ? statusId : undefined}
        title={added ? 'Remove from watchlist' : 'Add to watchlist'}
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          if (!viewerId) { router.navigate({ to: '/login' }); return }
          setBusy(true)
          setMessage('')
          try {
            const res: any = await toggleWatchlist({ data: { entertainmentId } })
            if (res?.ok) { setAdded(!!res.added); setMessage(res.added ? 'Added to your watchlist.' : 'Removed from your watchlist.') }
            else if (res?.needsAuth) router.navigate({ to: '/login' })
            else if (res?.needsProfile) router.navigate({ to: '/manage-profile' })
            else setMessage(res?.error || 'Could not update your watchlist. Please try again.')
          } catch {
            setMessage('Could not update your watchlist. Please try again.')
          } finally {
            setBusy(false)
          }
        }}
      >
        {added ? <IconCheck size={22} /> : <IconPlus size={22} />}
      </button>
      <span className="tv-watchlist-feedback" id={statusId} role="status">{message}</span>
    </div>
  )
}


// ---------- unified watch section (direct player, PPV gate) ----------

export type WatchSectionProps = {
  contentType: 'movie' | 'video' | 'episode' | 'tvshow' | 'teaching'
  contentId: number
  title: string
  poster?: string | null
  portrait?: string | null
  description?: string | null
  metadata?: (string | null | undefined)[]
  directVideoUrl?: string | null
  bunnyTrailerId?: string | null
  bunnyLibraryId?: string | null
  bunnyVideoId?: string | null
  trailerUrl?: string | null
  movieAccess?: string | null
  price?: number | null
  myPurchase?: any
  viewerId: number | null
  parentGate?: Pick<WatchSectionProps, 'contentType' | 'contentId' | 'title' | 'movieAccess' | 'price' | 'myPurchase'>
}

export function WatchSection(props: WatchSectionProps) {
  const { parentGate, ...playback } = props
  return parentGate ? <WatchContent {...playback} {...parentGate} myPurchase={parentGate.myPurchase} price={parentGate.price}><WatchContent {...playback} /></WatchContent> : <WatchContent {...playback} />
}

function WatchContent({
  contentType, contentId, title, poster, bunnyLibraryId, bunnyVideoId, trailerUrl,
  movieAccess, price, myPurchase, viewerId, children, ...information
}: WatchSectionProps & { children?: ReactNode }) {
  const [stage, setStage] = useState<'idle' | 'main'>(movieAccess === 'paid' && !myPurchase ? 'idle' : 'main')
  const [rentMsg, setRentMsg] = useState<string | null>(null)
  const [rentBusy, setRentBusy] = useState(false)
  const [owned, setOwned] = useState(!!myPurchase)
  const router = useRouter()

  const needsPurchase = movieAccess === 'paid' && !owned

  return (
    <div className="watch-section">
      {stage === 'idle' && (
        <div className="trailer-wrap">
          <div className="trailer-poster" style={{ backgroundImage: `url(${img(poster)})` }}>
            {needsPurchase ? (
              <div className="rent-box">
                <span className="rent-price">${Number(price || 0).toFixed(2)}</span>
                <p>Rent {title} to watch it in full.</p>
                {rentMsg && <p className="form-msg" role="status">{rentMsg}</p>}
                <button
                  className="btn btn-primary"
                  disabled={rentBusy}
                  onClick={async () => {
                    if (!viewerId) { router.navigate({ to: '/login' }); return }
                    setRentBusy(true); setRentMsg(null)
                    try {
                      const res: any = await purchasePayPerView({
                        data: { type: contentType === 'tvshow' ? 'movie' : contentType, id: contentId, gateway: 'cash' },
                      })
                      if (res?.ok) { setOwned(true); setStage('main'); setRentMsg(res.already ? 'You already own this rental.' : `Rented until ${res.expiry}. Enjoy!`) }
                      else if (res?.needsAuth) router.navigate({ to: '/login' })
                      else setRentMsg(res?.error ?? 'Purchase failed.')
                    } catch {
                      setRentMsg('Unable to complete this rental. Please try again.')
                    } finally {
                      setRentBusy(false)
                    }
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

      {stage === 'main' && (children ?? <ImmersivePlayer contentType={contentType} contentId={contentId} title={title} poster={poster} bunnyLibraryId={bunnyLibraryId} bunnyVideoId={bunnyVideoId} trailerUrl={trailerUrl} viewerId={viewerId} {...information} />)}
    </div>
  )
}
