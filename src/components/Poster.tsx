import { ScrollRail } from './ScrollRail'
import { contentPath } from '@/lib/contentRoutes'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createPreviewPlayback } from './previewPlayback'
import manifest from '../lib/img-manifest.json'
import { getWatchlist, toggleWatchlist } from '../lib/api'
import { Check, Info, Pause, Volume2, VolumeX } from 'lucide-react'

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
export function IconSearch({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /></svg>
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
    .find((candidate) => typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim()))
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
  if (direct) {
    const yt = youtubeId(direct)
    return yt
      ? { kind: 'youtube', url: `https://www.youtube.com/embed/${yt}?autoplay=1&mute=${muted ? 1 : 0}&start=${HERO_START_SECONDS}&controls=0&playsinline=1&loop=1&playlist=${yt}&rel=0` }
      : { kind: 'video', url: direct }
  }
  const videoId = typeof hero?.bunny_video_url === 'string' ? hero.bunny_video_url.trim() : ''
  const libraryId = typeof bunnyLibraryId === 'string' ? bunnyLibraryId.trim() : ''
  if (videoId && libraryId) {
    return {
      kind: 'bunny',
      url: `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}?autoplay=true&muted=${muted}&t=${HERO_START_SECONDS}&playsinline=true&loop=true&controls=false`,
    }
  }
  return null
}

export function PosterCard({ item, base, landscape = false, badge }: { item: any; base: string; landscape?: boolean; badge?: string }) {
  const paid = item.movie_access === 'paid' || item.access === 'paid'
  return (
    <Link to={contentPath(item,base) as any} className={`p-card${landscape ? ' p-card-landscape' : ''}`} params={undefined as never}>
      <span className="p-poster"><img src={img(landscape ? item.thumbnail_url || item.poster_url : item.poster_url)} alt="" width={landscape ? 480 : 200} height={landscape ? 270 : 300} loading="lazy" decoding="async" />
        {paid && <span className="p-crown" title="Premium"><IconCrown size={11} /></span>}
        {badge && <span className="p-upload-badge">{badge}</span>}
      </span>
      <span className="p-name">{item.name}</span>
      <HoverPreview item={item} base={base} />
    </Link>
  )
}

