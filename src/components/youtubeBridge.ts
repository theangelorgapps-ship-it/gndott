import { parsePlayerTiming, type PlayerBridge } from './playerBridge'

type YouTubePlayer = { playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void; mute(): void; unMute(): void; setVolume(level: number): void; getCurrentTime(): number; getDuration(): number; getPlayerState(): number; isMuted(): boolean; getVolume(): number; destroy(): void }
type YouTubeAPI = { Player: new (iframe: HTMLIFrameElement, options: { events: { onReady(): void; onStateChange(event: { data: number }): void; onError(): void } }) => YouTubePlayer }
type YouTubeWindow = Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void }
let loading: Promise<YouTubeAPI> | null = null
function loadAPI() {
  const host = window as YouTubeWindow
  if (host.YT?.Player) return Promise.resolve(host.YT)
  if (!loading) loading = new Promise<YouTubeAPI>((resolve, reject) => {
    const previous = host.onYouTubeIframeAPIReady
    const script = document.createElement('script')
    const finish = (error?: Error) => {
      clearTimeout(timeout)
      host.onYouTubeIframeAPIReady = previous
      script.onerror = null
      if (error || !host.YT?.Player) { loading = null; script.remove(); reject(error ?? new Error('Video API unavailable.')) }
      else resolve(host.YT)
    }
    const timeout = window.setTimeout(() => finish(new Error('Video API timed out.')), 10000)
    host.onYouTubeIframeAPIReady = () => { try { previous?.() } finally { finish() } }
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => finish(new Error('Video API unavailable.'))
    document.head.appendChild(script)
  })
  return loading
}

/** Official iframe API events and observed media time, never elapsed wall time.
 * https://developers.google.com/youtube/iframe_api_reference
 * Native YouTube controls stay available when API loading is blocked. */
export function createYouTubeBridge(iframe: HTMLIFrameElement, handlers: Parameters<typeof import('./playerBridge').createPlayerBridge>[1]): PlayerBridge {
  let player: YouTubePlayer | null = null, active = true, ready = false, timer: ReturnType<typeof setInterval> | undefined
  const methods = new Set(['play', 'pause', 'setCurrentTime', 'mute', 'unmute', 'setVolume', 'getCurrentTime', 'getDuration', 'getPaused', 'getMuted', 'getVolume'])
  const timing = () => {
    if (!active || !ready || !player) return
    const value = parsePlayerTiming({ seconds: player.getCurrentTime(), duration: player.getDuration() })
    if (value) handlers.timing(value)
  }
  const stop = () => { clearInterval(timer); timer = undefined }
  const bridge: PlayerBridge = {
    play: () => { if (ready) player?.playVideo() }, pause: () => { if (ready) player?.pauseVideo() },
    seek: seconds => { if (ready && Number.isFinite(seconds)) player?.seekTo(Math.max(0, seconds), true) },
    mute: muted => { if (ready) muted ? player?.mute() : player?.unMute() },
    volume: level => { if (ready && Number.isFinite(level)) player?.setVolume(Math.max(0, Math.min(1, level)) * 100) },
    get: (method, callback) => {
      if (!ready || !player) return
      callback(method === 'getDuration' ? player.getDuration() : method === 'getCurrentTime' ? player.getCurrentTime() : method === 'getPaused' ? player.getPlayerState() !== 1 : method === 'getMuted' ? player.isMuted() : player.getVolume())
    },
    supports: method => methods.has(method),
    destroy: () => { active = false; stop(); player?.destroy(); player = null },
  }
  const url = new URL(iframe.src)
  url.searchParams.set('enablejsapi', '1'); url.searchParams.set('origin', window.location.origin)
  if (iframe.src !== url.href) iframe.src = url.href
  void loadAPI().then(api => {
    if (!active) return
    player = new api.Player(iframe, { events: {
      onReady: () => { if (active) { ready = true; handlers.ready(bridge) } },
      onStateChange: ({ data }) => {
        if (!active || !ready) return
        stop()
        if (data === 1) { handlers.play(); timing(); timer = setInterval(timing, 1000) }
        else if (data === 2) { timing(); handlers.pause() }
        else if (data === 0) { timing(); handlers.ended() }
      },
      onError: () => { stop(); if (active) handlers.error() },
    } })
  }).catch(() => { if (active) handlers.error() })
  return bridge
}
