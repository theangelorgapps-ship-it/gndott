import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPlaybackProgress, recordWatchProgress } from '../lib/playback'

type Identity = { contentType: 'movie' | 'video' | 'episode' | 'tvshow' | 'teaching'; contentId: number }
export type PlaybackPosition = { position: number; duration: number }
type PlaybackWrites = { observation: number; lastWritten: string; pending: Promise<unknown> | null }
type PlaybackGroup = { key: string; sessions: number; observation: number; profiles: Map<string, PlaybackWrites> }
type PlaybackSession = {
  active: boolean
  profileKey: string | null | undefined
  readComplete: boolean
  blockedRequirement: boolean
  latest: PlaybackPosition | null
  lastWriteAt: number
  pending: Promise<unknown> | null
  group: PlaybackGroup | null
  observation: number
  released: boolean
}

// Coordinate only overlapping open/pending sessions. Once their reads and writes
// finish after cleanup, discard the title and all its profile ordering state.
const playbackGroups = new Map<string, PlaybackGroup>()
function retainPlayback(contentType: string, contentId: number): PlaybackGroup {
  const key = `${contentType}:${contentId}`
  let group = playbackGroups.get(key)
  if (!group) {
    group = { key, sessions: 0, observation: 0, profiles: new Map() }
    playbackGroups.set(key, group)
  }
  group.sessions++
  return group
}
function releasePlayback(session: PlaybackSession) {
  if (session.active || !session.readComplete || session.pending || session.released || !session.group) return
  session.released = true
  if (--session.group.sessions === 0) playbackGroups.delete(session.group.key)
}
function profileWrites(session: PlaybackSession): PlaybackWrites | null {
  if (!session.group || !session.profileKey) return null
  let writes = session.group.profiles.get(session.profileKey)
  if (!writes) {
    writes = { observation: 0, lastWritten: '', pending: null }
    session.group.profiles.set(session.profileKey, writes)
  }
  writes.observation = Math.max(writes.observation, session.observation)
  return writes
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
    const writes = profileWrites(session)
    const observation = session.observation
    if (!writes || observation < writes.observation) return
    const signature = `${Math.floor(value.position)}:${Math.floor(value.duration)}`
    if (!writes.pending && signature === writes.lastWritten) return
    const expectedProfile = session.profileKey
    session.lastWriteAt = Date.now()
    // Share ordering across reopened sessions for the same title and profile.
    // Observation order, not position, allows a later intentional backward seek.
    const pending = (writes.pending ?? Promise.resolve()).catch(() => undefined).then(async () => {
      if (session.blockedRequirement || observation < writes.observation || signature === writes.lastWritten) return
      try {
        const result = await recordWatchProgress({ data: { contentType, contentId, ...value, profileKey: expectedProfile } })
        if (result.ok) { writes.lastWritten = signature; if (session.active) setSaveError(false) }
        else if ('needsProfile' in result && result.needsProfile) {
          session.blockedRequirement = true
          if (session.active) { setSaveRequirement('profile'); setSaveError(false) }
        } else if ('needsAuth' in result && result.needsAuth) {
          session.blockedRequirement = true
          if (session.active) { setSaveRequirement('auth'); setSaveError(false) }
        } else if (session.active) setSaveError(true)
      } catch { if (session.active) setSaveError(true) }
    }).finally(() => {
      if (session.pending === pending) session.pending = null
      if (writes.pending === pending) writes.pending = null
      releasePlayback(session)
    })
    session.pending = writes.pending = pending
  }, [contentType, contentId, enabled])

  const flush = useCallback(() => {
    if (playback.current?.active) flushSession(playback.current)
  }, [playback, flushSession])

  useEffect(() => {
    // Keep this read and its final observation alive after cleanup, independently
    // of subsequent titles and Strict Mode's next effect setup.
    const session: PlaybackSession = { active: true, profileKey: undefined, readComplete: false, blockedRequirement: false, latest: null, lastWriteAt: 0, pending: null, group: enabled ? retainPlayback(contentType, contentId) : null, observation: 0, released: false }
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
    }).finally(() => {
      session.readComplete = true
      if (session.active) setLoaded(true)
      releasePlayback(session)
    })
    const onHidden = () => { if (document.visibilityState === 'hidden') flushSession(session) }
    document.addEventListener('visibilitychange', onHidden)
    return () => { session.active = false; document.removeEventListener('visibilitychange', onHidden); flushSession(session); releasePlayback(session) }
  }, [contentType, contentId, playback, flushSession, enabled])

  const record = useCallback((position: number, duration: number, immediately = false) => {
    const session = playback.current
    if (!session?.active || !enabled || !session.group) return
    const actual = validPlaybackPosition(position, duration)
    if (!actual) return
    session.latest = actual
    session.observation = ++session.group.observation
    profileWrites(session)
    if (immediately || Date.now() - session.lastWriteAt >= 10_000) flushSession(session)
  }, [playback, flushSession, enabled])
  return { saved, loaded, record, flush, saveError, loadError, saveRequirement }
}