function previewPosition(host: HTMLElement, height = 270) {
  const rect = host.getBoundingClientRect()
  const width = Math.min(420, window.innerWidth - VIEWPORT_GUTTER * 2)
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

/** Portal previews stay inside the viewport and release media on every close. */
function HoverPreview({ item, base }: { item: any; base: string }) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(true)
  const [failed, setFailed] = useState(false)
  const [position, setPosition] = useState({ top: 12, left: 12, width: 420 })
  const marker = useRef<HTMLSpanElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const playback = useRef<ReturnType<typeof createPreviewPlayback> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideRef = useRef<() => void>(() => {})
  const trailer = trailerFor(item)
  const direct = trailer && !youtubeId(trailer) ? trailer : null

  useEffect(() => {
    const host = marker.current?.closest('.p-card') as HTMLElement | null
    if (!host) return
    let removal: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let present = false
    const hide = () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      cancelAnimationFrame(frame)
      if (!present) return
      present = false
      clearTimeout(removal)
      playback.current?.destroy(); playback.current = null
      setOpen(false)
      removal = setTimeout(() => { setMounted(false); setReady(false) }, 220)
    }
    hideRef.current = hide
    const enter = () => {
      if (!window.matchMedia('(min-width: 861px) and (hover: hover) and (pointer: fine)').matches) return
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (!present) {
        clearTimeout(removal)
        present = true
        window.dispatchEvent(new CustomEvent('halo-preview', { detail: host }))
        setPosition(previewPosition(host, 300))
        setMounted(true); setFailed(false)
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setOpen(true)) })
      }
    }
    const leave = () => { closeTimer.current = setTimeout(hide, 180) }
    const other = (event: Event) => { if ((event as CustomEvent).detail !== host) hide() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    const blur = (event: FocusEvent) => { if (!host.contains(event.relatedTarget as Node) && !popup.current?.contains(event.relatedTarget as Node)) leave() }
    host.addEventListener('focusout', blur)
    host.addEventListener('mouseenter', enter)
    host.addEventListener('focusin', enter)
    host.addEventListener('mouseleave', leave)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    window.addEventListener('halo-preview', other)
    window.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', hide)
    return () => {
      clearTimeout(removal); cancelAnimationFrame(frame)
      if (closeTimer.current) clearTimeout(closeTimer.current)
      host.removeEventListener('focusout', blur)
      host.removeEventListener('mouseenter', enter); host.removeEventListener('mouseleave', leave); host.removeEventListener('focusin', enter)
      window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide)
      window.removeEventListener('halo-preview', other); window.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [])

  useEffect(() => {
    if (!open || !direct || !video.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setReady(false); setMuted(true)
    const controller = createPreviewPlayback(video.current, direct, { ready: () => setReady(true), muted: setMuted, failure: () => setFailed(true) })
    playback.current = controller
    return () => { controller.destroy(); if (playback.current === controller) playback.current = null }
  }, [open, direct])

  const year = item.release_date ? String(item.release_date).slice(0, 4) : null
  return <><span ref={marker} className="pv-marker" aria-hidden="true" />{mounted && createPortal(
    <div ref={popup} className={`pv-card halo-preview${open ? ' open' : ''}`} style={position} onClick={(event) => event.stopPropagation()} role="region" aria-label={`${item.name} preview`}
      onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current) }}
      onMouseLeave={() => { closeTimer.current = setTimeout(() => hideRef.current(), 180) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) hideRef.current() }}>
      <img className="halo-preview-art" src={img(item.thumbnail_url || item.poster_url)} alt="" />
      {direct && <video ref={video} className={ready && !failed ? 'is-ready' : ''} playsInline preload="none" aria-hidden="true" />}
      {direct && !failed && <button className="halo-preview-sound liquid-glass" type="button" aria-label={muted ? 'Enable preview sound' : 'Mute preview sound'} aria-pressed={!muted} disabled={!ready} onClick={() => void playback.current?.sound(muted)}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}<span>{muted ? 'Sound on' : 'Mute'}</span></button>}
      <div className="halo-preview-gradient">
        <strong className="pv-name">{item.name}</strong>
        <span className="pv-meta">{year && <span>{year}</span>}{item.duration && <span>{item.duration}</span>}</span>
        <div className="pv-actions">
          <Link className="halo-preview-play" to={contentPath(item,base) as any} hash="watch" onClick={() => hideRef.current()}><IconPlay size={18} /> Watch now</Link>
          <Link className="halo-preview-info" to={contentPath(item,base) as any} aria-label={`Details for ${item.name}`} onClick={() => hideRef.current()}><Info size={22} /></Link>
        </div>
      </div>
    </div>, document.body)}</>
}

export function LiveChannelCard({ channel }: { channel: any }) {
  return (
    <Link to={contentPath(channel,'/channel') as any} className="p-card live-card">
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
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(false) }, [hero?.id, preview])
  if (!preview || !media) return null
  return (
    <div className={`hero-preview${ready ? ' is-ready' : ''}`} aria-hidden="true">
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
          onCanPlay={() => setReady(true)}
          onError={() => setReady(false)}
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = Math.min(HERO_START_SECONDS, Math.max(0, event.currentTarget.duration - 1))
          }}
        />
      ) : (
        <iframe
          key={`${hero.id}-${media.kind}-${media.url}`}
          onLoad={() => setReady(true)}
          src={media.url}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media"
        />
      )}
    </div>
  )
}

function heroGenres(item: any): string[] {
  const raw = item.genre_names ?? item.genres
  const values = Array.isArray(raw) ? raw.map((genre: any) => typeof genre === 'string' ? genre : genre.name) : typeof raw === 'string' ? raw.split(',') : []
  return [...new Set(values.filter(Boolean).map((value: string) => value.trim()))] as string[]
}

function contentKind(item: any, live: boolean): string {
  if (live) return 'Live TV'
  return ({ movie: 'Sermon', tvshow: 'TV Show', show: 'TV Show', teaching: 'Teaching', video: 'Video' } as Record<string, string>)[item.type] ?? 'Sermon'
}

