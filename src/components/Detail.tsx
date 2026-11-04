import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { img, IconStar, IconPlay } from './Poster'

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
