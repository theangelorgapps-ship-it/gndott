import { createDirectPlayback } from './directPlayback'

export const PREVIEW_START_SECONDS = 30

/** Seek silently before revealing the preview. A rejected sound attempt keeps
 * the clip playing muted and exposes a real user-gesture sound control. */
export function createPreviewPlayback(video: HTMLVideoElement, url: string, callbacks: {
  ready: () => void; muted: (value: boolean) => void; failure: () => void
}, create = createDirectPlayback, options: { start?: number; volume?: number; sound?: boolean } = {}) {
  let disposed = false
  let revealed = false
  const start = Number.isFinite(options.start) ? Math.max(0, options.start!) : PREVIEW_START_SECONDS
  let target = start
  let soundIntent = options.sound ?? true
  let soundAttempt = 0
  video.muted = true
  video.volume = Number.isFinite(options.volume) ? Math.max(0, Math.min(1, options.volume!)) : 1
  const failed = () => { if (!disposed) { video.pause(); callbacks.failure() } }
  const direct = create(video, url, { qualities: () => {}, failure: failed, blocked: failed })
  async function sound(enabled: boolean) {
    if (disposed) return
    soundIntent = enabled
    const attempt = ++soundAttempt
    video.muted = !enabled
    try { await video.play() }
    catch {
      if (disposed || attempt !== soundAttempt) return
      video.muted = true
      try { await video.play() } catch { failed() }
    }
    if (!disposed && attempt === soundAttempt) callbacks.muted(video.muted)
  }
  function reveal() {
    if (disposed || revealed || Math.abs(video.currentTime - target) > 2) return
    revealed = true
    callbacks.ready()
    void sound(soundIntent)
  }
  function seek() {
    if (disposed || revealed) return
    target = Number.isFinite(video.duration) && video.duration <= start ? 0 : start
    video.currentTime = target
    if (target === 0 && video.readyState >= 2) reveal()
  }
  const ended = () => { video.currentTime = target; void video.play().catch(failed) }
  video.addEventListener('loadedmetadata', seek)
  video.addEventListener('seeked', reveal)
  video.addEventListener('canplay', reveal)
  video.addEventListener('ended', ended)
  video.addEventListener('error', failed)
  void direct.play()
  return {
    sound,
    destroy() {
      if (disposed) return
      disposed = true
      video.removeEventListener('loadedmetadata', seek)
      video.removeEventListener('seeked', reveal)
      video.removeEventListener('canplay', reveal)
      video.removeEventListener('ended', ended)
      video.removeEventListener('error', failed)
      direct.destroy()
    },
  }
}
