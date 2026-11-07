import { createServerFn } from '@tanstack/react-start'
import { getSession, setSessionCookie, clearSessionCookie } from './session.server'
import { all, first, run } from './db'
import bcrypt from 'bcryptjs'
import { buildRecommendationPayload } from './recommendations'
import type { RecommendationCandidate, RecommendationPayload, WatchHistoryEntry } from './recommendations'

export type { RecommendationPayload } from './recommendations'

// ---------- types ----------

export interface Content {
  id: number
  name: string
  slug: string | null
  description: string | null
  type: string | null
  poster_url: string | null
  thumbnail_url: string | null
  release_date: string | null
  IMDb_rating: string | null
  imdb_rating?: string | null
  duration: string | null
  language: string | null
  movie_access?: string | null
  content_rating: string | null
}

// ---------- content queries ----------

const CONTENT_COLS =
  'id, name, slug, description, type, poster_url, thumbnail_url, release_date, IMDb_rating, duration, language, movie_access, content_rating, trailer_url, bunny_video_url, bunny_trailer_url, video_url_input, video_upload_type'

const DETAIL_COLS = `${CONTENT_COLS}, enable_quality, enable_subtitle, subtitle_file, subtitle_language, price, purchase_type, access_duration, available_for, meta_title, meta_description`

async function getBunnyLibraryId(): Promise<string | null> {
  const row = await first<any>(`SELECT val FROM settings WHERE name = 'bunny_library_id'`).catch(() => null)
  return row?.val ? String(row.val) : null
}

async function getPlaybackAds(contentType: string, contentId: number) {
  const today = new Date().toISOString().slice(0, 10)
  const vastAll = await all<any>(
    `SELECT id, name, type, url, duration, target_type, target_selection, enable_skip, skip_after
     FROM vast_ads_setting WHERE is_enable = '1' AND status = '1' AND deleted_at IS NULL
       AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)`,
    today, today,
  ).catch(() => [])
  const vast = vastAllFilter(vastAll, contentType, contentId)
  const custom = await all<any>(
    `SELECT id, name, type, url_type, placement, media, redirect_url, duration, skip_enabled, skip_after
     FROM custom_ads_setting WHERE is_enable = '1' AND status = '1'
       AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)`,
    today, today,
  ).catch(() => [])
  return { vast, custom }
}

function vastAllFilter(rows: any[], contentType: string, contentId: number) {
  return rows.filter((r) => {
    const tt = String(r.target_type ?? '')
    if (tt && tt !== 'all' && tt !== contentType) return false
    if (!r.target_selection || r.target_selection === '[]') return true
    try {
      const sel = JSON.parse(r.target_selection)
      return !Array.isArray(sel) || sel.length === 0 || sel.map(Number).includes(Number(contentId))
    } catch {
      return true
    }
  })
}

async function getInWatchlist(uid: number | null, entertainmentId: number): Promise<boolean> {
  if (!uid) return false
  const row = await first<any>(
    `SELECT id FROM watchlists WHERE user_id = ? AND entertainment_id = ? AND deleted_at IS NULL`,
    uid, entertainmentId,
  ).catch(() => null)
  return !!row
}

interface RecommendationContext {
  userId: number | null
  currentId?: number
  currentType?: string
  currentGenres?: string[]
}

async function loadRecommendations(context: RecommendationContext): Promise<RecommendationPayload> {
  const historyRequest = context.userId == null
    ? Promise.resolve<WatchHistoryEntry[] | null>([])
    : all<WatchHistoryEntry>(
        `SELECT c.entertainment_id, COALESCE(c.entertainment_type, e.type) AS entertainment_type,
                c.watched_time, c.total_watched_time, c.created_at, c.updated_at,
                GROUP_CONCAT(DISTINCT g.name) AS genre_names
         FROM continue_watch c
         LEFT JOIN entertainments e ON e.id = c.entertainment_id
         LEFT JOIN entertainment_gener_mapping m ON m.entertainment_id = c.entertainment_id
         LEFT JOIN genres g ON g.id = m.genre_id AND g.status = 1 AND g.deleted_at IS NULL
         WHERE c.user_id = ? AND c.deleted_at IS NULL
         GROUP BY c.id
         ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
         LIMIT 40`,
        context.userId,
      ).catch(() => null)

  const candidateRequest = all<RecommendationCandidate>(
    `SELECT e.id, e.name, e.slug, e.description, e.type, e.poster_url, e.thumbnail_url,
            e.release_date, e.IMDb_rating, e.duration, e.language, e.movie_access,
            e.content_rating, e.trailer_url, e.total_views, e.created_at, e.updated_at,
            GROUP_CONCAT(DISTINCT g.name) AS genre_names
     FROM entertainments e
     LEFT JOIN entertainment_gener_mapping m ON m.entertainment_id = e.id
     LEFT JOIN genres g ON g.id = m.genre_id AND g.status = 1 AND g.deleted_at IS NULL
     WHERE e.status = 1 AND e.deleted_at IS NULL
     GROUP BY e.id`,
  ).catch(() => [])

  const [history, candidates] = await Promise.all([historyRequest, candidateRequest])
  return buildRecommendationPayload({
    candidates,
    // A failed history read is an honest non-personalized fallback, never fake history.
    history: history ?? [],
    currentId: context.currentId,
    currentType: context.currentType,
    currentGenres: context.currentGenres,
  })
}

export const getRecommendations = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  return loadRecommendations({ userId: session?.uid ?? null })
})

