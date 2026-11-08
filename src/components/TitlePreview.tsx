import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { youtubeId } from './Detail'
import { createPreviewPlayback } from './previewPlayback'
import { createPlayerBridge, type PlayerBridge } from './playerBridge'

function directSource(value?: string | null) {
  return /^https?:\/\/.*\.(mp4|webm|m4v|m3u8)(?:[?#]|$)/i.test(value ?? '') ? value! : null
}

export function TitlePreview({ title, trailerUrl, directVideoUrl, bunnyLibraryId, bunnyTrailerId }: {
  title: string; trailerUrl?: string | null; directVideoUrl?: string | null; bunnyLibraryId?: string | null; bunnyTrailerId?: string | null
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const directRef = useRef<ReturnType<typeof createPreviewPlayback> | null>(null)
  const bridgeRef = useRef<PlayerBridge | null>(null)
  const [eligible, setEligible] = useState(false)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(true)
  const youtube = youtubeId(trailerUrl)
  const bunny = bunnyLibraryId && bunnyTrailerId ? `https://iframe.mediadelivery.net/embed/${encodeURIComponent(bunnyLibraryId)}/${encodeURIComponent(bunnyTrailerId)}?autoplay=true&muted=true&loop=true&preload=true&controls=false&playsinline=true` : null
  const dedicatedDirect = directSource(trailerUrl)
  // Only the parent can supply an entitled full source. Dedicated trailers keep their identity.
  const direct = dedicatedDirect || (!bunny && !youtube ? directSource(directVideoUrl) : null)
  const src = !direct ? bunny || (youtube ? `https://www.youtube.com/embed/${youtube}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtube}&rel=0&enablejsapi=1&playsinline=1` : null) : null

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEligible(!reduced.matches && !document.hidden)
    const stop = () => setPaused(true)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 })
    if (hostRef.current) observer.observe(hostRef.current)
    reduced.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('gndott:playback-open', stop)
    update()
    return () => { observer.disconnect(); reduced.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('gndott:playback-open', stop) }
  }, [])
  const playing = eligible && visible && !paused && !failed

  useEffect(() => {
    if (!playing || !direct || !videoRef.current) return
    setReady(false); setMuted(true)
    const controller = createPreviewPlayback(videoRef.current, direct, {
      ready: () => setReady(true), muted: setMuted, failure: () => setFailed(true),
    }, undefined, { start: dedicatedDirect ? 0 : 30, volume: .3 })
    directRef.current = controller
    return () => { controller.destroy(); directRef.current = null }
  }, [playing, direct, dedicatedDirect])

  useEffect(() => {
    if (!playing || !src || !iframeRef.current || !bunny) return
    setReady(false); setMuted(true)
    let active = true
    let started = false
    let fallback: ReturnType<typeof setTimeout> | undefined
    const bridge = createPlayerBridge(iframeRef.current, {
      ready: (player) => {
        const canSetVolume = player.supports('setVolume')
        player.volume(.3); player.mute(!canSetVolume); player.play()
        setMuted(!canSetVolume)
        fallback = setTimeout(() => { if (active && !started) { player.mute(true); setMuted(true); player.play() } }, 1000)
      },
      play: () => { if (active) { started = true; setReady(true) } },
      pause: () => { if (active && !started) { bridge.mute(true); setMuted(true); bridge.play() } },
      ended: () => { if (active) { bridge.seek(0); bridge.play() } },
      timing: () => { if (active) { started = true; setReady(true) } },
      error: () => { if (active) setFailed(true) },
    })
    bridgeRef.current = bridge
    return () => { active = false; clearTimeout(fallback); bridge.pause(); bridge.destroy(); bridgeRef.current = null }
  }, [playing, src, bunny])

  // YouTube retains its policy-safe muted autoplay. Its visible sound button is a user gesture.
  const youtubeCommand = (func: string, args: unknown[] = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com')
  function sound() {
    if (directRef.current) { void directRef.current.sound(muted); return }
    if (bridgeRef.current) { bridgeRef.current.volume(.3); bridgeRef.current.mute(!muted); bridgeRef.current.play() }
    else if (youtube) { youtubeCommand('setVolume', [30]); youtubeCommand(muted ? 'unMute' : 'mute'); youtubeCommand('playVideo') }
    setMuted(!muted)
  }
  if (!src && !direct) return null
  return <>
    <div ref={hostRef} className={`tv-title-preview${ready && playing ? ' is-ready' : ''}`}>
      {playing && (src ? <iframe ref={iframeRef} src={src} title={`Background preview for ${title}`} allow="autoplay; encrypted-media" tabIndex={-1} aria-hidden="true" onLoad={() => { if (youtube) setReady(true) }} />
        : <video ref={videoRef} playsInline preload="none" aria-hidden="true" />)}
    </div>
    {eligible && !failed && <div className="tv-title-preview-controls">
      <button type="button" className="tv-detail-utility" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play background preview' : 'Pause background preview'}>{paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} />}</button>
      {!paused && <button type="button" className="tv-detail-utility" onClick={sound} disabled={!ready} aria-label={muted ? 'Enable preview sound' : 'Mute preview sound'} aria-pressed={!muted}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>}
    </div>}
  </>
}
