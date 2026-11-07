import { Link } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import manifest from '../lib/img-manifest.json'

export const DEFAULT_IMG = '/default-image.jpg'
const PREVIEW_DELAY_MS = 3000
const ADVANCE_DELAY_MS = 8000
const HERO_START_SECONDS = 80
const VIEWPORT_GUTTER = 12

const MANIFEST = manifest as Record<string, string>

export function img(url: string | null | undefined): string {
  if (!url) return DEFAULT_IMG
  if (url.startsWith('/images/') || url.startsWith('/media/')) return url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
      const base = url.split('/').pop() ?? url
      const stem = base.replace(/\.(png|jpe?g|webp)$/i, '')
      return MANIFEST[base] ?? MANIFEST[stem] ?? DEFAULT_IMG
    }
    return url
  }
  const base = url.split('/').pop() ?? url
  const stem = base.replace(/\.(png|jpe?g|webp)$/i, '')
  return MANIFEST[base] ?? MANIFEST[stem] ?? DEFAULT_IMG
}

export function contentBase(type: unknown) {
  return type === 'teaching' ? '/teaching'
    : type === 'tvshow' || type === 'show' ? '/tv-show'
      : type === 'video' ? '/video'
        : type === 'channel' || type === 'live' ? '/channel'
          : '/movie'
}