export const getDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const [top10, popularMovies, popularTvShows, latest, free, genres, channels, comingSoon,
    payPerView, languages, cast, mostWatched] =
    await Promise.all([
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE status = 1 AND deleted_at IS NULL ORDER BY total_views DESC LIMIT 10`,
      ).catch(() =>
        all<Content>(
          `SELECT ${CONTENT_COLS} FROM entertainments WHERE status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 10`,
        ),
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'movie' AND status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'tvshow' AND status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE status = 1 AND deleted_at IS NULL AND (release_date IS NULL OR release_date <= date('now')) ORDER BY release_date DESC LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE movie_access = 'free' AND status = 1 AND deleted_at IS NULL LIMIT 12`,
      ),
      all(`SELECT id, name, slug FROM genres WHERE status = 1 AND deleted_at IS NULL ORDER BY name`),
      all(
        `SELECT id, name, poster_url FROM live_tv_channel WHERE status = 1 AND deleted_at IS NULL LIMIT 12`,
      ).catch(() => []),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE release_date > date('now') AND status = 1 AND deleted_at IS NULL ORDER BY release_date LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE movie_access = 'paid' AND status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 12`,
      ),
      all(
        `SELECT language AS name, COUNT(*) AS titles FROM entertainments
         WHERE language IS NOT NULL AND language != '' AND status = 1 AND deleted_at IS NULL
         GROUP BY language ORDER BY titles DESC LIMIT 10`,
      ).catch(() => []),
      all(
        `SELECT id, name, file_url, designation FROM cast_crew WHERE status = 1 AND deleted_at IS NULL ORDER BY id LIMIT 12`,
      ).catch(() => []),
      all<Content>(
        `SELECT id, name, slug, description, poster_url, thumbnail_url, release_date, IMDb_rating, duration, 'video' AS type
         FROM videos WHERE status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 12`,
      ).catch(() => []),
    ])
  const [session, bunnyLibraryId] = await Promise.all([getSession(), getBunnyLibraryId()])
  const recommendations = await loadRecommendations({ userId: session?.uid ?? null })
  return { top10, popularMovies, popularTvShows, latest, free, genres, channels, comingSoon, payPerView, languages, cast, mostWatched, recommendations, bunnyLibraryId }
})

export const getMovies = createServerFn({ method: 'GET' }).handler(async () =>
  all<Content>(
    `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'movie' AND status = 1 AND deleted_at IS NULL ORDER BY name`,
  ),
)

export const getTvShows = createServerFn({ method: 'GET' }).handler(async () =>
  all<Content>(
    `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'tvshow' AND status = 1 AND deleted_at IS NULL ORDER BY name`,
  ),
)

export const getTeachings = createServerFn({ method: 'GET' }).handler(async () =>
  all<Content>(
    `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'teaching' AND status = 1 AND deleted_at IS NULL ORDER BY name`,
  ),
)

export const getVideos = createServerFn({ method: 'GET' }).handler(async () =>
  all<Content>(
    `SELECT id, name, slug, description, poster_url, thumbnail_url, release_date, IMDb_rating, duration FROM videos WHERE status = 1 AND deleted_at IS NULL ORDER BY name`,
  ),
)

export const getLiveChannels = createServerFn({ method: 'GET' }).handler(async () => {
  const channels = await all(
    `SELECT c.id, c.name, c.poster_url, c.description, cat.name AS category
     FROM live_tv_channel c LEFT JOIN live_tv_category cat ON cat.id = c.category_id
     WHERE c.status = 1 AND c.deleted_at IS NULL ORDER BY c.name`,
  )
  const categories = await all(
    `SELECT id, name FROM live_tv_category WHERE status = 1 ORDER BY name`,
  ).catch(() => [])
  return { channels, categories }
})

export const getComingSoon = createServerFn({ method: 'GET' }).handler(async () => {
  const entertainment = await all<Content>(
    `SELECT e.id, e.name, e.slug, e.description, e.type, e.poster_url, e.thumbnail_url, e.release_date, e.IMDb_rating, e.duration, e.language, e.movie_access, e.trailer_url,
            (SELECT GROUP_CONCAT(g.name) FROM entertainment_gener_mapping m JOIN genres g ON g.id = m.genre_id WHERE m.entertainment_id = e.id) AS genres
     FROM entertainments e WHERE e.release_date > date('now') AND e.status = 1 AND e.deleted_at IS NULL ORDER BY e.release_date`,
  )
  const videos = await all<Content>(
    `SELECT id, name, slug, description, poster_url, thumbnail_url, release_date, IMDb_rating, duration, trailer_url FROM videos WHERE release_date > date('now') AND status = 1 AND deleted_at IS NULL ORDER BY release_date`,
  )
  return { entertainment, videos }
})

export const searchContent = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(async ({ data: q }) => {
    const like = `%${q}%`
    const [movies, tvshows, teachings, videos, channels] = await Promise.all([
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'movie' AND name LIKE ? AND status = 1 AND deleted_at IS NULL LIMIT 20`,
        like,
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'tvshow' AND name LIKE ? AND status = 1 AND deleted_at IS NULL LIMIT 20`,
        like,
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'teaching' AND (name LIKE ? OR LOWER(?) IN ('teaching', 'teachings')) AND status = 1 AND deleted_at IS NULL LIMIT 20`,
        like, q,
      ),
      all<Content>(
        `SELECT id, name, slug, description, poster_url, thumbnail_url, release_date, IMDb_rating, duration FROM videos WHERE name LIKE ? AND status = 1 AND deleted_at IS NULL LIMIT 20`,
        like,
      ),
      all(
        `SELECT id, name, poster_url FROM live_tv_channel WHERE name LIKE ? AND status = 1 AND deleted_at IS NULL LIMIT 20`,
        like,
      ).catch(() => []),
    ])
    return { movies, tvshows, teachings, videos, channels }
  })

export const getMovie = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const movie = await first<Content>(
      `SELECT ${DETAIL_COLS} FROM entertainments WHERE id = ? AND deleted_at IS NULL`,
      id,
    )
    if (!movie) return null
    const session = await getSession()
    const genres = await all(
      `SELECT g.id, g.name FROM genres g JOIN entertainment_gener_mapping m ON m.genre_id = g.id WHERE m.entertainment_id = ?`,
      id,
    ).catch(() => [])
    const cast = await all(
      `SELECT c.id, c.name, c.type, c.file_url FROM cast_crew c JOIN entertainment_talent_mapping m ON m.talent_id = c.id WHERE m.entertainment_id = ? LIMIT 12`,
      id,
    ).catch(() => [])
    const similar = await all<Content>(
      `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = ? AND id != ? AND status = 1 AND deleted_at IS NULL ORDER BY RANDOM() LIMIT 8`,
      movie.type,
      id,
    )
    const reviewStats = await first<{ n: number; avg: number }>(
      `SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE entertainment_id = ?`,
      id,
    ).catch(() => ({ n: 0, avg: 0 }))
    const reviews = await all(
      `SELECT r.id, r.rating, r.review, r.created_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), u.email) AS author
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.entertainment_id = ? AND r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 10`,
      id,
    ).catch(() => [])
    const clips = await all(
      `SELECT id, title, url, poster_url, type FROM clips WHERE content_id = ? AND content_type = ? AND deleted_at IS NULL LIMIT 8`,
      id, movie.type === 'tvshow' ? 'tvshow' : 'movie',
    ).catch(() => [])
    const [bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations] = await Promise.all([
      getBunnyLibraryId(),
      getPlaybackAds('movie', id),
      getInWatchlist(session?.uid ?? null, id),
      session
        ? first<any>(`SELECT id, rating, review FROM reviews WHERE entertainment_id = ? AND user_id = ? AND deleted_at IS NULL`, id, session.uid).catch(() => null)
        : null,
      session && (movie as any).movie_access === 'paid'
        ? first<any>(
            `SELECT id, view_expiry_date FROM pay_per_views WHERE user_id = ? AND movie_id = ? AND type = 'movie' AND (view_expiry_date IS NULL OR view_expiry_date >= datetime('now'))`,
            session.uid, id,
          ).catch(() => null)
        : null,
      loadRecommendations({
        userId: session?.uid ?? null,
        currentId: id,
        currentType: movie.type ?? undefined,
        currentGenres: genres.map((genre) => String(genre.name)),
      }),
    ])
    return { movie, genres, cast, similar, reviewStats, reviews, clips, bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations, viewerId: session?.uid ?? null }
  })

