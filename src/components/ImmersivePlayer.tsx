import { TitlePeople } from './TitlePeople'
import { SeekPreview } from './SeekPreview'
import { LiquidNavbar } from './ui/liquid-glass-navbar'
import { ChoicePicker } from './ui/choice-picker'
import '../player-chat-refinement.css'
import '../release2-experience.css'
import '../player-interaction.css'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, X, SlidersHorizontal, PictureInPicture2 } from 'lucide-react'
import { BiblePanel, ContentNotes, youtubeId, type WatchSectionProps } from './Detail'
import { img, plainText } from './Poster'
import { createPlayerBridge, type PlayerBridge } from './playerBridge'
import { createYouTubeBridge } from './youtubeBridge'
import { usePlaybackProgress } from '../hooks/usePlaybackProgress'
import { useTypingViewport } from '../hooks/useTypingViewport'
import { PlayerLoading } from './PlayerLoading'
import { createResumeController } from './playbackResume'
import { createDirectPlayback, type DirectPlayback, type VideoQuality } from './directPlayback'
import { PlaybackEndScreen } from './PlaybackEndScreen'
import { nearPlaybackEnd } from './playbackEnding'

import { liveWindow, liveEmbedUrl } from '../lib/liveSources'
import { createIdleControls, createPlaybackWakeLock, supportsPictureInPicture, isPictureInPicture, togglePictureInPicture } from './playerCapabilities'

