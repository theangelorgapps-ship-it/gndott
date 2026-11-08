import type Hls from 'hls.js'
export type VideoQuality = { index: number; label: string }
export type DirectPlayback = { play: () => Promise<void>; pause: () => void; quality: (index: number) => void; destroy: () => void }

/** Direct delivery stays behind WatchSection's entitlement gate. HLS is fetched
 * on user playback intent and never uses a client-side Bunny API key. */
export function prefersNativeHls() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/.test(ua))
}
export function createDirectPlayback(video: HTMLVideoElement, url: string, callbacks: {
  qualities: (levels: VideoQuality[]) => void
  failure: () => void
  blocked: () => void
}, loadHls: () => Promise<{ default: typeof Hls }> = () => import('hls.js'), preferNative = prefersNativeHls(), forceHls = false): DirectPlayback {
  let disposed = false
  let hls: Hls | null = null
  let initialized: Promise<void> | null = null
  let playRequest = 0
  async function initialize() {
    if ((!forceHls && !/\.m3u8(?:[?#]|$)/i.test(url)) || (preferNative && video.canPlayType('application/vnd.apple.mpegurl'))) {
      video.src = url
      video.load()
      return
    }
    const { default: HlsClass } = await loadHls()
    if (disposed) return
    if (!HlsClass.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; video.load(); return }
      throw new Error('HLS is unsupported')
    }
    hls = new HlsClass({ enableWorker: true })
    hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
      if (disposed || !hls) return
      callbacks.qualities(hls.levels.map((level, index) => ({ index, label: level.height ? `${level.height}p` : level.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : `Stream ${index + 1}` })))
    })
    hls.on(HlsClass.Events.ERROR, (_event, data) => { if (!disposed && data.fatal) callbacks.failure() })
    hls.attachMedia(video)
    hls.loadSource(url)
  }
  return {
    async play() {
      if (disposed) return
      const request = ++playRequest
      try {
        initialized ??= initialize()
        await initialized
        if (!disposed && request === playRequest) await video.play()
      } catch (error) {
        if (disposed || request !== playRequest) return
        if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) callbacks.blocked()
        else callbacks.failure()
      }
    },
    pause() { playRequest++; video.pause() },
    quality(index) {
      if (hls && Number.isInteger(index) && (index === -1 || (index >= 0 && index < hls.levels.length))) hls.currentLevel = index
    },
    destroy() { disposed = true; hls?.destroy(); hls = null; video.pause(); video.removeAttribute('src'); video.load() },
  }
}