export const getTvShow = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const show = await first<Content>(
      `SELECT ${DETAIL_COLS} FROM entertainments WHERE id = ? AND deleted_at IS NULL`,
      id,
    )
    if (!show) return null
    const session = await getSession()
    const seasons = await all(
      `SELECT id, name, season_index, poster_url, short_desc FROM seasons WHERE entertainment_id = ? AND deleted_at IS NULL ORDER BY CAST(season_index AS INTEGER)`,
      id,
    )
    const episodes = await all(
      `SELECT id, name, season_id, poster_url, duration, IMDb_rating, release_date FROM episodes WHERE entertainment_id = ? AND deleted_at IS NULL ORDER BY id`,
      id,
    )
    const genres = await all(
      `SELECT g.id, g.name FROM genres g JOIN entertainment_gener_mapping m ON m.genre_id = g.id WHERE m.entertainment_id = ?`,
      id,
    ).catch(() => [])
    const cast = await all(
      `SELECT c.id, c.name, c.type, c.file_url FROM cast_crew c JOIN entertainment_talent_mapping m ON m.talent_id = c.id WHERE m.entertainment_id = ? LIMIT 12`,
      id,
    ).catch(() => [])
    const reviews = await all(
      `SELECT r.id, r.rating, r.review, r.created_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), u.email) AS author
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.entertainment_id = ? AND r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 10`,
      id,
    ).catch(() => [])
    const clips = await all(
      `SELECT id, title, url, poster_url, type FROM clips WHERE content_id = ? AND content_type = ? AND deleted_at IS NULL LIMIT 8`,
      id, show.type,
    ).catch(() => [])
    const similar = await all<Content>(
      `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = ? AND id != ? AND status = 1 AND deleted_at IS NULL ORDER BY RANDOM() LIMIT 8`,
      show.type,
      id,
    ).catch(() => [])
    const [bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations] = await Promise.all([
      getBunnyLibraryId(),
      getPlaybackAds(show.type as string, id),
      getInWatchlist(session?.uid ?? null, id),
      session
        ? first<any>(`SELECT id, rating, review FROM reviews WHERE entertainment_id = ? AND user_id = ? AND deleted_at IS NULL`, id, session.uid).catch(() => null)
        : null,
      session && (show as any).movie_access === 'paid'
        ? first<any>(
            `SELECT id, view_expiry_date FROM pay_per_views WHERE user_id = ? AND movie_id = ? AND type = 'movie' AND (view_expiry_date IS NULL OR view_expiry_date >= datetime('now'))`,
            session.uid, id,
          ).catch(() => null)
        : null,
      loadRecommendations({
        userId: session?.uid ?? null,
        currentId: id,
        currentType: show.type ?? undefined,
        currentGenres: genres.map((genre) => String(genre.name)),
      }),
    ])
    return { show, seasons, episodes, genres, cast, reviews, clips, similar, bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations, viewerId: session?.uid ?? null }
  })

export const getVideo = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const video = await first<Content>(
      `SELECT * FROM videos WHERE id = ? AND deleted_at IS NULL`,
      id,
    )
    if (!video) return null
    const similar = await all<Content>(
      `SELECT id, name, slug, poster_url, duration, IMDb_rating FROM videos WHERE id != ? AND status = 1 AND deleted_at IS NULL ORDER BY RANDOM() LIMIT 8`,
      id,
    )
    const reviews = await all(
      `SELECT r.id, r.rating, r.review, r.created_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), u.email) AS author
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.entertainment_id = ? AND r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 10`,
      id,
    ).catch(() => [])
    const clips = await all(
      `SELECT id, title, url, poster_url, type FROM clips WHERE content_id = ? AND content_type = 'video' AND deleted_at IS NULL LIMIT 8`,
      id,
    ).catch(() => [])
    const session = await getSession()
    const [bunnyLibraryId, ads, myReview, recommendations] = await Promise.all([
      getBunnyLibraryId(),
      getPlaybackAds('video', id),
      session
        ? first<any>(`SELECT id, rating, review FROM reviews WHERE entertainment_id = ? AND user_id = ? AND deleted_at IS NULL`, id, session.uid).catch(() => null)
        : null,
      loadRecommendations({ userId: session?.uid ?? null, currentId: id, currentType: 'video' }),
    ])
    return { video, similar, reviews, clips, bunnyLibraryId, ads, myReview, recommendations, viewerId: session?.uid ?? null }
  })

export const getChannel = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const channel = await first(
      `SELECT c.*, cat.name AS category FROM live_tv_channel c LEFT JOIN live_tv_category cat ON cat.id = c.category_id WHERE c.id = ?`,
      id,
    )
    if (!channel) return null
    const related = await all(
      `SELECT id, name, poster_url FROM live_tv_channel WHERE category_id = ? AND id != ? AND status = 1 LIMIT 8`,
      (channel as any).category_id,
      id,
    ).catch(() => [])
    return { channel, related }
  })

export const getGenres = createServerFn({ method: 'GET' }).handler(async () =>
  all(`SELECT id, name, slug, description FROM genres WHERE status = 1 AND deleted_at IS NULL ORDER BY name`),
)

export const getGenreContent = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const genre = await first(`SELECT id, name, description FROM genres WHERE id = ?`, id)
    const items = await all<Content>(
      `SELECT ${CONTENT_COLS} FROM entertainments e JOIN entertainment_gener_mapping m ON m.entertainment_id = e.id WHERE m.genre_id = ? AND e.status = 1 AND e.deleted_at IS NULL`,
      id,
    ).catch(() => [])
    return { genre, items }
  })

