import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPlaybackProgress, recordWatchProgress } from '../lib/playback'

type Identity = { contentType: 'movie' | 'video' | 'episode' | 'tvshow' | 'teaching'; contentId: number }
export type PlaybackPosition = { position: number; duration: number }
type PlaybackSession = {
  active: boolean
  profileKey: string | null | undefined
  readComplete: boolean
  blockedRequirement: boolean
  latest: PlaybackPosition | null
  lastWritten: string
  lastWriteAt: number
  pending: Promise<unknown> | null
}

export function validPlaybackPosition(position: number, duration: number): PlaybackPosition | null {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0) return null
  return { position: Math.min(position, duration), duration }
}

export function usePlaybackProgress(identity: Identity, enabled = true) {
  const [saved, setSaved] = useState<PlaybackPosition | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveRequirement, setSaveRequirement] = useState<'profile' | 'auth' | null>(null)
  const { contentType, contentId } = identity
  // A title's callbacks must never read another title's position or ownership.
  const playback = useMemo<{ current: PlaybackSession | null }>(() => ({ current: null }), [contentType, contentId, enabled])

  const flushSession = useCallback((session: PlaybackSession) => {
    if (!enabled || !session.readComplete || session.blockedRequirement) return
    const value = session.latest
    if (!value) return
    const signature = `${Math.floor(value.position)}:${Math.floor(value.duration)}`
    if (signature === session.lastWritten) return
    const expectedProfile = session.profileKey
    session.lastWriteAt = Date.now()
    // Preserve event ordering: an older request must not overwrite a later pause.
    session.pending = (session.pending ?? Promise.resolve()).catch(() => undefined).then(async () => {
      if (session.blockedRequirement) return
      try {
        const result = await recordWatchProgress({ data: { contentType, contentId, ...value, profileKey: expectedProfile } })
        if (result.ok) { session.lastWritten = signature; if (session.active) setSaveError(false) }
        else if ('needsProfile' in result && result.needsProfile) {
          session.blockedRequirement = true
          if (session.active) { setSaveRequirement('profile'); setSaveError(false) }
        } else if ('needsAuth' in result && result.needsAuth) {
          session.blockedRequirement = true
          if (session.active) { setSaveRequirement('auth'); setSaveError(false) }
        } else if (session.active) setSaveError(true)
      } catch { if (session.active) setSaveError(true) }
    })
  }, [contentType, contentId, enabled])

  const flush = useCallback(() => {
    if (playback.current?.active) flushSession(playback.current)
  }, [playback, flushSession])

  useEffect(() => {
    // Keep this read and its final observation alive after cleanup, independently
    // of subsequent titles and Strict Mode's next effect setup.
    const session: PlaybackSession = { active: true, profileKey: undefined, readComplete: false, blockedRequirement: false, latest: null, lastWritten: '', lastWriteAt: 0, pending: null }
    playback.current = session
    setLoaded(false)
    setLoadError(false)
    setSaveError(false)
    setSaved(null)
    setSaveRequirement(null)
    if (!enabled) { setLoaded(true); return () => { session.active = false } }
    getPlaybackProgress({ data: { contentType, contentId } }).then((result) => {
      session.profileKey = result.profileKey
      session.readComplete = true
      if (!result.profileKey) {
        session.blockedRequirement = true
        if (session.active) setSaveRequirement('needsAuth' in result && result.needsAuth ? 'auth' : 'profile')
        return
      }
      if (session.active) setSaved(validPlaybackPosition(result.position, result.duration))
      flushSession(session)
    }).catch(() => {
      session.blockedRequirement = true
      if (session.active) setLoadError(true)
    }).finally(() => { if (session.active) setLoaded(true) })
    const onHidden = () => { if (document.visibilityState === 'hidden') flushSession(session) }
    document.addEventListener('visibilitychange', onHidden)
    return () => { session.active = false; document.removeEventListener('visibilitychange', onHidden); flushSession(session) }
  }, [contentType, contentId, playback, flushSession, enabled])

  const record = useCallback((position: number, duration: number, immediately = false) => {
    const session = playback.current
    if (!session?.active || !enabled) return
    const actual = validPlaybackPosition(position, duration)
    if (!actual) return
    session.latest = actual
    if (immediately || Date.now() - session.lastWriteAt >= 10_000) flushSession(session)
  }, [playback, flushSession, enabled])
  return { saved, loaded, record, flush, saveError, loadError, saveRequirement }
}