export function IconPlay({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.14v14l11-7-11-7z" /></svg>
}
export function IconPlus({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
}
export function IconShare({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" strokeLinecap="round" /></svg>
}
export function IconSearch({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /></svg>
}
export function IconCalendar({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" /></svg>
}
export function IconClock({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" /></svg>
}
export function IconChevronLeft({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
export function IconChevronRight({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
export function IconCrown({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 12l-2 4H5zm0 2h14v2H5v-2z" /></svg>
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

function trailerFor(item: any): string | null {
  const value = [item?.trailer_url, item?.trailerUrl, item?.bunny_trailer_url, item?.video_url_input]
    .find((candidate) => typeof candidate === 'string' && candidate.trim())
  return typeof value === 'string' ? value.trim() : null
}

function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  return match?.[1] ?? null
}

type HeroMedia = { kind: 'video' | 'youtube' | 'bunny'; url: string }

function heroMediaFor(hero: any, muted: boolean, bunnyLibraryId?: string | null): HeroMedia | null {
  const direct = trailerFor(hero)
  const videoId = typeof hero?.bunny_video_url === 'string' ? hero.bunny_video_url.trim() : ''
  const libraryId = typeof bunnyLibraryId === 'string' ? bunnyLibraryId.trim() : ''
  const hasBunnyFallback = !!(videoId && libraryId && direct && /\.m3u8(?:$|[?#])/i.test(direct))
  if (direct && !hasBunnyFallback) {
    const yt = youtubeId(direct)
    return yt
      ? { kind: 'youtube', url: `https://www.youtube.com/embed/${yt}?autoplay=1&mute=${muted ? 1 : 0}&start=${HERO_START_SECONDS}&controls=0&playsinline=1&loop=1&playlist=${yt}&rel=0` }
      : { kind: 'video', url: direct }
  }
  if (videoId && libraryId) {
    return {
      kind: 'bunny',
      url: `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}?autoplay=true&muted=${muted}&t=${HERO_START_SECONDS}&playsinline=true&loop=true&controls=false`,
    }
  }
  return null
}

export function PosterCard({ item, base }: { item: any; base: string }) {
  const paid = item.movie_access === 'paid' || item.access === 'paid'
  return (
    <Link to={`${base}/${item.id}` as any} className="p-card" params={undefined as never}>
      <span className="p-poster" style={{ backgroundImage: `url(${img(item.poster_url)})` }}>
        {paid && <span className="p-crown" title="Premium"><IconCrown size={11} /></span>}
      </span>
      <span className="p-name">{item.name}</span>
      <HoverPreview item={item} base={base} />
    </Link>
  )
}

function previewPosition(host: HTMLElement, height = 270) {
  const rect = host.getBoundingClientRect()
  const width = Math.min(300, window.innerWidth - VIEWPORT_GUTTER * 2)
  const left = Math.max(
    VIEWPORT_GUTTER,
    Math.min(window.innerWidth - width - VIEWPORT_GUTTER, rect.left + rect.width / 2 - width / 2),
  )
  const above = rect.top - height - VIEWPORT_GUTTER
  const preferredTop = above >= VIEWPORT_GUTTER ? above : rect.bottom + VIEWPORT_GUTTER
  const top = Math.max(
    VIEWPORT_GUTTER,
    Math.min(window.innerHeight - height - VIEWPORT_GUTTER, preferredTop),
  )
  return { top, left, width }
}

/** Delayed, viewport-clamped preview. The portal avoids clipping by rails and grids. */
function HoverPreview({ item, base }: { item: any; base: string }) {
  const [open, setOpen] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [position, setPosition] = useState({ top: VIEWPORT_GUTTER, left: VIEWPORT_GUTTER, width: 300 })
  const marker = useRef<HTMLSpanElement>(null)
  const popup = useRef<HTMLAnchorElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trailer = trailerFor(item)

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (videoTimer.current) clearTimeout(videoTimer.current)
    openTimer.current = null
    closeTimer.current = null
    videoTimer.current = null
  }
  const hide = () => {
    clearTimers()
    setOpen(false)
    setVideoReady(false)
  }

  useEffect(() => {
    const host = marker.current?.closest('.p-card') as HTMLElement | null
    if (!host) return
    const enter = () => {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      clearTimers()
      setVideoReady(false)
      openTimer.current = setTimeout(() => {
        setPosition(previewPosition(host, popup.current?.offsetHeight ?? 270))
        setOpen(true)
      }, 450)
      videoTimer.current = setTimeout(() => {
        if (trailer) setVideoReady(true)
      }, 3000)
    }
    const leave = () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      closeTimer.current = setTimeout(hide, 140)
    }
    const hideOnScroll = (event: Event) => {
      if (event.target instanceof Node && popup.current?.contains(event.target)) return
      hide()
    }
    host.addEventListener('mouseenter', enter)
    host.addEventListener('mouseleave', leave)
    window.addEventListener('scroll', hideOnScroll, true)
    window.addEventListener('resize', hide)
    return () => {
      host.removeEventListener('mouseenter', enter)
      host.removeEventListener('mouseleave', leave)
      window.removeEventListener('scroll', hideOnScroll, true)
      window.removeEventListener('resize', hide)
      clearTimers()
    }
  }, [trailer])

  useLayoutEffect(() => {
    if (!open) return
    const host = marker.current?.closest('.p-card') as HTMLElement | null
    if (host) setPosition(previewPosition(host, popup.current?.offsetHeight ?? 270))
  }, [open])

  useEffect(() => () => {
    const media = popup.current?.querySelector('video')
    media?.pause()
  }, [])

  if (!open || typeof document === 'undefined') return <span ref={marker} className="pv-marker" aria-hidden="true" />
  const yt = youtubeId(trailer)
  const year = item.release_date ? String(item.release_date).slice(0, 4) : null
  const preview = (
    <Link
      ref={popup}
      to={`${base}/${item.id}` as any}
      className="pv-card open"
      style={position}
      aria-label={`Open ${item.name}`}
      data-preview-video={videoReady ? 'playing' : 'thumbnail'}
      onClick={hide}
      onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current) }}
      onMouseLeave={hide}
    >
      <span className="pv-thumb" style={{ backgroundImage: `url(${img(item.thumbnail_url || item.poster_url)})` }}>
        {videoReady && trailer && (yt ? (
          <iframe
            src={`https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0`}
            title=""
            tabIndex={-1}
            allow="autoplay; encrypted-media"
          />
        ) : (
          <video src={trailer} autoPlay muted loop playsInline preload="none" onError={() => setVideoReady(false)} />
        ))}
      </span>
      <span className="pv-body">
        <span className="pv-actions">
          <span className="pv-play" title="Open and play"><IconPlay size={14} /></span>
          <span className="pv-icon" title="Open details"><IconPlus size={14} /></span>
        </span>
        <span className="pv-name">{item.name}</span>
        <span className="pv-meta">
          {year && <span>{year}</span>}
          {item.duration && <span>{item.duration}</span>}
        </span>
      </span>
    </Link>
  )
  return <><span ref={marker} className="pv-marker" aria-hidden="true" />{createPortal(preview, document.body)}</>
}

export function LiveChannelCard({ channel }: { channel: any }) {
  return (
    <Link to={`/channel/${channel.id}` as any} className="p-card live-card">
      <span className="p-poster" style={{ backgroundImage: `url(${img(channel.poster_url)})` }}><span className="live-badge">LIVE</span></span>
      <span className="p-name">{channel.name}</span>
    </Link>
  )
}

function HeroPreview({ hero, preview, media, mediaRef, muted }: {
  hero: any
  preview: boolean
  media: HeroMedia | null
  mediaRef: React.RefObject<HTMLVideoElement | null>
  muted: boolean
}) {
  if (!preview || !media) return null
  return (
    <div className="hero-preview" aria-hidden="true">
      {media.kind === 'video' ? (
        <video
          key={`${hero.id}-${media.url}`}
          ref={mediaRef}
          src={media.url}
          poster={img(hero.thumbnail_url || hero.poster_url)}
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="none"
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = HERO_START_SECONDS
          }}
        />
      ) : (
        <iframe
          key={`${hero.id}-${media.kind}-${media.url}`}
          src={media.url}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media"
        />
      )}
    </div>
  )
}

export function HeroSlider({
  slides,
  baseFor,
  ctaLabel = 'Play Now',
  genres,
  bunnyLibraryId,
  live = false,
}: {
  slides: any[]
  baseFor: (item: any) => string
  ctaLabel?: string
  genres?: any[]
  bunnyLibraryId?: string | null
  live?: boolean
}) {
  const [slide, setSlide] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [preview, setPreview] = useState(false)
  const [muted, setMuted] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const idx = Math.min(slide, Math.max(slides.length - 1, 0))
  const hero = slides[idx]
  const media = heroMediaFor(hero, muted, bunnyLibraryId)
  const mediaIdentity = media ? `${media.kind}:${media.kind === 'video' ? media.url : hero.id}` : null

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(query.matches)
    const updateVisibility = () => {
      const visible = !document.hidden
      setPageVisible(visible)
      if (!visible) setPreview(false)
    }
    updateMotion()
    updateVisibility()
    query.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      query.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    setPreview(false)
    setMuted(true)
    const canAutoplay = !reducedMotion && pageVisible && !document.hidden && !!hero
    if (!canAutoplay) return
    let previewTimer: ReturnType<typeof setTimeout> | undefined
    let advanceTimer: ReturnType<typeof setTimeout> | undefined
    if (mediaIdentity) previewTimer = setTimeout(() => setPreview(true), PREVIEW_DELAY_MS)
    advanceTimer = setTimeout(() => {
      setPreview(false)
      setSlide((idx + 1) % slides.length)
      setCycle((value) => value + 1)
    }, ADVANCE_DELAY_MS)
    return () => {
      clearTimeout(previewTimer)
      clearTimeout(advanceTimer)
      const video = videoRef.current
      video?.pause()
      video?.removeAttribute('src')
      video?.load()
    }
  }, [cycle, hero, idx, pageVisible, reducedMotion, slides.length, mediaIdentity])

  if (!slides.length || !hero) return null
  const selectSlide = (next: number) => {
    setPreview(false)
    setMuted(true)
    setSlide(next)
    setCycle((value) => value + 1)
  }
  const previewState = reducedMotion
    ? 'reduced-motion'
    : preview && media ? media.kind
      : 'poster'
  const controls = slides.length > 1 && (
    <>
      <button className="hero-chevron prev" aria-label="Previous slide" onClick={() => selectSlide((idx - 1 + slides.length) % slides.length)}><IconChevronLeft /></button>
      <button className="hero-chevron next" aria-label="Next slide" onClick={() => selectSlide((idx + 1) % slides.length)}><IconChevronRight /></button>
    </>
  )
  const dots = slides.length > 1 && (
    <div className={`hero-dots${live ? ' hero-dots-center' : ''}`}>
      {slides.map((item: any, i: number) => (
        <button key={item.id ?? i} className={i === idx ? 'active' : ''} aria-label={`Slide ${i + 1}`} aria-current={i === idx ? 'true' : undefined} onClick={() => selectSlide(i)} />
      ))}
    </div>
  )
  const soundToggle = preview && media && (
    <button
      type="button"
      className="hero-sound-toggle"
      aria-label={muted ? 'Unmute hero preview' : 'Mute hero preview'}
      aria-pressed={!muted}
      onClick={() => setMuted((value) => !value)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinecap="round" strokeLinejoin="round" />
        {muted ? (
          <path d="m17 9 4 4m0-4-4 4" strokeLinecap="round" />
        ) : (
          <>
            <path d="M15 9a4 4 0 0 1 0 6" strokeLinecap="round" />
            <path d="M18 6a8 8 0 0 1 0 12" strokeLinecap="round" />
          </>
        )}
      </svg>
      {muted ? 'Unmute' : 'Mute'}
    </button>
  )

  if (live) {
    return (
      <section className="hero hero-live" data-hero-slide={idx} data-preview-state={previewState}>
        <div key={hero.id} className="hero-bg" style={{ backgroundImage: `url(${img(hero.thumbnail_url || hero.poster_url)})` }} />
        <HeroPreview hero={hero} preview={preview} media={media} mediaRef={videoRef} muted={muted} />
        {soundToggle}
        <span className="live-badge hero-live-badge">LIVE</span>
        {controls}
        <div className="hero-live-content">
          {hero.category && <div className="hero-live-cat">{hero.category}</div>}
          <h1 className="hero-live-title">{hero.name}</h1>
          <Link to={`${baseFor(hero)}/${hero.id}` as any} className="btn btn-play"><IconPlay /> Play Now</Link>
        </div>
        {dots}
      </section>
    )
  }

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: hero.name, url: window.location.href }).catch(() => undefined)
    } else {
      await navigator.clipboard?.writeText(window.location.href).catch(() => undefined)
    }
  }
  return (
    <section className="hero" data-hero-slide={idx} data-preview-state={previewState}>
      <div key={hero.id} className="hero-bg" style={{ backgroundImage: `url(${img(hero.thumbnail_url || hero.poster_url)})` }} />
      <HeroPreview hero={hero} preview={preview} media={media} mediaRef={videoRef} muted={muted} />
      {soundToggle}
      {controls}
      <div key={`content-${hero.id}`} className="hero-content hero-stagger">
        {genres && genres.length > 0 && <div className="hero-genres">{genres.slice(0, 3).map((g: any) => <span key={g.id ?? g.name}>{g.name}</span>)}</div>}
        <h1 className="hero-title">{hero.name}</h1>
        {hero.description && <p className="hero-desc">{plainText(hero.description)}</p>}
        <div className="hero-meta">
          {hero.release_date && <span><IconCalendar /> {String(hero.release_date).slice(0, 4)}</span>}
          {hero.duration && <span><IconClock /> {hero.duration}</span>}
        </div>
        <div className="hero-actions">
          <Link to={`${baseFor(hero)}/${hero.id}` as any} className="btn btn-dark btn-circle" aria-label={`More about ${hero.name}`}><IconPlus /></Link>
          <Link to={`${baseFor(hero)}/${hero.id}` as any} className="btn btn-play"><IconPlay /> {ctaLabel}</Link>
          <button className="btn btn-dark btn-circle" aria-label={`Share ${hero.name}`} onClick={share}><IconShare /></button>
        </div>
      </div>
      {dots}
    </section>
  )
}

type RecommendationPayload = {
  forYou?: any[]
  discovery?: any | null
  recent?: any[]
  hasHistory?: boolean
  topGenres?: string[]
}

export function RecommendationGroups({ recommendations, fallback = [], recentFallback }: {
  recommendations?: RecommendationPayload | null
  fallback?: any[]
  recentFallback?: any[]
}) {
  const forYou = recommendations?.forYou ?? fallback
  const recent = recommendations?.recent ?? recentFallback ?? fallback
  const discovery = recommendations ? recommendations.discovery : (fallback[1] ?? fallback[0] ?? null)
  const title = recommendations?.hasHistory ? 'Recommended for You' : 'Featured for You'
  return (
    <div className="recommendation-groups">
      <Rail title={title}>
        {forYou.map((item: any) => <PosterCard key={`${item.type}-${item.id}`} item={item} base={contentBase(item.type)} />)}
      </Rail>
      <div className="recommendation-discovery">
        <Rail title="Discover Something Different">
          {discovery ? <PosterCard key={`${discovery.type}-${discovery.id}`} item={discovery} base={contentBase(discovery.type)} /> : <p className="rail-empty">A new selection will appear here.</p>}
        </Rail>
      </div>
      <Rail title="Recently Updated">
        {recent.map((item: any) => <PosterCard key={`${item.type}-${item.id}`} item={item} base={contentBase(item.type)} />)}
      </Rail>
    </div>
  )
}

export function Top10Card({ item, rank, base }: { item: any; rank: number; base: string }) {
  return <Link to={`${base}/${item.id}` as any} className="top10-item"><span className="top10-rank">{rank}</span><span className="p-poster" style={{ backgroundImage: `url(${img(item.poster_url)})` }} /></Link>
}

export function CircleCard({ name, image, to }: { name: string; image?: string | null; to?: string }) {
  const inner = <><img src={img(image)} alt={name} loading="lazy" /><div className="c-name">{name}</div></>
  return to ? <Link to={to as any} className="c-circle">{inner}</Link> : <div className="c-circle">{inner}</div>
}

export function Rail({ title, seeAll, children, wide }: { title: string; seeAll?: string; children: any; wide?: boolean }) {
  return (
    <section className="section">
      <div className="section-head"><h2>{title}</h2>{seeAll ? <Link to={seeAll as any}>View All</Link> : null}</div>
      <div className="rail" style={wide ? { gridAutoColumns: '300px' } : undefined}>{children}</div>
    </section>
  )
}

export function ContentCard({ item, base }: { item: any; base: string }) {
  return <PosterCard item={item} base={base} />
}