// ---------- auth ----------

export const login = createServerFn({ method: 'POST' })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const user = await first<any>(
      `SELECT id, email, first_name, last_name, password, user_type, status, is_banned FROM users WHERE email = ? AND deleted_at IS NULL`,
      data.email.trim().toLowerCase(),
    )
    if (!user) return { ok: false, error: 'No account found for that email.' }
    if (user.is_banned === 1 || user.status === 0) return { ok: false, error: 'This account is disabled.' }
    const hash = String(user.password || '').replace(/^\$2y\$/, '$2b$')
    const valid = bcrypt.compareSync(data.password, hash)
    if (!valid) return { ok: false, error: 'Incorrect password.' }
    const profiles = await all(
      `SELECT id, name, avatar, is_child_profile FROM user_multi_profiles WHERE user_id = ? AND deleted_at IS NULL`,
      user.id,
    )
    await setSessionCookie({ uid: user.id, email: user.email, name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() })
    return { ok: true, user: { id: user.id, email: user.email, name: user.first_name }, profiles }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  clearSessionCookie()
  return { ok: true }
})

export const getSessionUser = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  const user = await first<any>(
    `SELECT id, email, first_name, last_name, mobile, is_subscribe, user_type FROM users WHERE id = ?`,
    session.uid,
  )
  const profiles = await all(
    `SELECT id, name, avatar, is_child_profile FROM user_multi_profiles WHERE user_id = ? AND deleted_at IS NULL`,
    session.uid,
  )
  return user ? { ...user, profiles } : null
})

// ---------- watchlist & continue watching ----------

export const getWatchlist = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return { needsAuth: true as const, items: [] }
  const items = await all(
    `SELECT w.id AS watch_id, e.id, e.name, e.type, e.poster_url, e.IMDb_rating
     FROM watchlists w JOIN entertainments e ON e.id = w.entertainment_id
     WHERE w.user_id = ? AND w.deleted_at IS NULL`,
    session.uid,
  ).catch(() => [])
  return { needsAuth: false as const, items }
})

export const toggleWatchlist = createServerFn({ method: 'POST' })
  .validator((d: { entertainmentId: number }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true }
    const existing = await first<any>(
      `SELECT id FROM watchlists WHERE user_id = ? AND entertainment_id = ? AND deleted_at IS NULL`,
      session.uid,
      data.entertainmentId,
    )
    if (existing) {
      await run(`UPDATE watchlists SET deleted_at = datetime('now') WHERE id = ?`, existing.id)
      return { ok: true, added: false }
    }
    await run(
      `INSERT INTO watchlists (user_id, entertainment_id, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`,
      session.uid,
      data.entertainmentId,
    )
    return { ok: true, added: true }
  })

export const getContinueWatching = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return { needsAuth: true as const, items: [] }
  const items = await all(
    `SELECT c.id AS cw_id, c.watched_time, c.total_watched_time, e.id, e.name, e.type, e.poster_url
     FROM continue_watch c JOIN entertainments e ON e.id = c.entertainment_id
     WHERE c.user_id = ? AND c.deleted_at IS NULL`,
    session.uid,
  ).catch(() => [])
  return { needsAuth: false as const, items }
})

// ---------- footer ----------

export const getFooterData = createServerFn({ method: 'GET' }).handler(async () => {
  const [premium, latest] = await Promise.all([
    all(`SELECT id, name FROM entertainments WHERE type = 'tvshow' AND status = 1 AND deleted_at IS NULL ORDER BY id LIMIT 4`),
    all(`SELECT id, name FROM entertainments WHERE type = 'movie' AND status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 4`),
  ])
  return { premium, latest }
})

// ---------- registration ----------

