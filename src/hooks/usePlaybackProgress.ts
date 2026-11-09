import { useCallback, useEffect, useRef, useState } from 'react'
import { getPlaybackProgress, recordWatchProgress } from '../lib/playback'

type Identity = { contentType: 'movie' | 'video' | 'episode' | 'tvshow' | 'teaching'; contentId: number }
export type PlaybackPosition = { position: number; duration: number }

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
  const profileKey = useRef<string | null | undefined>(undefined)
  const readComplete = useRef(false)
  const blockedRequirement = useRef(false)
  const latest = useRef<PlaybackPosition | null>(null)
  const lastWritten = useRef('')
  const lastWriteAt = useRef(0)
  const pending = useRef<Promise<unknown> | null>(null)
  const { contentType, contentId } = identity

  const flush = useCallback(() => {
    if (!enabled || !readComplete.current || blockedRequirement.current) return
    const value = latest.current
    if (!value) return
    const signature = `${Math.floor(value.position)}:${Math.floor(value.duration)}`
    if (signature === lastWritten.current) return
    const expectedProfile = profileKey.current
    lastWriteAt.current = Date.now()
    // Preserve event ordering: an older request must not overwrite a later pause.
    pending.current = (pending.current ?? Promise.resolve()).catch(() => undefined).then(async () => {
      try {
        const result = await recordWatchProgress({ data: { contentType, contentId, ...value, profileKey: expectedProfile } })
        if (result.ok) { lastWritten.current = signature; setSaveError(false) }
        else if ('needsProfile' in result && result.needsProfile) { blockedRequirement.current = true; setSaveRequirement('profile'); setSaveError(false) }
        else if ('needsAuth' in result && result.needsAuth) { blockedRequirement.current = true; setSaveRequirement('auth'); setSaveError(false) }
        else setSaveError(true)
      } catch { setSaveError(true) }
    })
  }, [contentType, contentId, enabled])

  useEffect(() => {
    let active = true
    setLoaded(false)
    setLoadError(false)
    readComplete.current = false
    profileKey.current = undefined
    setSaved(null)
    latest.current = null
    lastWritten.current = ''
    blockedRequirement.current = false
    setSaveRequirement(null)
    if (!enabled) { setLoaded(true); return }
    getPlaybackProgress({ data: { contentType, contentId } }).then((result) => {
      if (active) { profileKey.current = result.profileKey; setSaved(validPlaybackPosition(result.position, result.duration)); readComplete.current = true; flush() }
    }).catch(() => { if (active) { blockedRequirement.current = true; setLoadError(true) } }).finally(() => { if (active) setLoaded(true) })
    const onHidden = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHidden)
    return () => { active = false; document.removeEventListener('visibilitychange', onHidden); flush() }
  }, [contentType, contentId, flush, enabled])

  const record = useCallback((position: number, duration: number, immediately = false) => {
    if (!enabled) return
    const actual = validPlaybackPosition(position, duration)
    if (!actual) return
    latest.current = actual
    if (immediately || Date.now() - lastWriteAt.current >= 10_000) flush()
  }, [flush, enabled])
  return { saved, loaded, record, flush, saveError, loadError, saveRequirement }
}
