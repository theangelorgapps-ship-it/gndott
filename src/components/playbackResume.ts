export type SavedPlayback = { position: number; duration: number } | null

/** A provider's ready message does not guarantee it can seek yet. Resume is
 * complete only after a media event confirms the requested position. */
export function createResumeController(options: { seek: (seconds: number) => void; status: (message: string) => void; now?: () => number }) {
  const now = options.now ?? Date.now
  let initialized = false
  let target: number | null = null
  let attempts = 0
  let lastAttempt = -Infinity
  function attempt(force = false) {
    if (target == null || attempts >= 5 || (!force && now() - lastAttempt < 1200)) return
    lastAttempt = now()
    attempts++
    try { options.seek(target) } catch { /* Metadata may not be ready; wait for a media event. */ }
  }
  function restore(saved: SavedPlayback) {
    if (initialized) return
    initialized = true
    if (!saved || !Number.isFinite(saved.position) || !Number.isFinite(saved.duration) || saved.position < 5 || saved.position >= saved.duration - 10) return
    target = saved.position
    options.status('Restoring your saved position…')
    attempt()
  }
  return {
    restore,
    reset(saved: SavedPlayback) { initialized = false; target = null; attempts = 0; lastAttempt = -Infinity; restore(saved) },
    onPlay() { attempt(true) },
    observe(position: number, duration: number, playing: boolean) {
      if (target == null) return true
      if (Math.abs(position - target) <= 2) { target = null; options.status(''); return true }
      if (playing && duration > 0) {
        target = Math.min(target, Math.max(0, duration - .5))
        attempt()
        if (attempts >= 5 && now() - lastAttempt > 2000) options.status('Your saved position could not be restored. Use the timeline or From Beginning to choose where to watch.')
      }
      return false
    },
    cancel() { target = null; initialized = true; options.status('') },
    pending: () => target != null,
  }
}