export const register = createServerFn({ method: 'POST' })
  .validator((d: { firstName: string; lastName: string; email: string; mobile?: string; password: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase()
    if (!data.firstName.trim()) return { ok: false, error: 'First name is required.' }
    if (!email || !email.includes('@')) return { ok: false, error: 'A valid email is required.' }
    if (!data.password || data.password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
    const existing = await first<any>(`SELECT id FROM users WHERE email = ?`, email)
    if (existing) return { ok: false, error: 'An account with this email already exists.' }
    const hash = bcrypt.hashSync(data.password, 10)
    const res = await run(
      `INSERT INTO users (first_name, last_name, email, mobile, password, user_type, status, is_banned, is_subscribe, created_at, updated_at)
       VALUES (?,?,?,?,?,?,1,0,0,datetime('now'),datetime('now'))`,
      data.firstName.trim(), data.lastName.trim(), email, data.mobile ?? null, hash, 'user',
    )
    const uid = (res as any)?.meta?.last_row_id
    await run(
      `INSERT INTO user_multi_profiles (user_id, name, is_child_profile, created_at, updated_at) VALUES (?,?,0,datetime('now'),datetime('now'))`,
      uid, `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
    ).catch(() => null)
    await setSessionCookie({ uid, email, name: data.firstName.trim() })
    return { ok: true, user: { id: uid, email, name: data.firstName.trim() } }
  })

// ---------- subscription plans (public) ----------

export const getPlansPage = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  const plans = await all(
    `SELECT id, name, price, total_price, duration, duration_value, level, description
     FROM plan WHERE status = 1 AND deleted_at IS NULL ORDER BY CAST(level AS INTEGER)`,
  )
  const limits = await all(
    `SELECT m.plan_id, m.limitation_slug, m.limitation_value, m."limit", l.title
     FROM planlimitation_mapping m JOIN planlimitation l ON l.id = m.planlimitation_id
     WHERE m.deleted_at IS NULL`,
  ).catch(() => [])
  let activeSub: any = null
  if (session) {
    activeSub = await first<any>(
      `SELECT s.id, s.name, s.end_date, s.status FROM subscriptions s
       WHERE s.user_id = ? AND s.status = 'active' AND s.deleted_at IS NULL ORDER BY s.id DESC LIMIT 1`,
      session.uid,
    ).catch(() => null)
  }
  return { plans, limits, activeSub }
})

// ---------- genres / cast / pages / faq ----------

export const getGenresPage = createServerFn({ method: 'GET' }).handler(async () =>
  all(
    `SELECT g.id, g.name, g.slug, g.file_url,
            (SELECT COUNT(*) FROM entertainment_gener_mapping m WHERE m.genre_id = g.id) AS titles
     FROM genres g WHERE g.status = 1 AND g.deleted_at IS NULL ORDER BY g.name`,
  ),
)

export const getCastCrewList = createServerFn({ method: 'GET' }).handler(async () =>
  all(
    `SELECT id, name, file_url, designation, type FROM cast_crew WHERE status = 1 AND deleted_at IS NULL ORDER BY id`,
  ),
)

export const getCastDetail = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const person = await first<any>(
      `SELECT id, name, file_url, type, bio, place_of_birth, dob, designation FROM cast_crew WHERE id = ?`,
      id,
    )
    if (!person) return null
    const works = await all(
      `SELECT e.id, e.name, e.type, e.poster_url, e.IMDb_rating
       FROM entertainment_talent_mapping m JOIN entertainments e ON e.id = m.entertainment_id
       WHERE m.talent_id = ? AND e.status = 1 AND e.deleted_at IS NULL LIMIT 24`,
      id,
    ).catch(() => [])
    return { person, works }
  })

export const getFaqs = createServerFn({ method: 'GET' }).handler(async () =>
  all(`SELECT id, question, answer FROM faqs WHERE status = 1 AND deleted_at IS NULL ORDER BY id`),
)

export const getPage = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) =>
    first<any>(`SELECT id, name, description FROM pages WHERE slug = ? AND status = 1 AND deleted_at IS NULL`, slug),
  )

// ---------- trending / channels / ppv ----------

export const getTrending = createServerFn({ method: 'GET' }).handler(async () =>
  all<Content>(
    `SELECT ${CONTENT_COLS}, total_views FROM entertainments WHERE status = 1 AND deleted_at IS NULL ORDER BY total_views DESC LIMIT 24`,
  ).catch(() =>
    all<Content>(`SELECT ${CONTENT_COLS} FROM entertainments WHERE status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 24`),
  ),
)

export const getTopChannels = createServerFn({ method: 'GET' }).handler(async () =>
  all(`SELECT id, name, poster_url FROM live_tv_channel WHERE status = 1 AND deleted_at IS NULL ORDER BY id`),
)

export const getLiveTvHome = createServerFn({ method: 'GET' }).handler(async () => {
  const categories = await all(
    `SELECT id, name, slug FROM live_tv_category WHERE status = 1 AND deleted_at IS NULL ORDER BY name`,
  ).catch(() => [])
  const channels = await all(
    `SELECT c.id, c.name, c.poster_url, c.category_id, c.access, cat.name AS category
     FROM live_tv_channel c LEFT JOIN live_tv_category cat ON cat.id = c.category_id
     WHERE c.status = 1 AND c.deleted_at IS NULL ORDER BY c.id`,
  )
  const featured = channels.slice(0, 5)
  return { categories, channels, featured }
})

export const getPayPerView = createServerFn({ method: 'GET' }).handler(async () => {
  const movies = await all<Content>(
    `SELECT ${CONTENT_COLS}, price FROM entertainments WHERE movie_access = 'paid' AND status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 24`,
  ).catch(() => [])
  const videos = await all(
    `SELECT id, name, slug, poster_url, IMDb_rating, price FROM videos WHERE access = 'paid' AND status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 24`,
  ).catch(() => [])
  const episodes = await all(
    `SELECT id, name, slug, poster_url, IMDb_rating, price, entertainment_id FROM episodes WHERE access = 'paid' AND status = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 24`,
  ).catch(() => [])
  return { movies, videos, episodes }
})

// ---------- reviews ----------

export const getReviews = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) =>
    all(
      `SELECT r.id, r.rating, r.review, r.created_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), u.email) AS author
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.entertainment_id = ? AND r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 10`,
      id,
    ).catch(() => []),
  )

// ---------- account section ----------

export const getAccountData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  const user = await first<any>(
    `SELECT id, first_name, last_name, email, mobile, user_type, is_subscribe, created_at FROM users WHERE id = ?`,
    session.uid,
  )
  const subscription = await first<any>(
    `SELECT s.id, s.name, s.start_date, s.end_date, s.amount, s.status
     FROM subscriptions s WHERE s.user_id = ? AND s.deleted_at IS NULL ORDER BY s.id DESC LIMIT 1`,
    session.uid,
  ).catch(() => null)
  const devices = await all(
    `SELECT id, device_name, platform, last_activity FROM devices WHERE user_id = ? AND deleted_at IS NULL`,
    session.uid,
  ).catch(() => [])
  return { user, subscription, devices }
})

export const getPaymentHistory = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  return all(
    `SELECT id, transaction_id, amount, payment_type, payment_status, created_at
     FROM subscriptions_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
    session.uid,
  ).catch(() => [])
})

export const getProfiles = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  return all(
    `SELECT id, name, avatar, is_child_profile FROM user_multi_profiles WHERE user_id = ? AND deleted_at IS NULL`,
    session.uid,
  )
})

export const getRentHistory = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  return all(
    `SELECT p.id, p.type, p.price, p.content_price, p.first_play_date, p.view_expiry_date, p.created_at,
            COALESCE(e.name, v.name, ep.name) AS title,
            COALESCE(e.poster_url, v.poster_url, ep.poster_url) AS poster_url
     FROM pay_per_views p
     LEFT JOIN entertainments e ON p.type IN ('movie','tvshow') AND e.id = p.movie_id
     LEFT JOIN videos v ON p.type = 'video' AND v.id = p.movie_id
     LEFT JOIN episodes ep ON p.type = 'episode' AND ep.id = p.movie_id
     WHERE p.user_id = ? ORDER BY p.id DESC LIMIT 50`,
    session.uid,
  ).catch(() => [])
})

export const getNotificationsFeed = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  return all(
    `SELECT id, type, data, read_at, created_at FROM notifications
     WHERE notifiable_type LIKE '%User' AND notifiable_id = ? ORDER BY id DESC LIMIT 30`,
    session.uid,
  ).catch(() => [])
})

export const changePassword = createServerFn({ method: 'POST' })
  .validator((d: { current: string; next: string }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, error: 'Sign in required.' }
    const user = await first<any>(`SELECT id, password FROM users WHERE id = ?`, session.uid)
    if (!user) return { ok: false, error: 'Account not found.' }
    const hash = String(user.password || '').replace(/^\$2y\$/, '$2b$')
    if (!bcrypt.compareSync(data.current, hash)) return { ok: false, error: 'Current password is incorrect.' }
    if (!data.next || data.next.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' }
    await run(`UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?`, bcrypt.hashSync(data.next, 10), session.uid)
    return { ok: true }
  })