type Panel = 'comments' | 'notes' | 'bible' | 'info' | null
export function playbackTime(value: number) {
  const seconds = Math.floor(Number.isFinite(value) ? Math.max(0, value) : 0)
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
function mediaUrl(value?: string | null) {
  if (!value) return null
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null } catch { return null }
}
export function ImmersivePlayer(props: WatchSectionProps) {
  const { initialAutoPlay = false, live = false, liveDiscussion, contentId, contentType, title, poster, description, metadata = [], bunnyLibraryId, bunnyVideoId, trailerUrl, directVideoUrl, viewerId } = props
  const stageRef = useRef<HTMLDivElement>(null)
  useTypingViewport(stageRef)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bridgeRef = useRef<PlayerBridge | null>(null)
  const directRef = useRef<DirectPlayback | null>(null)
  const initialPlayback = useRef<{ transport: DirectPlayback | PlayerBridge | null; cancelled: boolean }>({ transport: null, cancelled: false })
  const resumeLoaded = useRef(false)
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(true)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const lastVolume = useRef(1)
  const scrubbing = useRef(false)
  const holdingControl = useRef(false)
  const pendingSeek = useRef<{ target: number; expires: number } | null>(null)
  const pausedIntent = useRef(true)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [ended, setEnded] = useState(false)
  const [endingDismissed, setEndingDismissed] = useState(false)
  const [seekPreview, setSeekPreview] = useState<{ time: number; percent: number } | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [providerControls, setProviderControls] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [providerFallback, setProviderFallback] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [qualities, setQualities] = useState<VideoQuality[]>([])
  const [quality, setQuality] = useState(-1)
  const [speed, setSpeed] = useState(1)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaPlaying, setMediaPlaying] = useState(false)
  const [message, setMessage] = useState('')
  const [controlsVisible, setControlsVisible] = useState(true)
  const idleControls = useRef<ReturnType<typeof createIdleControls> | null>(null)
  const wakeLock = useRef<ReturnType<typeof createPlaybackWakeLock> | null>(null)
  const [pipSupported, setPipSupported] = useState(false)
  const [pipActive, setPipActive] = useState(false)
  const [pipBusy, setPipBusy] = useState(false)
  const observed = useRef({ position: 0, duration: 0, hasPlayed: false })
  const resumeRef = useRef<ReturnType<typeof createResumeController> | null>(null)
  if (!resumeRef.current) resumeRef.current = createResumeController({
    seek: (seconds) => { if (bridgeRef.current) bridgeRef.current.seek(seconds); else if (videoRef.current) videoRef.current.currentTime = seconds },
    status: setMessage,
  })
  const [retry, setRetry] = useState(0)
  const [windowStart, setWindowStart] = useState(0)
  const progress = usePlaybackProgress({ contentType, contentId }, !live && viewerId != null)
  const progressRef = useRef(progress)
  progressRef.current = progress
  const candidate = mediaUrl(directVideoUrl) || mediaUrl(trailerUrl)
  const liveEmbed = live ? liveEmbedUrl(candidate) : null
  const direct = !liveEmbed && !providerFallback && candidate && (live || /\.(mp4|webm|ogg|m4v|m3u8)(?:[?#]|$)/i.test(candidate)) ? candidate : null
  const hasBunny = !liveEmbed && !direct && !!(bunnyLibraryId && bunnyVideoId)
  const yt = !hasBunny && !direct ? youtubeId(trailerUrl) : null
  const source = liveEmbed || (hasBunny ? `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${bunnyVideoId}?autoplay=false&preload=true&responsive=true&compactControls=true&showSpeed=false&showHeatmap=false` : yt ? `https://www.youtube.com/embed/${yt}?autoplay=0&rel=0&enablejsapi=1` : null)
  const customControls = !liveEmbed && !yt && (ready || !!direct) && !fallback && !providerControls
  const idleState = useRef({ settingsOpen })
  idleState.current = { settingsOpen }

  useEffect(() => {
    const controls = createIdleControls(setControlsVisible, () => {
      const state = idleState.current
      const focused = document.activeElement
      const surface = stageRef.current?.closest('.tv-playback-surface') ?? stageRef.current
      const keyboardFocused = focused instanceof HTMLElement && surface?.contains(focused) && focused.matches(':focus-visible')
        && !!focused.closest('.tv-playback-heading, .tv-player-center, .tv-player-tools, .tv-player-timeline, .tv-player-settings, .tv-player-panel-transport')
      return !state.settingsOpen && !keyboardFocused && !holdingControl.current && !scrubbing.current
    })
    idleControls.current = controls
    const wake = createPlaybackWakeLock(navigator, document)
    wakeLock.current = wake
    const releaseGesture = () => {
      if (!holdingControl.current) return
      holdingControl.current = false
      controls.reveal()
    }
    const reveal = () => controls.reveal()
    const surface = stageRef.current?.closest('.tv-playback-surface')
    surface?.addEventListener('pointermove', reveal)
    surface?.addEventListener('focusin', reveal)
    surface?.addEventListener('pointerdown', reveal)
    surface?.addEventListener('keydown', reveal)
    window.addEventListener('pointerup', releaseGesture)
    window.addEventListener('pointercancel', releaseGesture)
    return () => {
      surface?.removeEventListener('pointermove', reveal)
      surface?.removeEventListener('focusin', reveal)
      surface?.removeEventListener('pointerdown', reveal)
      surface?.removeEventListener('keydown', reveal)
      window.removeEventListener('pointerup', releaseGesture)
      window.removeEventListener('pointercancel', releaseGesture)
      controls.destroy(); wake.destroy(); idleControls.current = null; wakeLock.current = null
    }
  }, [])
  useEffect(() => { wakeLock.current?.setPlaying(mediaPlaying && !fallback) }, [mediaPlaying, fallback])
  useEffect(() => {
    const video = videoRef.current
    setPipSupported(!!direct && supportsPictureInPicture(video, document))
    const update = () => setPipActive(isPictureInPicture(video, document))
    update()
    for (const name of ['enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged']) video?.addEventListener(name, update)
    return () => { for (const name of ['enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged']) video?.removeEventListener(name, update) }
  }, [direct, ready])


  const updateTiming = useCallback((seconds: number, total: number) => {
    if (live) {
      const range = videoRef.current && liveWindow(videoRef.current.seekable)
      if (!range || !Number.isFinite(seconds)) return
      observed.current = { ...observed.current, position: seconds, duration: range.end }
      setWindowStart(range.start); setDuration(range.end)
      const pending = pendingSeek.current
      if (pending && (Math.abs(seconds - pending.target) < 2 || Date.now() >= pending.expires)) pendingSeek.current = null
      if (!scrubbing.current && !pendingSeek.current) setPosition(seconds)
      return
    }
    if (!Number.isFinite(seconds) || !Number.isFinite(total) || total <= 0) return
    observed.current.position = Math.max(0, Math.min(seconds, total))
    observed.current.duration = total
    const pending = pendingSeek.current
    if (pending && (Math.abs(seconds - pending.target) < 2 || Date.now() >= pending.expires)) pendingSeek.current = null
    if (!scrubbing.current && !pendingSeek.current) setPosition(observed.current.position)
    setDuration(total)
    const resumeConfirmed = resumeRef.current!.observe(seconds, total, observed.current.hasPlayed)
    if (observed.current.hasPlayed && resumeConfirmed && !scrubbing.current && !pendingSeek.current) progressRef.current.record(seconds, total)
  }, [live])
  const flushObserved = useCallback(() => {
    if (live) return
    const actual = observed.current
    if (actual.hasPlayed && !resumeRef.current!.pending() && !scrubbing.current && !pendingSeek.current) progressRef.current.record(actual.position, actual.duration, true)
  }, [live])
  useEffect(() => {
    return () => { flushObserved() }
  }, [flushObserved])

  useEffect(() => {
    if (!direct || !videoRef.current) return
    const player = createDirectPlayback(videoRef.current, direct, {
      qualities: setQualities,
      blocked: () => { pausedIntent.current = true; setPaused(true); setMediaPlaying(false); setMediaLoading(false); setMessage('Press Play again to start this video.') },
      failure: () => {
        setMediaPlaying(false)
        if (live) { pausedIntent.current = true; setPaused(true); directRef.current?.pause() }
        setMediaLoading(false)
        setReady(false)
        setQualities([])
        setSettingsOpen(false)
        if (bunnyLibraryId && bunnyVideoId) {
          if (observed.current.hasPlayed && observed.current.position >= 5) { resumeRef.current!.reset({ position: observed.current.position, duration: observed.current.duration }); resumeLoaded.current = true }
          setProviderFallback(true)
          setMessage('Opening the video provider’s player…')
        } else { setFallback(true); setMessage(live ? 'The live stream is unavailable or has ended. Try reconnecting.' : 'This video could not be loaded. Try its original link.') }
      },
    }, undefined, undefined, live)
    directRef.current = player
    return () => { player.destroy(); directRef.current = null }
  }, [direct, bunnyLibraryId, bunnyVideoId, live, retry])

  useEffect(() => {
    if ((!hasBunny && !yt) || !iframeRef.current) return
    let active = true
    const fail = () => { if (active) { setFallback(true); setMessage(yt ? 'Use the video player’s controls to watch. Progress cannot be saved until the video connection is restored.' : 'Use the video player’s controls to watch.'); } }
    const timeout = setTimeout(fail, 8000)
    const bridge = (yt ? createYouTubeBridge : createPlayerBridge)(iframeRef.current, {
      ready: (player) => {
        if (!active) return
        clearTimeout(timeout)
        setReady(true)
        setFallback(false)
        setMessage('')
        player.get('getDuration', (value) => { if (active && Number.isFinite(Number(value))) setDuration(Number(value)) })
        player.get('getPaused', (value) => { if (active) { pausedIntent.current = Boolean(value); setPaused(Boolean(value)) } })
        player.get('getMuted', (value) => { if (active) setMuted(Boolean(value)) })
        player.get('getVolume', (value) => { if (active && Number.isFinite(Number(value))) { const level = Math.max(0, Math.min(1, Number(value) / 100)); setVolume(level); if (level > 0) lastVolume.current = level } })
      },
      play: () => { if (active) { pausedIntent.current = false; observed.current.hasPlayed = true; setPaused(false); setMediaPlaying(true); resumeRef.current!.onPlay(); } },
      pause: () => { if (active) { pausedIntent.current = true; setPaused(true); setMediaPlaying(false); flushObserved(); } },
      ended: () => { if (active) { pausedIntent.current = true; setPaused(true); setMediaPlaying(false); setEnded(true); flushObserved(); } },
      timing: ({ seconds, duration: total }) => { if (active) updateTiming(seconds, total) },
      error: fail,
    })
    bridgeRef.current = bridge
    return () => { active = false; clearTimeout(timeout); bridge.destroy(); bridgeRef.current = null }
  }, [hasBunny, yt, source, flushObserved, updateTiming])

  const seek = useCallback((next: number) => {
    if (!ready || !Number.isFinite(next)) return
    setEnded(false)
    setEndingDismissed(false)
    resumeRef.current!.cancel()
    const range = live && videoRef.current ? liveWindow(videoRef.current.seekable) : null
    const clamped = Math.max(range ? range.start : 0, Math.min(next, range ? range.edge : observed.current.duration || duration || 0))
    pendingSeek.current = { target: clamped, expires: Date.now() + 4000 }
    setPosition(clamped)
    if (bridgeRef.current && ready) bridgeRef.current.seek(clamped)
    else if (videoRef.current && ready) videoRef.current.currentTime = clamped
  }, [duration, ready, live])
  useEffect(() => {
    if (live || !ready || !progress.loaded || resumeLoaded.current) return
    resumeLoaded.current = true
    if (observed.current.hasPlayed && !resumeRef.current!.pending()) resumeRef.current!.cancel()
    else resumeRef.current!.restore(progress.saved)
  }, [ready, progress.loaded, progress.saved, live])

  function play(initial = false) {
    if ((!ready && !direct) || fallback) return
    if (ended) { seek(0); setEnded(false) }
    if (!initial) initialPlayback.current.cancelled = true
    // A provider cannot report autoplay rejection through its command API.
    // Keep its Play button available until an actual play event confirms it.
    if (!initial || directRef.current) { pausedIntent.current = false; setPaused(false) }
    setMessage('')
    if (!live && progress.loaded && !resumeLoaded.current) { resumeLoaded.current = true; resumeRef.current!.restore(progress.saved) }
    if (directRef.current) { setMediaLoading(true); void directRef.current.play() }
    else if (bridgeRef.current) bridgeRef.current.play()
  }
  useEffect(() => {
    const transport = directRef.current || (ready ? bridgeRef.current : null)
    if (!initialAutoPlay || fallback || (!live && !progress.loaded) || !transport || observed.current.hasPlayed || initialPlayback.current.cancelled || initialPlayback.current.transport === transport) return
    // One attempt per transport, including a freshly recreated Strict Mode
    // transport or provider fallback. Browser policy denial never retries.
    initialPlayback.current.transport = transport
    play(true)
  }, [initialAutoPlay, direct, ready, fallback, live, progress.loaded])
  function togglePlay() {
    initialPlayback.current.cancelled = true
    if (pausedIntent.current) play()
    else {
      pausedIntent.current = true
      setPaused(true)
      setMediaLoading(false)
      if (bridgeRef.current) bridgeRef.current.pause()
      else directRef.current?.pause()
    }
  }
  function changeVolume(next: number) {
    const level = Math.max(0, Math.min(1, next))
    if (level > 0) lastVolume.current = level
    setVolume(level)
    setMuted(level === 0)
    if (bridgeRef.current) { bridgeRef.current.volume(level); bridgeRef.current.mute(level === 0) }
    else if (videoRef.current) { videoRef.current.volume = level; videoRef.current.muted = level === 0 }
  }
  function toggleMuted() {
    if (volume === 0) { changeVolume(lastVolume.current || 1); return }
    const next = !muted
    setMuted(next)
    if (bridgeRef.current) {
      bridgeRef.current.mute(next)
    } else if (videoRef.current) videoRef.current.muted = next
  }
  function continueWatching(fromBeginning = false) {
    if (fromBeginning) seek(live ? duration : 0)
    setPanel(null)
    if (pausedIntent.current) play()
  }
  function revealControls() {
    idleControls.current?.reveal()
  }
  useEffect(() => { revealControls() }, [panel, settingsOpen])

  async function togglePip() {
    setPipBusy(true)
    setMessage('')
    try { await togglePictureInPicture(videoRef.current, document); setPipActive(isPictureInPicture(videoRef.current, document)) }
    catch (error) { setMessage(error instanceof Error && /Start the video|not available/.test(error.message) ? error.message : 'Picture in picture could not open. Try again after the video starts.') }
    finally { setPipBusy(false) }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    revealControls()
    if (panel || !customControls || (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')))) return
    if (event.key === ' ' || event.key.toLowerCase() === 'k') { event.preventDefault(); togglePlay() }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); seek(position - 10) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); seek(position + 10) }
    else if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleMuted() }
    revealControls()
  }
  const hasSource = !!(source || direct)
  const showEnding = !live && customControls && !panel && !endingDismissed && (ended || nearPlaybackEnd(position, duration, observed.current.hasPlayed))
  const showOverlay = controlsVisible || !!panel || settingsOpen || !customControls || showEnding
  const transportHidden = !controlsVisible && hasSource && !fallback && !showEnding
  return (
    <div ref={stageRef} className={`tv-immersive-player${live ? ' is-live' : ''}${panel ? ' panel-open' : ''}${showEnding ? ' ending-open' : ''}${customControls ? ' has-custom-controls' : ' provider-controls'}${showOverlay ? ' controls-visible' : ''}${transportHidden ? ' transport-hidden' : ''}`} data-lenis-prevent tabIndex={0} aria-label={`${title} video player`} onKeyDown={onKeyDown} onPointerMove={revealControls} onFocusCapture={revealControls} onBlurCapture={revealControls}
      onPointerDownCapture={() => { holdingControl.current = true; revealControls() }}
      onPointerUpCapture={() => { holdingControl.current = false; revealControls() }}
      onPointerCancel={() => { holdingControl.current = false; scrubbing.current = false; setPosition(observed.current.position); revealControls() }}>
      <div className="tv-player-media">
        {source ? <iframe ref={iframeRef} src={source} title={title} onPointerEnter={revealControls} onFocus={revealControls} onLoad={() => { if (liveEmbed) setReady(true) }} sandbox={liveEmbed ? "allow-scripts allow-same-origin allow-presentation" : undefined} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen tabIndex={customControls ? -1 : 0} /> : direct ? <video ref={videoRef} poster={img(poster)} controls={!customControls} playsInline preload="metadata" onLoadedMetadata={(event) => { setReady(true); updateTiming(event.currentTarget.currentTime, event.currentTarget.duration) }} onRateChange={(event) => setSpeed(event.currentTarget.playbackRate)} onPlaying={() => { setMediaPlaying(true); setMediaLoading(false) }} onWaiting={() => setMediaLoading(true)} onTimeUpdate={(event) => updateTiming(event.currentTarget.currentTime, event.currentTarget.duration)} onPlay={() => { pausedIntent.current = false; observed.current.hasPlayed = true; setPaused(false); if (!live) resumeRef.current!.onPlay() }} onPause={() => { pausedIntent.current = true; setMediaPlaying(false); setMediaLoading(false); setPaused(true); flushObserved() }} onEnded={() => { pausedIntent.current = true; setMediaPlaying(false); setMediaLoading(false); setPaused(true); if (!live) setEnded(true); flushObserved(); if (live) { setFallback(true); setMessage('This broadcast has ended. Reconnect when it resumes.') } }} onVolumeChange={(event) => { setMuted(event.currentTarget.muted); setVolume(event.currentTarget.volume) }} onError={() => { setMediaPlaying(false); setMediaLoading(false); if (bunnyLibraryId && bunnyVideoId) { setReady(false); setProviderFallback(true); setMessage('Opening the video provider’s player…') } else { setFallback(true); setMessage(live ? 'The live stream is unavailable or has ended. Try reconnecting.' : 'This video could not be loaded. Try its original link.') } }} /> : <img className="tv-player-poster" src={img(poster)} alt="" />}
        {(mediaLoading || (!ready && !fallback && hasSource)) && <PlayerLoading kind="video" label="Loading video…" />}
        {panel && customControls && <button className="tv-player-panel-transport" type="button" onClick={togglePlay} aria-label={paused ? 'Play video while reading' : 'Pause video while reading'}>{paused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}</button>}
      </div>
      {transportHidden && !customControls && <div className="tv-player-wake-zone" aria-hidden="true" onPointerMove={revealControls} onPointerDown={revealControls} />}
      {customControls && <div className="tv-player-scrim" aria-hidden="true" />}
      {customControls && !panel && !showEnding && <div className="tv-player-center">
        <button type="button" onClick={() => seek(position - 10)} aria-label="Rewind 10 seconds" disabled={!duration || (live && duration - windowStart <= 30)}><RotateCcw size={29} /><span>10</span></button>
        <button type="button" className="tv-player-toggle" onClick={togglePlay} aria-label={paused ? 'Play video' : 'Pause video'} aria-busy={mediaLoading}>{paused ? <Play size={48} fill="currentColor" /> : <Pause size={48} fill="currentColor" />}</button>
        <button type="button" onClick={() => seek(position + 10)} aria-label="Forward 10 seconds" disabled={!duration || (live && duration - windowStart <= 30)}><RotateCw size={29} /><span>10</span></button>
      </div>}
      {!hasSource && <div className="tv-player-no-source"><p>No playable source is available for this title.</p>{candidate && <a href={candidate} target="_blank" rel="noreferrer">Open original video ↗</a>}</div>}
      <div className="tv-player-bottom" inert={showEnding} aria-hidden={showEnding || undefined}>
        {!panel && <>
          <div className="tv-player-title-row"><h2>{title}</h2><div className="tv-player-tools">
            {pipSupported && <button type="button" aria-label={pipActive ? 'Exit picture in picture' : 'Picture in picture'} aria-pressed={pipActive} disabled={!ready || pipBusy} onClick={() => void togglePip()}><PictureInPicture2 size={22} /></button>}
            {(ready || direct) && (!live || qualities.length > 0) && <button type="button" aria-expanded={direct ? settingsOpen : undefined} aria-pressed={!direct ? providerControls : undefined} aria-label={direct ? 'Playback settings' : providerControls ? 'Use cinema controls' : 'Open video player options'} onClick={() => direct ? setSettingsOpen(!settingsOpen) : setProviderControls(!providerControls)}><SlidersHorizontal size={20} /></button>}
            {customControls && (!hasBunny || bridgeRef.current?.supports('mute')) && <div className="tv-player-volume">
              <button type="button" aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'} onClick={toggleMuted}>{muted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
              {(!hasBunny || bridgeRef.current?.supports('setVolume')) && <input type="range" aria-label="Volume" aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} percent`} min={0} max={1} step={.01} value={muted ? 0 : volume} onChange={event => changeVolume(Number(event.target.value))} />}
            </div>}
          </div></div>
          {customControls && live && <button className="tv-go-live" type="button" onClick={() => seek(duration)} disabled={!ready}><i />{duration - position > 10 ? 'Back to live' : 'LIVE'}</button>}
          {customControls && (!live || duration - windowStart > 30) && <div className="tv-player-timeline">{seekPreview && !live && <SeekPreview source={direct} time={seekPreview.time} duration={duration} percent={seekPreview.percent} label={playbackTime(seekPreview.time)} />}<input type="range" aria-label="Playback position" aria-valuetext={live ? `${playbackTime(duration - position)} behind live` : `${playbackTime(position)} of ${playbackTime(duration)}`} min={live ? windowStart : 0} max={duration || 1} step={1} value={position} disabled={!duration}
            onPointerMove={event => { if (!live && duration) { const rect = event.currentTarget.getBoundingClientRect(); const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); setSeekPreview({ time: ratio * duration, percent: ratio * 100 }) } }}
            onPointerLeave={() => { if (!scrubbing.current) setSeekPreview(null) }}
            onPointerCancel={() => { scrubbing.current = false; setSeekPreview(null) }}
            onPointerDown={event => { scrubbing.current = true; event.currentTarget.setPointerCapture(event.pointerId) }}
            onChange={event => { const next = Number(event.target.value); setPosition(next); if (!live) setSeekPreview({ time: next, percent: next / (duration || 1) * 100 }); if (!scrubbing.current) seek(next) }}
            onPointerUp={event => { setSeekPreview(null); if (scrubbing.current) { scrubbing.current = false; seek(Number(event.currentTarget.value)) } }}
            onBlur={event => { setSeekPreview(null); if (scrubbing.current) { scrubbing.current = false; seek(Number(event.currentTarget.value)) } }}
          /><div><span>{live ? 'DVR' : playbackTime(position)}</span><span>−{playbackTime(duration - position)}{live ? ' from live' : ''}</span></div></div>}
        </>}
        {settingsOpen && direct && <div className="tv-player-settings glass-playback-settings" role="group" aria-label="Playback settings">
          <header><strong>Playback</strong><button type="button" aria-label="Close playback settings" onClick={() => setSettingsOpen(false)}><X size={19} /></button></header>
          <div className="glass-playback-choices">
            {!live && <ChoicePicker label="Speed" value={String(speed)} options={[.5, .75, 1, 1.25, 1.5, 2].map(rate => ({ value: String(rate), label: rate === 1 ? 'Normal' : `${rate}×` }))} onChange={next => { if (videoRef.current) videoRef.current.playbackRate = Number(next) }} />}
            {qualities.length > 0 && <ChoicePicker label="Quality" value={String(quality)} options={[{ value: '-1', label: 'Auto' }, ...qualities.map(level => ({ value: String(level.index), label: level.label }))]} onChange={next => { const index = Number(next); directRef.current?.quality(index); setQuality(index) }} />}
          </div>
        </div>}
        <LiquidNavbar className="tv-player-tabs" tone="dark" label="Player information"
          active={panel ? (live ? ['comments', 'bible', 'info'] : ['notes', 'bible', 'info']).indexOf(panel) : -1}
          items={[
            ...(live ? [{ label: 'Comments', ariaLabel: 'Live discussion' }] : [{ label: 'Notes' }]),
            { label: 'Bible' }, { label: 'Info' },
            ...(panel ? [{ label: customControls ? 'Continue Watching' : 'Return to Video', className: 'tv-player-continue', action: true }] : []),
          ]}
          onChange={index => {
            if (index === 3) { continueWatching(); return }
            const key = (live ? ['comments', 'bible', 'info'] : ['notes', 'bible', 'info'])[index] as Exclude<Panel, null>
            setPanel(current => current === key ? null : key)
          }} />
        {panel && <section className="tv-player-panel" aria-label={panel === 'comments' ? 'Live discussion' : panel === 'info' ? 'Title information' : panel === 'notes' ? 'Your notes' : 'Bible reading'}>
          {panel !== 'comments' && <button type="button" className="tv-player-panel-close" aria-label="Close information panel" onClick={() => setPanel(null)}><X size={19} /></button>}
          {panel === 'comments' ? liveDiscussion : panel === 'info' ? <div className="tv-player-info"><img src={img(props.portrait || poster)} alt="" /><div><h3>{title}</h3><p>{plainText(description) || 'No description is available for this title.'}</p>{metadata.filter(Boolean).length > 0 && <p className="tv-player-meta">{metadata.filter(Boolean).join(' · ')}</p>}</div>{Boolean(props.locations?.length) && <TitlePeople locations={props.locations} />}<div className="tv-player-info-actions">{customControls && <><button type="button" onClick={() => continueWatching(true)}><Play size={17} fill="currentColor" /> {live ? 'Back to live' : 'From Beginning'}</button><button type="button" onClick={() => continueWatching()}>Continue Watching</button></>}</div></div> : panel === 'notes' ? <ContentNotes contentType={contentType} contentId={contentId} title={title} /> : <BiblePanel />}
        </section>}
        {!live && progress.saveRequirement && <p className="tv-player-status"><a href={progress.saveRequirement === 'profile' ? '/manage-profile' : '/login'}>{progress.saveRequirement === 'profile' ? 'Choose a profile to save your place' : 'Sign in to save your place'}</a></p>}
        {progress.loadError && <p className="tv-player-status" role="status">Your viewing activity could not load. Reopen this title to save progress.</p>}
        {(message || progress.saveError) && <p className="tv-player-status" role="status">{message || 'Your latest progress could not be saved. We’ll try again as you watch.'}</p>}
        {fallback && live && <button type="button" className="btn btn-primary" onClick={() => { setFallback(false); setReady(false); setPaused(true); pausedIntent.current = true; setMessage('Press Play to reconnect.'); setRetry(n => n + 1) }}>Reconnect stream</button>}
        {fallback && !live && candidate && <a className="tv-player-original" href={candidate} target="_blank" rel="noreferrer">Open original video ↗</a>}
      </div>
      {showEnding && <PlaybackEndScreen title={title} poster={poster} metadata={metadata} contentType={contentType} contentId={contentId} recommendations={props.recommendations} upNext={props.upNext} ended={ended}
        onReplay={() => { seek(0); setEnded(false); play() }} onDismiss={() => setEndingDismissed(true)} onNavigate={props.onNavigate} />}
    </div>
  )
}
