import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { youtubeId } from './Detail'
import { createPreviewPlayback, deferHeroPreview } from './previewPlayback'
import { createPlayerBridge, type PlayerBridge } from './playerBridge'
import '../release2-experience.css'
import '../queued-player.css'

function directSource(value?: string | null) {
  return /^https?:\/\/.*\.(mp4|webm|m4v|m3u8)(?:[?#]|$)/i.test(value ?? '') ? value! : null
}

export function TitlePreview({ title, trailerUrl, directVideoUrl, bunnyLibraryId, bunnyTrailerId, bunnyVideoId, suspended = false, startSeconds = 30 }: {
  title: string; trailerUrl?: string | null; directVideoUrl?: string | null; bunnyLibraryId?: string | null; bunnyTrailerId?: string | null; bunnyVideoId?: string | null; suspended?: boolean; startSeconds?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const directRef = useRef<ReturnType<typeof createPreviewPlayback> | null>(null)
  const bridgeRef = useRef<PlayerBridge | null>(null)
  const [eligible, setEligible] = useState(false)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(true)
  const [delayElapsed, setDelayElapsed] = useState(false)
  const [requestedPlay, setRequestedPlay] = useState(false)
  const youtube = youtubeId(trailerUrl)
  const previewBunnyId = bunnyTrailerId || (!youtube && !directSource(trailerUrl) && !directSource(directVideoUrl) ? bunnyVideoId : null)
  const bunny = bunnyLibraryId && previewBunnyId ? `https://iframe.mediadelivery.net/embed/${encodeURIComponent(bunnyLibraryId)}/${encodeURIComponent(previewBunnyId)}?autoplay=true&muted=true&loop=true&preload=true&controls=false&playsinline=true&responsive=true` : null
  const dedicatedDirect = directSource(trailerUrl)
  // Only the parent can supply an entitled full source. Dedicated trailers keep their identity.
  const direct = dedicatedDirect || (!bunny && !youtube ? directSource(directVideoUrl) : null)
  const src = !direct ? bunny || (youtube ? `https://www.youtube.com/embed/${youtube}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtube}&rel=0&enablejsapi=1&playsinline=1` : null) : null

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEligible(!document.hidden && (!reduced.matches || requestedPlay))
    const stop = () => {
      directRef.current?.destroy(); directRef.current = null
      bridgeRef.current?.pause()
      if (youtube) iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube.com')
      setPaused(true)
    }
    const competing = (event: Event) => { if ((event as CustomEvent).detail !== hostRef.current) stop() }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 })
    if (hostRef.current) observer.observe(hostRef.current)
    reduced.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('gndott:playback-open', stop)
    window.addEventListener('gndott:preview-active', competing)
    update()
    return () => { observer.disconnect(); reduced.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('gndott:playback-open', stop); window.removeEventListener('gndott:preview-active', competing) }
  }, [requestedPlay])
  const waiting = eligible && visible && !paused && !failed && !suspended && !!(src || direct)
  useEffect(() => {
    setDelayElapsed(false)
    setReady(false)
    if (!waiting) return
    const begin = () => {
      // A carousel slide can mount while the full player is already open.
      if (document.querySelector('.tv-playback-dialog[open]')) { setPaused(true); return }
      window.dispatchEvent(new CustomEvent('gndott:preview-active', { detail: hostRef.current }))
      setDelayElapsed(true)
    }
    if (requestedPlay) { begin(); return }
    return deferHeroPreview(begin)
  }, [waiting, direct, src, requestedPlay])
  const playing = waiting && delayElapsed

  useEffect(() => {
    if (!playing || !direct || !videoRef.current) return
    setReady(false); setMuted(true)
    const controller = createPreviewPlayback(videoRef.current, direct, {
      ready: () => setReady(true), muted: setMuted, failure: () => setFailed(true),
    }, undefined, { start: dedicatedDirect ? 0 : startSeconds, volume: .3, sound: false })
    directRef.current = controller
    return () => { controller.destroy(); directRef.current = null }
  }, [playing, direct, dedicatedDirect, startSeconds])

  useEffect(() => {
    if (!playing || !src || !iframeRef.current || !bunny) return
    setReady(false); setMuted(true)
    let active = true
    let started = false
    let fallback: ReturnType<typeof setTimeout> | undefined
    const bridge = createPlayerBridge(iframeRef.current, {
      ready: (player) => {
        // Embedded providers cannot report rejected audible play promises.
        // Start policy-safe and only enable sound from the visible user control.
        player.volume(.3); player.mute(true); player.play()
        setMuted(true)
        fallback = setTimeout(() => { if (active && !started) { player.mute(true); setMuted(true); player.play() } }, 1000)
      },
      play: () => { if (active) { started = true; setReady(true) } },
      pause: () => {},
      ended: () => { if (active) { bridge.seek(0); bridge.play() } },
      timing: () => {},
      error: () => { if (active) setFailed(true) },
    })
    bridgeRef.current = bridge
    return () => { active = false; clearTimeout(fallback); bridge.pause(); bridge.destroy(); bridgeRef.current = null }
  }, [playing, src, bunny])

  useEffect(() => {
    if (!playing || !youtube) return
    const receive = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com' || event.source !== iframeRef.current?.contentWindow) return
      let data: any
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch { return }
      if (data?.event === 'onStateChange' && data.info === 1 || data?.info?.playerState === 1) setReady(true)
      if (typeof data?.info?.muted === 'boolean') setMuted(data.info.muted)
      if (data?.event === 'onError') setFailed(true)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [playing, youtube])

  // YouTube retains its policy-safe muted autoplay. Its visible sound button is a user gesture.
  const youtubeCommand = (func: string, args: unknown[] = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com')
  function sound() {
    if (directRef.current) { void directRef.current.sound(muted); return }
    if (bridgeRef.current) { bridgeRef.current.volume(.3); bridgeRef.current.mute(!muted); bridgeRef.current.play(); bridgeRef.current.get('getMuted', value => setMuted(Boolean(value))); return }
    else if (youtube) { youtubeCommand('setVolume', [30]); youtubeCommand(muted ? 'unMute' : 'mute'); youtubeCommand('playVideo') }
    setMuted(!muted)
  }
  if (!src && !direct) return null
  return <>
    <div ref={hostRef} data-preview-state={playing ? ready ? 'playing' : 'loading' : waiting ? 'waiting' : 'poster'} className={`tv-title-preview${ready && playing ? ' is-ready' : ''}`}>
      {playing && (src ? <iframe ref={iframeRef} src={src} title={`Background preview for ${title}`} allow="autoplay; encrypted-media" tabIndex={-1} aria-hidden="true" onLoad={() => { if (youtube) { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube.com'); youtubeCommand('addEventListener', ['onStateChange']); youtubeCommand('addEventListener', ['onError']) } }} />
        : <video ref={videoRef} muted playsInline preload="none" aria-hidden="true" />)}
    </div>
    <div className="tv-title-preview-controls">
      <button type="button" className="tv-detail-utility" onClick={() => { if (playing) setPaused(true); else { setFailed(false); setRequestedPlay(true); setPaused(false) } }} aria-label={playing ? 'Pause background preview' : 'Play background preview'}>{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
      <button type="button" className="tv-detail-utility" onClick={sound} disabled={!ready || !playing} aria-label={muted ? 'Enable preview sound' : 'Mute preview sound'} aria-pressed={!muted}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
    </div>
  </>
}