// ---------- reviews (write) ----------

export const submitReview = createServerFn({ method: 'POST' })
  .validator((d: { entertainmentId: number; rating: number; review: string }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in to write a review.' }
    const rating = Math.min(5, Math.max(1, Math.round(Number(data.rating) || 0)))
    if (!rating) return { ok: false, error: 'Please choose a rating.' }
    if (!data.review?.trim()) return { ok: false, error: 'Please write your review.' }
    const existing = await first<any>(
      `SELECT id FROM reviews WHERE entertainment_id = ? AND user_id = ? AND deleted_at IS NULL`,
      data.entertainmentId, session.uid,
    ).catch(() => null)
    if (existing) {
      await run(
        `UPDATE reviews SET rating = ?, review = ?, updated_at = datetime('now') WHERE id = ?`,
        rating, data.review.trim(), existing.id,
      )
      return { ok: true, updated: true }
    }
    await run(
      `INSERT INTO reviews (entertainment_id, user_id, rating, review, created_at, updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))`,
      data.entertainmentId, session.uid, rating, data.review.trim(),
    )
    return { ok: true, updated: false }
  })

// ---------- profiles (write) ----------

export const addProfile = createServerFn({ method: 'POST' })
  .validator((d: { name: string; isChild?: boolean }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in required.' }
    const name = data.name?.trim()
    if (!name) return { ok: false, error: 'Profile name is required.' }
    const count = await first<any>(
      `SELECT COUNT(*) AS n FROM user_multi_profiles WHERE user_id = ? AND deleted_at IS NULL`,
      session.uid,
    )
    if (Number(count?.n ?? 0) >= 5) return { ok: false, error: 'You can have at most 5 profiles.' }
    const avatar = `/avatars/avatar-${1 + Math.floor(Math.random() * 5)}.png`
    await run(
      `INSERT INTO user_multi_profiles (user_id, name, avatar, is_child_profile, created_at, updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))`,
      session.uid, name, avatar, data.isChild ? 1 : 0,
    )
    return { ok: true }
  })

