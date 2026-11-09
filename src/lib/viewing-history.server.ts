import { all } from './db'
import { getActiveViewer } from './viewer.server'

export type ViewingQuery = { tab?: 'continue' | 'history'; category?: 'all' | 'movie' | 'teaching' | 'tvshow' | 'video'; search?: string; offset?: number; limit?: number }
export function viewingQuery(input: ViewingQuery = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !['continue', 'history'].includes(input.tab ?? 'continue') || !['all', 'movie', 'teaching', 'tvshow', 'video'].includes(input.category ?? 'all')) throw new Error('Choose a valid viewing filter.')
  if (input.search != null && (typeof input.search !== 'string' || input.search.length > 120)) throw new Error('Search must be 120 characters or fewer.')
  const offset = input.offset ?? 0, limit = input.limit ?? 24
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 48) throw new Error('Invalid viewing page.')
  return { tab: input.tab ?? 'continue', category: input.category ?? 'all', search: input.search?.trim() ?? '', offset, limit }
}

// Historical rows contain either seconds or clock strings. Normalize in SQL so
// filtering and pagination stay bounded without dropping later eligible titles.
function watchSeconds(column: string) {
  return `(CASE WHEN instr(${column}, ':') = 0 THEN MAX(0, CAST(${column} AS REAL))
    WHEN instr(substr(${column}, instr(${column}, ':') + 1), ':') = 0
      THEN CAST(substr(${column}, 1, instr(${column}, ':') - 1) AS REAL) * 60 + CAST(substr(${column}, instr(${column}, ':') + 1) AS REAL)
    ELSE CAST(substr(${column}, 1, instr(${column}, ':') - 1) AS REAL) * 3600 + CAST(substr(${column}, instr(${column}, ':') + 1) AS REAL) * 60 + CAST(substr(${column}, instr(${column}, ':') + instr(substr(${column}, instr(${column}, ':') + 1), ':') + 1) AS REAL) END)`
}

export async function loadViewingHistory(query: ReturnType<typeof viewingQuery>) {
  const viewer = await getActiveViewer()
  if (!viewer?.profileId) return { needsAuth: !viewer, needsProfile: !!viewer, items: [] as any[], nextOffset: null as number | null }
  const rows = await all<any>(`WITH records AS (
    SELECT c.id AS cw_id, c.episode_id, COALESCE(e.id, v.id) AS id,
      COALESCE(e.name, v.name) AS name, COALESCE(e.slug, v.slug) AS slug,
      COALESCE(e.type, 'video') AS type,
      COALESCE(NULLIF(TRIM(ep.poster_url), ''), e.poster_url, v.poster_url) AS poster_url,
      COALESCE(NULLIF(TRIM(ep.thumbnail_url), ''), NULLIF(TRIM(e.thumbnail_url), ''), NULLIF(TRIM(v.thumbnail_url), '')) AS thumbnail_url,
      ep.name AS episode_name, COALESCE(c.updated_at, c.created_at) AS watched_at,
      ${watchSeconds('c.watched_time')} AS raw_position, ${watchSeconds('c.total_watched_time')} AS duration,
      ROW_NUMBER() OVER (PARTITION BY COALESCE(e.type, 'video'), COALESCE(e.id, v.id), c.episode_id ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC) AS latest
    FROM continue_watch c
    LEFT JOIN entertainments e ON e.id = c.entertainment_id
      AND (c.entertainment_type IS NULL OR c.entertainment_type = e.type) AND e.status = 1 AND e.deleted_at IS NULL
    LEFT JOIN videos v ON v.id = c.entertainment_id AND c.entertainment_type = 'video' AND v.status = 1 AND v.deleted_at IS NULL
    LEFT JOIN episodes ep ON ep.id = c.episode_id AND ep.entertainment_id = e.id AND ep.status = 1 AND ep.deleted_at IS NULL
    WHERE c.user_id = ? AND c.profile_id = ? AND c.deleted_at IS NULL
      AND (e.id IS NOT NULL OR v.id IS NOT NULL) AND (c.episode_id IS NULL OR ep.id IS NOT NULL)
  ), progress AS (SELECT *, MIN(raw_position, duration) AS position FROM records WHERE latest = 1)
  SELECT * FROM progress WHERE position > 0 AND duration > 0
    AND (? = 'history' OR (position >= MIN(120, MAX(30, duration * .02)) AND position / duration < .9))
    AND (? = 'all' OR type = ?) AND (? = '' OR instr(lower(name || ' ' || COALESCE(episode_name, '')), lower(?)) > 0)
  ORDER BY watched_at DESC, cw_id DESC LIMIT ? OFFSET ?`,
  viewer.userId, viewer.profileId, query.tab, query.category, query.category, query.search, query.search, query.limit + 1, query.offset)
  const items = rows.slice(0, query.limit).map(({ latest, raw_position, ...row }) => {
    const timestamp = row.watched_at ? new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(row.watched_at) ? row.watched_at : row.watched_at.replace(' ', 'T') + 'Z') : null
    return { ...row, completed: row.position / row.duration >= .9, watched_at: timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null }
  })
  return { needsAuth: false, needsProfile: false, items, nextOffset: rows.length > query.limit && query.offset + query.limit <= 10000 ? query.offset + query.limit : null }
}
