export const PLAYER_IDLE_MS = 1820

/** A single idle deadline; an active gesture or keyboard focus never disappears. */
export function createIdleControls(show: (visible: boolean) => void, canHide: () => boolean, clock = {
  set: (callback: () => void, delay: number) => setTimeout(callback, delay),
  clear: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const clear = () => { if (timer !== undefined) clock.clear(timer); timer = undefined }
  return {
    reveal() {
      if (disposed) return
      clear(); show(true)
      timer = clock.set(() => { timer = undefined; if (!disposed && canHide()) show(false) }, PLAYER_IDLE_MS)
    },
    destroy() { disposed = true; clear() },
  }
}

/** Respect browser/OS permission and visibility. No background or synthetic-input fallback. */
export function createPlaybackWakeLock(nav: Pick<Navigator, 'wakeLock'>, doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>) {
  let active = false
  let disposed = false
  let pending = false
  let lock: WakeLockSentinel | null = null
  const wanted = () => active && !disposed && doc.visibilityState === 'visible'
  const release = () => { const current = lock; lock = null; if (current) void current.release().catch(() => undefined) }
  const reconcile = async () => {
    if (!wanted()) { release(); return }
    if (lock || pending || !nav.wakeLock?.request) return
    pending = true
    try {
      const requested = await nav.wakeLock.request('screen')
      if (!wanted()) { await requested.release(); return }
      lock = requested
      requested.addEventListener('release', () => { if (lock === requested) lock = null }, { once: true })
    } catch { /* Permission, power-saving and platform decisions remain authoritative. */ }
    finally { pending = false }
  }
  const onVisibility = () => { void reconcile() }
  doc.addEventListener('visibilitychange', onVisibility)
  return {
    setPlaying(playing: boolean) { active = playing; void reconcile() },
    destroy() { disposed = true; active = false; doc.removeEventListener('visibilitychange', onVisibility); release() },
  }
}

type SafariVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean
  webkitSetPresentationMode?: (mode: string) => void
  webkitPresentationMode?: string
}
export function supportsPictureInPicture(video: HTMLVideoElement | null, doc: Document) {
  if (!video || video.disablePictureInPicture) return false
  const safari = video as SafariVideo
  return !!((doc.pictureInPictureEnabled && video.requestPictureInPicture) ||
    (safari.webkitSetPresentationMode && safari.webkitSupportsPresentationMode?.('picture-in-picture')))
}
export function isPictureInPicture(video: HTMLVideoElement | null, doc: Document) {
  return !!video && (doc.pictureInPictureElement === video || (video as SafariVideo).webkitPresentationMode === 'picture-in-picture')
}
export async function togglePictureInPicture(video: HTMLVideoElement | null, doc: Document) {
  if (!video || !supportsPictureInPicture(video, doc)) throw new Error('Picture in picture is not available for this video in your browser.')
  if (video.readyState < 2) throw new Error('Start the video before opening picture in picture.')
  if (doc.pictureInPictureEnabled && video.requestPictureInPicture) {
    if (doc.pictureInPictureElement === video) await doc.exitPictureInPicture()
    else await video.requestPictureInPicture()
  } else {
    const safari = video as SafariVideo
    safari.webkitSetPresentationMode!(isPictureInPicture(video, doc) ? 'inline' : 'picture-in-picture')
  }
}