export const updateProfile = createServerFn({ method: 'POST' })
  .validator((d: { id: number; name: string; isChild?: boolean }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in required.' }
    const name = data.name?.trim()
    if (!name) return { ok: false, error: 'Profile name is required.' }
    await run(
      `UPDATE user_multi_profiles SET name = ?, is_child_profile = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      name, data.isChild ? 1 : 0, data.id, session.uid,
    )
    return { ok: true }
  })

export const deleteProfile = createServerFn({ method: 'POST' })
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in required.' }
    const count = await first<any>(
      `SELECT COUNT(*) AS n FROM user_multi_profiles WHERE user_id = ? AND deleted_at IS NULL`,
      session.uid,
    )
    if (Number(count?.n ?? 0) <= 1) return { ok: false, error: 'You must keep at least one profile.' }
    await run(
      `UPDATE user_multi_profiles SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?`,
      data.id, session.uid,
    )
    return { ok: true }
  })

// ---------- checkout / payments ----------

async function settingVal(name: string): Promise<string | null> {
  const row = await first<any>(`SELECT val FROM settings WHERE name = ?`, name).catch(() => null)
  return row?.val != null && row.val !== '' ? String(row.val) : null
}

export const getCheckoutInfo = createServerFn({ method: 'GET' }).handler(async () => {
  const gateways: { id: string; label: string }[] = []
  if (await settingVal('cash_payment_method') === '1') gateways.push({ id: 'cash', label: 'Cash / Manual (instant activation)' })
  if ((await settingVal('str_payment_method')) === '1' && (await settingVal('stripe_secretkey')))
    gateways.push({ id: 'stripe', label: 'Card (Stripe)' })
  return { gateways }
})

export const validateCoupon = createServerFn({ method: 'GET' })
  .validator((d: { code: string; amount: number }) => d)
  .handler(async ({ data }) => {
    const code = data.code?.trim()
    if (!code) return { ok: false, error: 'Enter a coupon code.' }
    const c = await first<any>(
      `SELECT id, code, discount_type, discount, start_date, expire_date FROM coupons WHERE code = ? AND status = 1 AND deleted_at IS NULL`,
      code,
    ).catch(() => null)
    if (!c) return { ok: false, error: 'Invalid coupon code.' }
    const today = new Date().toISOString().slice(0, 10)
    if (c.start_date && c.start_date > today) return { ok: false, error: 'This coupon is not active yet.' }
    if (c.expire_date && c.expire_date < today) return { ok: false, error: 'This coupon has expired.' }
    const amount = Number(data.amount) || 0
    const off = c.discount_type === 'percent' || c.discount_type === 'percentage'
      ? (amount * Number(c.discount)) / 100
      : Number(c.discount)
    const discount = Math.min(amount, Math.max(0, off))
    return { ok: true, discount, finalAmount: Math.max(0, amount - discount), description: `${c.discount}${c.discount_type === 'percent' || c.discount_type === 'percentage' ? '%' : ' USD'} off` }
  })

function planEndDate(duration: string | null, durationValue: number | null): string {
  const d = new Date()
  const v = Number(durationValue) || 1
  if (duration === 'year') d.setFullYear(d.getFullYear() + v)
  else if (duration === 'week') d.setDate(d.getDate() + 7 * v)
  else if (duration === 'day') d.setDate(d.getDate() + v)
  else d.setMonth(d.getMonth() + v)
  return d.toISOString().slice(0, 10)
}

async function createSubscriptionRecord(opts: {
  uid: number; plan: any; gateway: string; transactionId: string; couponCode?: string | null; discount?: number
}) {
  const { uid, plan, gateway, transactionId, couponCode, discount } = opts
  const start = new Date().toISOString().slice(0, 10)
  const end = planEndDate(plan.duration, plan.duration_value)
  const amount = Number(plan.price) || 0
  const disc = Math.min(amount, Math.max(0, Number(discount) || 0))
  const total = Math.max(0, amount - disc)
  await run(
    `UPDATE subscriptions SET status = 'inactive', updated_at = datetime('now') WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL`,
    uid,
  ).catch(() => null)
  const res = await run(
    `INSERT INTO subscriptions (plan_id, user_id, start_date, end_date, status, is_manual, amount, discount_percentage, tax_amount, coupon_discount, total_amount, name, identifier, type, duration, level, plan_type, payment_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
    plan.id, uid, start, end, 'active', gateway === 'cash' ? 1 : 0,
    amount, plan.discount_percentage ?? 0, disc, total,
    plan.name, plan.identifier ?? plan.name, 'subscription', plan.duration ?? 'month', plan.level ?? 0,
    gateway, transactionId,
  )
  const subId = (res as any)?.meta?.last_row_id
  await run(
    `INSERT INTO subscriptions_transactions (subscriptions_id, user_id, amount, payment_type, payment_status, transaction_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`,
    subId, uid, total, gateway, 'paid', transactionId,
  )
  await run(`UPDATE users SET is_subscribe = 1, updated_at = datetime('now') WHERE id = ?`, uid)
  return { subId, total, end }
}

export const subscribePlan = createServerFn({ method: 'POST' })
  .validator((d: { planId: number; gateway: string; couponCode?: string; origin?: string }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in to subscribe.' }
    const plan = await first<any>(`SELECT * FROM plan WHERE id = ? AND status = 1 AND deleted_at IS NULL`, data.planId)
    if (!plan) return { ok: false, error: 'Plan not found.' }
    let discount = 0
    if (data.couponCode?.trim()) {
      const c = await first<any>(
        `SELECT * FROM coupons WHERE code = ? AND status = 1 AND deleted_at IS NULL`,
        data.couponCode.trim(),
      ).catch(() => null)
      if (c) {
        const today = new Date().toISOString().slice(0, 10)
        if ((!c.start_date || c.start_date <= today) && (!c.expire_date || c.expire_date >= today)) {
          const amount = Number(plan.price) || 0
          discount = c.discount_type === 'percent' || c.discount_type === 'percentage'
            ? Math.min(amount, (amount * Number(c.discount)) / 100)
            : Math.min(amount, Number(c.discount))
        }
      }
    }
    if (data.gateway === 'cash') {
      if (await settingVal('cash_payment_method') !== '1') return { ok: false, error: 'Cash payment is disabled.' }
      const txn = `CASH-${Date.now()}`
      const { total, end } = await createSubscriptionRecord({
        uid: session.uid, plan, gateway: 'cash', transactionId: txn, couponCode: data.couponCode, discount,
      })
      return { ok: true, activated: true, total, end, transactionId: txn }
    }
    if (data.gateway === 'stripe') {
      const secret = await settingVal('stripe_secretkey')
      if (!secret) return { ok: false, error: 'Stripe is not configured.' }
      const origin = data.origin || 'https://gndott.theangelorgapps.workers.dev'
      const total = Math.max(0, (Number(plan.price) || 0) - discount)
      const body = new URLSearchParams({
        mode: 'payment',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `${plan.name} subscription`,
        'line_items[0][price_data][unit_amount]': String(Math.round(total * 100)),
        'line_items[0][quantity]': '1',
        success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscription-plan?cancelled=1`,
        'metadata[plan_id]': String(plan.id),
        'metadata[user_id]': String(session.uid),
        'metadata[coupon_code]': data.couponCode?.trim() ?? '',
        'metadata[discount]': String(discount),
        customer_email: session.email,
      })
      const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      const json: any = await resp.json()
      if (!resp.ok || !json.url) {
        return { ok: false, error: `Stripe: ${json?.error?.message ?? 'could not create checkout session'}` }
      }
      return { ok: true, checkoutUrl: json.url }
    }
    return { ok: false, error: 'Choose a payment method.' }
  })

export const confirmStripeSession = createServerFn({ method: 'POST' })
  .validator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in required.' }
    const secret = await settingVal('stripe_secretkey')
    if (!secret) return { ok: false, error: 'Stripe is not configured.' }
    const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.sessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const json: any = await resp.json()
    if (!resp.ok) return { ok: false, error: `Stripe: ${json?.error?.message ?? 'could not verify session'}` }
    if (json.payment_status !== 'paid') return { ok: false, error: 'Payment not completed.' }
    if (String(json.metadata?.user_id) !== String(session.uid)) return { ok: false, error: 'Session mismatch.' }
    const plan = await first<any>(`SELECT * FROM plan WHERE id = ?`, Number(json.metadata?.plan_id))
    if (!plan) return { ok: false, error: 'Plan not found.' }
    const existing = await first<any>(
      `SELECT id FROM subscriptions_transactions WHERE transaction_id = ?`, json.id,
    ).catch(() => null)
    if (existing) return { ok: true, already: true }
    const { total, end } = await createSubscriptionRecord({
      uid: session.uid, plan, gateway: 'stripe', transactionId: json.id,
      couponCode: json.metadata?.coupon_code || null, discount: Number(json.metadata?.discount) || 0,
    })
    return { ok: true, total, end }
  })

// ---------- pay per view ----------

export const purchasePayPerView = createServerFn({ method: 'POST' })
  .validator((d: { type: 'movie' | 'video' | 'episode' | 'teaching'; id: number; gateway: string }) => d)
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in to rent.' }
    const table = data.type === 'movie' || data.type === 'teaching' ? 'entertainments' : data.type === 'video' ? 'videos' : 'episodes'
    const purchaseType = data.type === 'teaching' ? 'movie' : data.type
    const item = await first<any>(`SELECT id, name, price, access_duration, available_for FROM ${table} WHERE id = ? AND deleted_at IS NULL`, data.id)
    if (!item) return { ok: false, error: 'Content not found.' }
    const existing = await first<any>(
      `SELECT id FROM pay_per_views WHERE user_id = ? AND movie_id = ? AND type = ? AND (view_expiry_date IS NULL OR view_expiry_date >= datetime('now'))`,
      session.uid, data.id, purchaseType,
    ).catch(() => null)
    if (existing) return { ok: true, already: true }
    if (data.gateway !== 'cash') return { ok: false, error: 'Only cash/manual rental is enabled right now.' }
    if (await settingVal('cash_payment_method') !== '1') return { ok: false, error: 'Cash payment is disabled.' }
    const days = Number(item.access_duration) || 30
    const expiry = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    await run(
      `INSERT INTO pay_per_views (user_id, movie_id, type, content_price, price, discount_percentage, first_play_date, view_expiry_date, access_duration, available_for, created_at, updated_at)
       VALUES (?,?,?,?,?,0,NULL,?,?,?,datetime('now'),datetime('now'))`,
      session.uid, data.id, purchaseType, item.price ?? 0, item.price ?? 0, expiry, days, item.available_for ?? null,
    )
    return { ok: true, expiry, price: item.price ?? 0 }
  })

// ---------- OTP login ----------

export const requestOtp = createServerFn({ method: 'POST' })
  .validator((d: { contact: string }) => d)
  .handler(async ({ data }) => {
    const contact = data.contact?.trim()
    if (!contact) return { ok: false, error: 'Enter your email or mobile number.' }
    const user = await first<any>(
      `SELECT id, email, mobile, user_type, status, is_banned FROM users WHERE (email = ? OR mobile = ?) AND deleted_at IS NULL`,
      contact.toLowerCase(), contact,
    )
    if (!user) return { ok: false, error: 'No account found for that email/mobile.' }
    if (user.is_banned === 1 || user.status === 0) return { ok: false, error: 'This account is disabled.' }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    await run(
      `CREATE TABLE IF NOT EXISTS otp_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, contact TEXT, code TEXT, expires_at TEXT, used INTEGER DEFAULT 0, created_at TEXT)`,
    ).catch(() => null)
    await run(`DELETE FROM otp_codes WHERE contact = ?`, contact).catch(() => null)
    await run(
      `INSERT INTO otp_codes (contact, code, expires_at, used, created_at) VALUES (?,?,datetime('now','+10 minutes'),0,datetime('now'))`,
      contact, code,
    )
    // No SMS provider is configured on this deployment; surface the code so the flow stays usable.
    return { ok: true, devCode: code, message: 'OTP generated (no SMS provider configured — code shown for demo).' }
  })

export const verifyOtp = createServerFn({ method: 'POST' })
  .validator((d: { contact: string; code: string }) => d)
  .handler(async ({ data }) => {
    const contact = data.contact?.trim()
    const code = data.code?.trim()
    if (!contact || !code) return { ok: false, error: 'Enter the 6-digit code.' }
    const row = await first<any>(
      `SELECT id FROM otp_codes WHERE contact = ? AND code = ? AND used = 0 AND expires_at >= datetime('now')`,
      contact, code,
    ).catch(() => null)
    if (!row) return { ok: false, error: 'Invalid or expired code.' }
    await run(`UPDATE otp_codes SET used = 1 WHERE id = ?`, row.id)
    const user = await first<any>(
      `SELECT id, email, first_name, last_name FROM users WHERE (email = ? OR mobile = ?) AND deleted_at IS NULL`,
      contact.toLowerCase(), contact,
    )
    if (!user) return { ok: false, error: 'Account not found.' }
    await setSessionCookie({ uid: user.id, email: user.email, name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() })
    return { ok: true, user: { id: user.id, email: user.email, name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() } }
  })

// ---------- ads ----------

export const fetchVastMedia = createServerFn({ method: 'GET' })
  .validator((url: string) => url)
  .handler(async ({ data: url }) => {
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Streamit-VAST/1.0' } })
      const xml = await resp.text()
      const mediaMatch = xml.match(/<MediaFile[^>]*type="video\/(?:mp4|webm)"[^>]*>\s*(?:<!\[CDATA\[)?(https?:\/\/[^<\]]+)/i)
        ?? xml.match(/<MediaFile[^>]*>\s*(?:<!\[CDATA\[)?(https?:\/\/[^<\]]+\.mp4[^<\]]*)/i)
      const durMatch = xml.match(/<Duration>([^<]+)<\/Duration>/)
      if (!mediaMatch) return { ok: false, error: 'No playable media in VAST tag.' }
      return { ok: true, mediaUrl: mediaMatch[1].trim(), duration: durMatch?.[1] ?? null }
    } catch (e: any) {
      return { ok: false, error: `VAST fetch failed: ${e?.message ?? e}` }
    }
  })

export const getHomeAds = createServerFn({ method: 'GET' }).handler(async () => {
  const today = new Date().toISOString().slice(0, 10)
  return all<any>(
    `SELECT id, name, type, url_type, placement, media, redirect_url, duration
     FROM custom_ads_setting WHERE is_enable = '1' AND status = '1' AND placement = 'home_page'
       AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)`,
    today, today,
  ).catch(() => [])
})

// ---------- social login ----------

export const getSocialConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const googleClientId = await settingVal('google_client_id')
  return { googleClientId }
})

export const googleSignIn = createServerFn({ method: 'POST' })
  .validator((d: { credential: string }) => d)
  .handler(async ({ data }) => {
    const clientId = await settingVal('google_client_id')
    if (!clientId) return { ok: false, error: 'Google sign-in is not configured.' }
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(data.credential)}`)
    const tok: any = await resp.json()
    if (!resp.ok || !tok.email || tok.aud !== clientId) return { ok: false, error: 'Google token verification failed.' }
    const email = String(tok.email).toLowerCase()
    let user = await first<any>(`SELECT id, email, first_name, last_name, status, is_banned FROM users WHERE email = ?`, email)
    if (!user) {
      const names = String(tok.name ?? email.split('@')[0]).split(' ')
      const res = await run(
        `INSERT INTO users (first_name, last_name, email, password, user_type, status, is_banned, is_subscribe, login_type, created_at, updated_at)
         VALUES (?,?,?,?,?,1,0,0,'google',datetime('now'),datetime('now'))`,
        names[0] ?? 'Google', names.slice(1).join(' ') || 'User', email, '', 'user',
      ).catch(async () => {
        // login_type column may not exist — retry without it
        return run(
          `INSERT INTO users (first_name, last_name, email, password, user_type, status, is_banned, is_subscribe, created_at, updated_at)
           VALUES (?,?,?,?,?,1,0,0,datetime('now'),datetime('now'))`,
          names[0] ?? 'Google', names.slice(1).join(' ') || 'User', email, '', 'user',
        )
      })
      const uid = (res as any)?.meta?.last_row_id
      user = { id: uid, email, first_name: names[0], last_name: names.slice(1).join(' ') }
      await run(
        `INSERT INTO user_multi_profiles (user_id, name, is_child_profile, created_at, updated_at) VALUES (?,?,0,datetime('now'),datetime('now'))`,
        uid, `${names[0] ?? ''} ${names.slice(1).join(' ')}`.trim() || 'User',
      ).catch(() => null)
    }
    if (user.is_banned === 1 || user.status === 0) return { ok: false, error: 'This account is disabled.' }
    await setSessionCookie({ uid: user.id, email: user.email, name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() })
    return { ok: true }
  })
