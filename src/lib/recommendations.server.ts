import { all, first } from './db'
import type { ActiveViewer } from './viewer.server'
import type { RecommendationCandidate, SavedSignalEntry, WatchHistoryEntry } from './recommendations'

/** The caller supplies only the server-resolved active viewer, never request profile IDs. */
export async function isChildViewer(viewer: ActiveViewer | null): Promise<boolean> {
  if (!viewer?.profileId) return false
  const profile = await first<{ is_child_profile: number }>(
    'SELECT is_child_profile FROM user_multi_profiles WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    viewer.profileId, viewer.userId,
  )
  // If an already-selected profile disappeared, fail closed until the next profile selection.
  return !profile || !!profile.is_child_profile
}

export async function loadRecommendationSignals(viewer: ActiveViewer | null, child: boolean) {
  if (!viewer?.profileId) return { history: [] as WatchHistoryEntry[], saved: [] as SavedSignalEntry[] }
  const [history, saved] = await Promise.all([
    all<WatchHistoryEntry>(
      `SELECT c.entertainment_id, COALESCE(e.type, 'video') AS entertainment_type,
        c.watched_time, c.total_watched_time, c.created_at, c.updated_at,
        CASE WHEN v.id IS NOT NULL THEN
          (SELECT GROUP_CONCAT(DISTINCT g.name) FROM video_gener_mappings m JOIN genres g ON g.id = m.genre_id
           WHERE m.video_id = v.id AND m.deleted_at IS NULL AND g.status = 1 AND g.deleted_at IS NULL)
        ELSE
          (SELECT GROUP_CONCAT(DISTINCT g.name) FROM entertainment_gener_mapping m JOIN genres g ON g.id = m.genre_id
           WHERE m.entertainment_id = e.id AND m.deleted_at IS NULL AND g.status = 1 AND g.deleted_at IS NULL)
        END AS genre_names
       FROM continue_watch c
       LEFT JOIN entertainments e ON e.id = c.entertainment_id
         AND (c.entertainment_type IS NULL OR c.entertainment_type = e.type) AND e.status = 1 AND e.deleted_at IS NULL
       LEFT JOIN videos v ON v.id = c.entertainment_id AND c.entertainment_type = 'video' AND v.status = 1 AND v.deleted_at IS NULL
       WHERE c.user_id = ? AND c.profile_id = ? AND c.deleted_at IS NULL
         AND (e.id IS NOT NULL OR v.id IS NOT NULL)
         AND (? = 0 OR COALESCE(e.is_restricted, v.is_restricted, 0) = 0)
       ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC LIMIT 100`,
      viewer.userId, viewer.profileId, child ? 1 : 0,
    ),
    all<SavedSignalEntry>(
      `SELECT w.entertainment_id, e.type AS entertainment_type, w.created_at, w.updated_at,
        GROUP_CONCAT(DISTINCT g.name) AS genre_names
       FROM watchlists w JOIN entertainments e ON e.id = w.entertainment_id
         AND (w.type IS NULL OR w.type = e.type) AND e.status = 1 AND e.deleted_at IS NULL
       LEFT JOIN entertainment_gener_mapping m ON m.entertainment_id = e.id AND m.deleted_at IS NULL
       LEFT JOIN genres g ON g.id = m.genre_id AND g.status = 1 AND g.deleted_at IS NULL
       WHERE w.user_id = ? AND w.profile_id = ? AND w.deleted_at IS NULL
         AND (? = 0 OR COALESCE(e.is_restricted, 0) = 0)
       GROUP BY w.id ORDER BY COALESCE(w.updated_at, w.created_at) DESC, w.id DESC LIMIT 100`,
      viewer.userId, viewer.profileId, child ? 1 : 0,
    ),
  ])
  return { history, saved }
}

/** Public metadata only: subscription/paid source URLs never leave the server. */
export async function loadRecommendationCandidates(child: boolean): Promise<RecommendationCandidate[]> {
  const [titles, videos] = await Promise.all([
    all<RecommendationCandidate>(
      `SELECT e.id, e.name, e.slug, e.description, e.type, e.poster_url, e.thumbnail_url,
        e.release_date, e.IMDb_rating, e.duration, e.language, e.movie_access, e.content_rating,
        e.trailer_url, e.bunny_trailer_url, CASE WHEN e.movie_access = 'free' THEN e.video_url_input ELSE NULL END AS video_url_input,
        e.total_views, e.created_at, e.updated_at, GROUP_CONCAT(DISTINCT g.name) AS genre_names
       FROM entertainments e
       LEFT JOIN entertainment_gener_mapping m ON m.entertainment_id = e.id AND m.deleted_at IS NULL
       LEFT JOIN genres g ON g.id = m.genre_id AND g.status = 1 AND g.deleted_at IS NULL
       WHERE e.type IN ('movie', 'tvshow', 'teaching') AND e.status = 1 AND e.deleted_at IS NULL
         AND TRIM(COALESCE(e.name, '')) != '' AND (? = 0 OR COALESCE(e.is_restricted, 0) = 0)
       GROUP BY e.id`, child ? 1 : 0,
    ),
    all<RecommendationCandidate>(
      `SELECT v.id, v.name, v.slug, v.description, 'video' AS type, v.poster_url, v.thumbnail_url,
        v.release_date, v.IMDb_rating, v.duration, NULL AS language, v.access AS movie_access,
        v.content_rating, v.trailer_url, NULL AS bunny_trailer_url,
        CASE WHEN v.access = 'free' THEN v.video_url_input ELSE NULL END AS video_url_input,
        COALESCE(views.total_views, 0) AS total_views, v.created_at, v.updated_at,
        GROUP_CONCAT(DISTINCT g.name) AS genre_names
       FROM videos v
       LEFT JOIN video_gener_mappings m ON m.video_id = v.id AND m.deleted_at IS NULL
       LEFT JOIN genres g ON g.id = m.genre_id AND g.status = 1 AND g.deleted_at IS NULL
       LEFT JOIN (
         SELECT entertainment_id, COUNT(DISTINCT CAST(user_id AS TEXT) || ':' || CAST(profile_id AS TEXT)) AS total_views
         FROM continue_watch WHERE entertainment_type = 'video' AND deleted_at IS NULL
           AND CAST(watched_time AS REAL) >= MIN(120, MAX(30, COALESCE(CAST(total_watched_time AS REAL), 0) * .02))
         GROUP BY entertainment_id
       ) views ON views.entertainment_id = v.id
       WHERE v.status = 1 AND v.deleted_at IS NULL AND TRIM(COALESCE(v.name, '')) != ''
         AND (? = 0 OR COALESCE(v.is_restricted, 0) = 0)
       GROUP BY v.id`, child ? 1 : 0,
    ),
  ])
  return [...titles, ...videos]
}
