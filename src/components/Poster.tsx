import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import manifest from '../lib/img-manifest.json'

export const DEFAULT_IMG = '/default-image.jpg'

const MANIFEST = manifest as Record<string, string>

export function img(url: string | null | undefined): string {
  if (!url) return DEFAULT_IMG
  if (url.startsWith('/images/') || url.startsWith('/media/')) return url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // URLs left over from the Laravel seed point at a dead local server — resolve by filename
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
      const base = url.split('/').pop() ?? url
      const stem = base.replace(/\.(png|jpe?g|webp)$/i, '')
      return MANIFEST[base] ?? MANIFEST[stem] ?? DEFAULT_IMG
    }
    return url
  }
  // bare filename or relative path from the Laravel DB — resolve via manifest
  const base = url.split('/').pop() ?? url
  const stem = base.replace(/\.(png|jpe?g|webp)$/i, '')
  return MANIFEST[base] ?? MANIFEST[stem] ?? DEFAULT_IMG
}

export function IconPlay({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  )
}
export function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}
export function IconShare({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" strokeLinecap="round" />
    </svg>
  )
}
export function IconSearch({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  )
}
export function IconCalendar({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}
export function IconGlobe({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20 15.3 15.3 0 010-20z" />
    </svg>
  )
}
export function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  )
}
export function IconStar({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
    </svg>
  )
}
export function IconChevronLeft({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function IconChevronRight({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function IconCrown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 12l-2 4H5zm0 2h14v2H5v-2z" />
    </svg>
  )
}

export function plainText(value: unknown): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&amp;': '&', '&mdash;': '—', '&ndash;': '–',
    '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&hellip;': '…',
  }
  let text = String(value ?? '').replace(/<[^>]*>/g, ' ')
  for (const [entity, character] of Object.entries(entities)) text = text.replaceAll(entity, character)
  return text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/\s+/g, ' ').trim()
}

export function ratingOf(item: any): string | null {
  const r = item.IMDb_rating ?? item.imdb_rating
  return ratingToStr(r)
}
function ratingToStr(r: any): string | null {
  if (r == null || r === '') return null
  const n = Number(r)
  return isNaN(n) ? String(r) : String(Math.round(n * 10) / 10)
}

export function PosterCard({ item, base }: { item: any; base: string }) {
  const rating = base === '/video' ? null : ratingOf(item)
  const paid = item.movie_access === 'paid' || item.access === 'paid'
  return (
    <Link to={`${base}/${item.id}` as any} className="p-card" params={undefined as never}>
      <span className="p-poster" style={{ backgroundImage: `url(${img(item.poster_url)})` }}>
        {rating && (
          <span className="p-rating">
            <IconStar size={10} /> {rating}
          </span>
        )}
        {paid && (
          <span className="p-crown" title="Premium">
            <IconCrown size={11} />
          </span>
        )}
      </span>
      <span className="p-name">{item.name}</span>
      <HoverPreview item={item} base={base} rating={rating} />
    </Link>
  )
}