export function HeroSlider({ slides, baseFor, ctaLabel = 'Play', bunnyLibraryId, live = false }: {
  slides: any[]
  baseFor: (item: any) => string
  ctaLabel?: string
  genres?: any[]
  bunnyLibraryId?: string | null
  live?: boolean
}) {
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)
  const [preview, setPreview] = useState(false)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)
  const [desktopPreview, setDesktopPreview] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [saved, setSaved] = useState<number[]>([])
  const [libraryReady, setLibraryReady] = useState(false)
  const [libraryFailed, setLibraryFailed] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const idx = Math.min(slide, Math.max(slides.length - 1, 0))
  const hero = slides[idx]
  const media = heroMediaFor(hero, muted, bunnyLibraryId)
  const mediaIdentity = media ? `${media.kind}:${media.kind === 'video' ? media.url : hero.id}` : null

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = window.matchMedia('(min-width: 861px) and (hover: hover)')
    const update = () => { setReducedMotion(motion.matches); setDesktopPreview(desktop.matches) }
    const visibility = () => setPageVisible(!document.hidden)
    update(); visibility()
    motion.addEventListener('change', update)
    desktop.addEventListener('change', update)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      motion.removeEventListener('change', update)
      desktop.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  useEffect(() => {
    if (live) return
    let active = true
    getWatchlist().then((result) => {
      if (active) { setSaved(result.items.map((item: any) => Number(item.id))); setLibraryReady(true) }
    }).catch(() => { if (active) setLibraryFailed(true) })
    return () => { active = false }
  }, [live])

  useEffect(() => {
    setPreview(false)
    if (reducedMotion || paused || interacting || !pageVisible || !hero) return
    const previewTimer = desktopPreview && mediaIdentity ? setTimeout(() => setPreview(true), PREVIEW_DELAY_MS) : undefined
    const advanceTimer = slides.length > 1 ? setTimeout(() => {
      setMuted(true)
      setSlide((idx + 1) % slides.length)
    }, ADVANCE_DELAY_MS) : undefined
    return () => { clearTimeout(previewTimer); clearTimeout(advanceTimer); videoRef.current?.pause() }
  }, [idx, slides.length, reducedMotion, paused, interacting, pageVisible, desktopPreview, mediaIdentity])

  if (!slides.length || !hero) return null
  const selectSlide = (next: number) => {
    setPreview(false)
    setMuted(true)
    setPaused(true)
    setSaveStatus('')
    setSlide((next + slides.length) % slides.length)
  }
  const addToLibrary = async (item: any) => {
    if (saving !== null) return
    setSaving(Number(item.id))
    setPaused(true)
    setSaveStatus('')
    try {
      const result = await toggleWatchlist({ data: { entertainmentId: Number(item.id) } })
      if (result.needsAuth) { await navigate({ to: '/login' }); return }
      if (result.needsProfile) { await navigate({ to: '/manage-profile' }); return }
      if (result.ok) {
        setSaved((previous) => result.added ? [...previous.filter((id) => id !== Number(item.id)), Number(item.id)] : previous.filter((id) => id !== Number(item.id)))
        setSaveStatus(result.added ? 'Added to your library' : 'Removed from your library')
      } else setSaveStatus('Could not update your library. Please try again.')
    } catch { setSaveStatus('Could not update your library. Please try again.') }
    finally { setSaving(null) }
  }

  return (
    <section className={`hero tv-hero${live ? ' hero-live' : ''}`} aria-roledescription="carousel" aria-label={live ? 'Featured live channels' : 'Featured titles'}
      data-hero-slide={idx} data-preview-state={reducedMotion ? 'reduced-motion' : preview && desktopPreview && !paused ? media?.kind ?? 'poster' : 'poster'}
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false) }}
      onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY } }}
      onTouchEnd={(event) => {
        const start = touchStart.current; touchStart.current = null
        if (!start) return
        const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) selectSlide(idx + (dx < 0 ? 1 : -1))
      }}>
      <div className="hero-artwork" aria-hidden="true">
        {slides.map((item, index) => <picture key={`${item.type}-${item.id}`} className={`hero-artwork-layer${index === idx ? ' is-active' : ''}`}>
          <source media="(max-width: 860px)" srcSet={img(item.poster_url || item.thumbnail_url)} />
          <img src={img(item.thumbnail_url || item.poster_url)} alt="" fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" />
        </picture>)}
      </div>
      <HeroPreview hero={hero} preview={preview && desktopPreview && !paused && !interacting && pageVisible && !reducedMotion} media={media} mediaRef={videoRef} muted={muted} />
      {slides.map((item, index) => {
        const inLibrary = saved.includes(Number(item.id))
        const canSave = !live && !libraryFailed && !['/video', '/channel'].includes(baseFor(item))
        return <div key={`copy-${item.type}-${item.id}`} className={`hero-content tv-hero-content${index === idx ? ' is-active' : ''}`} aria-hidden={index !== idx} inert={index !== idx}>
          {(live || item.movie_access === 'paid' || item.access === 'paid') && <span className="hero-badge">{live ? 'Live' : 'Premium'}</span>}
          <h1 className="hero-title">{item.name}</h1>
          <div className="hero-meta">
            <span>{contentKind(item, live)}</span>
            {heroGenres(item).slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)}
            {!heroGenres(item).length && item.release_date && <span>{String(item.release_date).slice(0, 4)}</span>}
          </div>
          {item.description && <p className="hero-desc">{plainText(item.description)}</p>}
          <div className="hero-actions">
            <Link to={contentPath(item,baseFor(item)) as any} hash="watch" className="btn hero-play"><IconPlay size={21} />{ctaLabel}</Link>
            {canSave ? <button type="button" className="btn hero-library" disabled={!libraryReady || saving !== null} aria-label={`${inLibrary ? 'Remove' : 'Add'} ${item.name} ${inLibrary ? 'from' : 'to'} library`} aria-pressed={inLibrary} onClick={() => void addToLibrary(item)}>{inLibrary ? <Check size={24} /> : <IconPlus size={25} />}</button>
              : <Link to={contentPath(item,baseFor(item)) as any} className="btn hero-library" aria-label={`More about ${item.name}`}><Info size={24} /></Link>}
          </div>
        </div>
      })}
      {slides.length > 1 && <>
        <button type="button" className="hero-chevron prev" aria-label="Previous featured title" onClick={() => selectSlide(idx - 1)}><IconChevronLeft /></button>
        <button type="button" className="hero-chevron next" aria-label="Next featured title" onClick={() => selectSlide(idx + 1)}><IconChevronRight /></button>
        <div className="hero-dots">{slides.map((item, index) => <button type="button" key={`${item.type}-${item.id}`} className={index === idx ? 'active' : ''} aria-label={`Show ${item.name}`} aria-current={index === idx ? 'true' : undefined} onClick={() => selectSlide(index)}><span /></button>)}</div>
        {!reducedMotion && <button type="button" className="hero-pause" aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'} aria-pressed={paused} onClick={() => { setInteracting(false); setPaused((value) => !value) }}>{paused ? <IconPlay size={15} /> : <Pause size={15} />}</button>}
      </>}
      {preview && desktopPreview && !paused && <button type="button" className="hero-sound-toggle" aria-label={muted ? 'Unmute preview' : 'Mute preview'} aria-pressed={!muted} onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
      <p className="hero-save-status" role="status">{saveStatus}</p>
    </section>
  )
}

