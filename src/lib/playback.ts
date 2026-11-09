import { createServerFn } from '@tanstack/react-start'
import { first, run } from './db'
import { getActiveViewer } from './viewer.server'
import { parseWatchSeconds as seconds } from './recommendations'
import { loadViewingHistory, viewingQuery } from './viewing-history.server'
export type { ViewingQuery } from './viewing-history.server'

export const getViewingHistory = createServerFn({ method: 'GET' }).validator(viewingQuery).handler(({ data }) => loadViewingHistory(data))

export type PlaybackIdentity = { contentType: 'movie' | 'video' | 'episode' | 'tvshow' | 'teaching'; contentId: number }
export type PlaybackProgressInput = PlaybackIdentity & { position: number; duration: number; profileKey?: string | null }
const TYPES = new Set(['movie', 'video', 'episode', 'tvshow', 'teaching'])

function identity(input: PlaybackIdentity) {
  if (!input || !TYPES.has(input.contentType) || !Number.isSafeInteger(input.contentId) || input.contentId <= 0) throw new Error('Invalid title.')
  return input
}

async function resolveContent(input: PlaybackIdentity) {
  if (input.contentType === 'episode') {
    const row = await first<any>(`SELECT e.id, e.type FROM episodes ep JOIN entertainments e ON e.id = ep.entertainment_id
      WHERE ep.id = ? AND ep.status = 1 AND ep.deleted_at IS NULL AND e.status = 1 AND e.deleted_at IS NULL`, input.contentId)
    return row ? { id: Number(row.id), type: String(row.type), episodeId: input.contentId } : null
  }
  if (input.contentType === 'video') {
    const row = await first<any>('SELECT id FROM videos WHERE id = ? AND status = 1 AND deleted_at IS NULL', input.contentId)
    return row ? { id: Number(row.id), type: 'video', episodeId: null } : null
  }
  const row = await first<any>('SELECT id, type FROM entertainments WHERE id = ? AND type = ? AND status = 1 AND deleted_at IS NULL', input.contentId, input.contentType)
  return row ? { id: Number(row.id), type: String(row.type), episodeId: null } : null
}

export const getPlaybackProgress = createServerFn({ method: 'GET' })
  .validator(identity)
  .handler(async ({ data }) => {
    const viewer = await getActiveViewer()
    if (!viewer?.profileId) return { position: 0, duration: 0, profileKey: null }
    const profileKey = `${viewer.userId}:${viewer.profileId}`
    const content = await resolveContent(data)
    if (!content) return { position: 0, duration: 0, profileKey }
    const row = await first<any>(`SELECT watched_time, total_watched_time FROM continue_watch
      WHERE user_id = ? AND profile_id = ? AND entertainment_id = ? AND (entertainment_type = ? OR (entertainment_type IS NULL AND ? != 'video'))
      AND episode_id IS ? AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1`,
    viewer.userId, viewer.profileId, content.id, content.type, content.type, content.episodeId)
    const duration = seconds(row?.total_watched_time)
    return { position: Math.min(seconds(row?.watched_time), duration || Infinity), duration, profileKey }
  })

export const recordWatchProgress = createServerFn({ method: 'POST' })
  .validator((input: PlaybackProgressInput) => {
    identity(input)
    if (input.profileKey != null && (typeof input.profileKey !== 'string' || !/^\d+:\d+$/.test(input.profileKey) || input.profileKey.length > 40)) throw new Error('Invalid playback profile.')
    if (!Number.isFinite(input.position) || !Number.isFinite(input.duration) || input.position < 0 || input.duration <= 0 || input.duration > 86400) throw new Error('Invalid playback progress.')
    return { ...input, position: Math.min(input.position, input.duration) }
  })
  .handler(async ({ data }) => {
    const viewer = await getActiveViewer()
    if (!viewer) return { ok: false, needsAuth: true }
    if (!viewer.profileId || (data.profileKey != null && data.profileKey !== `${viewer.userId}:${viewer.profileId}`)) return { ok: false, needsProfile: true }
    const content = await resolveContent(data)
    if (!content) return { ok: false }
    const values = [viewer.userId, viewer.profileId, content.id, content.type, content.episodeId]
    const matchValues = [viewer.userId, viewer.profileId, content.id, content.type, content.type, content.episodeId]
    const where = `user_id = ? AND profile_id = ? AND entertainment_id = ? AND (entertainment_type = ? OR (entertainment_type IS NULL AND ? != 'video')) AND episode_id IS ? AND deleted_at IS NULL`
    await run(`UPDATE continue_watch SET watched_time = ?, total_watched_time = ?, entertainment_type = ?, updated_at = datetime('now') WHERE ${where}`,
      data.position, data.duration, content.type, ...matchValues)
    await run(`INSERT INTO continue_watch (user_id, profile_id, entertainment_id, entertainment_type, episode_id, watched_time, total_watched_time, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM continue_watch WHERE ${where})`,
      ...values, data.position, data.duration, ...matchValues)
    return { ok: true }
  })