/** Netflix-style delayed hover preview: pops up after a short dwell, never instantly. */
function HoverPreview({ item, base, rating }: { item: any; base: string; rating: string | null }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const card = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = card.current?.closest('.p-card') as HTMLElement | null
    if (!host) return
    const enter = () => {
      timer.current = setTimeout(() => setOpen(true), 450)
    }
    const leave = () => {
      if (timer.current) clearTimeout(timer.current)
      setOpen(false)
    }
    host.addEventListener('mouseenter', enter)
    host.addEventListener('mouseleave', leave)
    return () => {
      host.removeEventListener('mouseenter', enter)
      host.removeEventListener('mouseleave', leave)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const year = item.release_date ? String(item.release_date).slice(0, 4) : null
  const match = rating ? `${Math.min(98, Math.round(Number(rating) * 10 + 20))}% Match` : null

  return (
    <span ref={card} className={`pv-card${open ? ' open' : ''}`} aria-hidden={!open}>
      <span
        className="pv-thumb"
        style={{ backgroundImage: `url(${img(item.thumbnail_url || item.poster_url)})` }}
      />
      <span className="pv-body">
        <span className="pv-actions">
          <span className="pv-play" title="Play">
            <IconPlay size={14} />
          </span>
          <span className="pv-icon" title="Add to My List">
            <IconPlus size={14} />
          </span>
        </span>
        <span className="pv-name">{item.name}</span>
        <span className="pv-meta">
          {match && <span className="pv-match">{match}</span>}
          {year && <span>{year}</span>}
          {item.duration && <span>{item.duration}</span>}
          {item.language && <span style={{ textTransform: 'capitalize' }}>{item.language}</span>}
        </span>
      </span>
    </span>
  )
}

export function LiveChannelCard({ channel }: { channel: any }) {
  return (
    <Link to={`/channel/${channel.id}` as any} className="p-card live-card">
      <span className="p-poster" style={{ backgroundImage: `url(${img(channel.poster_url)})` }}>
        <span className="live-badge">LIVE</span>
      </span>
      <span className="p-name">{channel.name}</span>
    </Link>
  )
}

export function HeroSlider({
  slides,
  baseFor,
  ctaLabel = 'Play Now',
  genres,
  live = false,
}: {
  slides: any[]
  baseFor: (item: any) => string
  ctaLabel?: string
  genres?: any[]
  live?: boolean
}) {
  const [slide, setSlide] = useState(0)
  if (!slides.length) return null
  const idx = Math.min(slide, slides.length - 1)
  const hero = slides[idx]

  if (live) {
    return (
      <section className="hero hero-live">
        <div key={hero.id} className="hero-bg" style={{ backgroundImage: `url(${img(hero.thumbnail_url || hero.poster_url)})` }} />
        <span className="live-badge hero-live-badge">LIVE</span>
        {slides.length > 1 && (
          <>
            <button className="hero-chevron prev" aria-label="Previous" onClick={() => setSlide((idx - 1 + slides.length) % slides.length)}>
              <IconChevronLeft />
            </button>
            <button className="hero-chevron next" aria-label="Next" onClick={() => setSlide((idx + 1) % slides.length)}>
              <IconChevronRight />
            </button>
          </>
        )}
        <div className="hero-live-content">
          {hero.category && <div className="hero-live-cat">{hero.category}</div>}
          <h1 className="hero-live-title">{hero.name}</h1>
          <Link to={`${baseFor(hero)}/${hero.id}` as any} className="btn btn-play">
            <IconPlay /> Play Now
          </Link>
        </div>
        {slides.length > 1 && (
          <div className="hero-dots hero-dots-center">
            {slides.map((_: any, i: number) => (
              <button key={i} className={i === idx ? 'active' : ''} aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="hero">
      <div key={hero.id} className="hero-bg" style={{ backgroundImage: `url(${img(hero.thumbnail_url || hero.poster_url)})` }} />
      {slides.length > 1 && (
        <>
          <button className="hero-chevron prev" aria-label="Previous" onClick={() => setSlide((idx - 1 + slides.length) % slides.length)}>
            <IconChevronLeft />
          </button>
          <button className="hero-chevron next" aria-label="Next" onClick={() => setSlide((idx + 1) % slides.length)}>
            <IconChevronRight />
          </button>
        </>
      )}
      <div key={`content-${hero.id}`} className="hero-content hero-stagger">
        {genres && genres.length > 0 && (
          <div className="hero-genres">
            {genres.slice(0, 3).map((g: any) => <span key={g.id ?? g.name}>{g.name}</span>)}
          </div>
        )}
        <h1 className="hero-title">{hero.name}</h1>
        {hero.description && <p className="hero-desc">{plainText(hero.description)}</p>}
        <div className="hero-meta">
          {hero.release_date && <span><IconCalendar /> {String(hero.release_date).slice(0, 4)}</span>}
          {hero.language && <span><IconGlobe /> {hero.language}</span>}
          {hero.duration && <span><IconClock /> {hero.duration}</span>}
          {baseFor(hero) !== '/video' && (hero.IMDb_rating || hero.imdb_rating) && (
            <span><IconStar /> {hero.IMDb_rating ?? hero.imdb_rating} (IMDb)</span>
          )}
        </div>
        <div className="hero-actions">
          <Link to={`${baseFor(hero)}/${hero.id}` as any} className="btn btn-dark btn-circle" aria-label="Add to watchlist">
            <IconPlus />
          </Link>
          <Link to={`${baseFor(hero)}/${hero.id}` as any} className="btn btn-play">
            <IconPlay /> {ctaLabel}
          </Link>
          <button className="btn btn-dark btn-circle" aria-label="Share">
            <IconShare />
          </button>
        </div>
      </div>
      {slides.length > 1 && (
        <div className="hero-dots">
          {slides.map((_: any, i: number) => (
            <button key={i} className={i === idx ? 'active' : ''} aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} />
          ))}
        </div>
      )}
    </section>
  )
}

export function Top10Card({ item, rank, base }: { item: any; rank: number; base: string }) {
  const rating = item.type === 'video' ? null : ratingOf(item)
  return (
    <Link to={`${base}/${item.id}` as any} className="top10-item">
      <span className="top10-rank">{rank}</span>
      <span className="p-poster" style={{ backgroundImage: `url(${img(item.poster_url)})` }}>
        {rating && (
          <span className="p-rating">
            <IconStar size={10} /> {rating}
          </span>
        )}
      </span>
    </Link>
  )
}

export function CircleCard({ name, image, to }: { name: string; image?: string | null; to?: string }) {
  const inner = (
    <>
      <img src={img(image)} alt={name} loading="lazy" />
      <div className="c-name">{name}</div>
    </>
  )
  return to ? <Link to={to as any} className="c-circle">{inner}</Link> : <div className="c-circle">{inner}</div>
}

export function Rail({ title, seeAll, children, wide }: { title: string; seeAll?: string; children: any; wide?: boolean }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {seeAll ? <Link to={seeAll as any}>View All</Link> : null}
      </div>
      <div className="rail" style={wide ? { gridAutoColumns: '300px' } : undefined}>{children}</div>
    </section>
  )
}

// backwards-compatible alias used by list pages
export function ContentCard({ item, base }: { item: any; base: string }) {
  return <PosterCard item={item} base={base} />
}