type RecommendationPayload = {
  forYou?: any[]
  discovery?: any | null
  discoveries?: any[]
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
  const discoveries = recommendations?.discoveries ?? (discovery ? [discovery, ...fallback.filter(item => item.id !== discovery.id)].slice(0,8) : [])
  const title = recommendations?.hasHistory ? 'Recommended for You' : 'Featured for You'
  return (
    <div className="recommendation-groups">
      <Rail title={title}>
        {forYou.map((item: any) => <PosterCard key={`${item.type}-${item.id}`} item={item} base={contentBase(item.type)} />)}
      </Rail>
      <div className="recommendation-discovery">
        <Rail title="Discover Something Different">
          {discoveries.length ? discoveries.map(item => <PosterCard key={`${item.type}-${item.id}`} item={item} base={contentBase(item.type)} landscape />) : <p className="rail-empty">A new selection will appear here.</p>}
        </Rail>
      </div>
      <Rail title="Recently Updated">
        {recent.map((item: any) => <PosterCard key={`${item.type}-${item.id}`} item={item} base={contentBase(item.type)} badge="Recently Uploaded" />)}
      </Rail>
    </div>
  )
}

export function Top10Card({ item, rank, base }: { item: any; rank: number; base: string }) {
  return <Link to={contentPath(item,base) as any} className="top10-item" aria-label={`${rank}. ${item.name}`}><span className="top10-rank" aria-hidden="true">{rank}</span><span className="p-poster"><img src={img(item.poster_url)} alt="" width={200} height={300} loading="lazy" decoding="async" /></span></Link>
}

export function CircleCard({ name, image, to }: { name: string; image?: string | null; to?: string }) {
  const inner = <><img src={img(image)} alt={name} loading="lazy" /><div className="c-name">{name}</div></>
  return to ? <Link to={to as any} className="c-circle">{inner}</Link> : <div className="c-circle">{inner}</div>
}

export function Rail({ title, seeAll, children, wide }: { title: string; seeAll?: string; children: any; wide?: boolean }) {
  return (
    <section className="section">
      <div className="section-head"><h2>{title}</h2>{seeAll ? <Link to={seeAll as any}>View All</Link> : null}</div>
      <ScrollRail label={`${title} titles`} style={wide ? { gridAutoColumns: 'var(--wide-card-size, 300px)' } : undefined}>{children}</ScrollRail>
    </section>
  )
}
