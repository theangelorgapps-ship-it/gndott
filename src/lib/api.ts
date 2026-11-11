import { sanitizePublicContentHtml } from './content-html'
import type { HeroDesign } from './hero-design'
import { loadConfiguredHeroes } from './heroes.server'
import { createServerFn } from '@tanstack/react-start'
import { playbackFields, positiveId, profileInput, publicHttpsUrl, publicNavigationUrl, readVastMedia } from './api-security'
import { getSession, clearSessionCookie } from './session.server'
import { all, first, run } from './db'
import { buildRecommendationPayload, buildMixedPopular } from './recommendations'
import { isChildViewer, loadRecommendationCandidates, loadRecommendationSignals } from './recommendations.server'
import { getActiveViewer } from './viewer.server'
import { loadViewingHistory, viewingQuery } from './viewing-history.server'
import { subscriptionPlaybackAccess, entitlementDatabase } from './entitlement.server'
import { resolveEntitlement, subscriptionDashboard } from './entitlement-core'
import { requiresSubscription, subscriptionFields } from './subscriptionPolicy'
import { loadPersonalities, loadTitlePeople, loadTitleLocations, loadPersonalityDetail } from './people.server'
import type { RecommendationPayload } from './recommendations'

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
  hero_design?: HeroDesign
}

// ---------- content queries ----------

const CONTENT_COLS =
  'id, name, slug, description, type, poster_url, thumbnail_url, release_date, IMDb_rating, duration, language, movie_access, content_rating, trailer_url, bunny_trailer_url, video_upload_type'

const HERO_COLS = `${CONTENT_COLS}, CASE WHEN movie_access = 'free' THEN video_url_input ELSE NULL END AS video_url_input, (SELECT GROUP_CONCAT(g.name) FROM genres g JOIN entertainment_gener_mapping m ON m.genre_id = g.id WHERE m.entertainment_id = entertainments.id AND g.status = 1 AND g.deleted_at IS NULL) AS genre_names`

const DETAIL_COLS = `${CONTENT_COLS}, bunny_video_url, video_url_input, enable_quality, enable_subtitle, subtitle_file, subtitle_language, plan_id, price, purchase_type, access_duration, available_for, meta_title, meta_description`

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
     FROM custom_ads_setting WHERE is_enable = '1' AND status = '1' AND deleted_at IS NULL
       AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)`,
    today, today,
  ).catch(() => [])
  return { vast, custom: custom.map(ad => ({ ...ad, redirect_url: publicNavigationUrl(ad.redirect_url) })) }
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
  const viewer = await getActiveViewer()
  if (viewer?.userId !== uid || !viewer.profileId) return false
  const row = await first<any>(
    `SELECT w.id FROM watchlists w JOIN entertainments e ON e.id = w.entertainment_id
     WHERE w.user_id = ? AND w.profile_id = ? AND w.entertainment_id = ?
     AND (w.type IS NULL OR w.type = e.type) AND w.deleted_at IS NULL`,
    uid, viewer.profileId, entertainmentId,
  )
  return !!row
}

interface RecommendationContext {
  userId: number | null
  currentId?: number
  currentType?: string
  currentGenres?: string[]
}

async function loadRecommendations(context: RecommendationContext): Promise<RecommendationPayload> {
  const active = context.userId == null ? null : await getActiveViewer()
  const viewer = active?.userId === context.userId && active?.profileId ? active : null
  const child = await isChildViewer(viewer)
  const [{ history, saved }, candidates] = await Promise.all([
    loadRecommendationSignals(viewer, child),
    loadRecommendationCandidates(child),
  ])
  return buildRecommendationPayload({
    candidates, history, saved,
    seed: viewer ? `${viewer.userId}:${viewer.profileId}` : 'guest',
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
  const viewer = await getActiveViewer()
  const child = await isChildViewer(viewer)
  const visible = child ? ' AND COALESCE(is_restricted, 0) = 0' : ''
  const [top10, popularMovies, popularTvShows, latest, free, genres, channels, comingSoon,
    payPerView, languages, cast, heroes, candidates, signals] =
    await Promise.all([
      all<Content>(
        `SELECT ${HERO_COLS} FROM entertainments WHERE status = 1 AND deleted_at IS NULL${visible} ORDER BY total_views DESC LIMIT 10`,
      ).catch(() =>
        all<Content>(
          `SELECT ${HERO_COLS} FROM entertainments WHERE status = 1 AND deleted_at IS NULL${visible} ORDER BY id DESC LIMIT 10`,
        ),
      ),
      all<Content>(
        `SELECT ${HERO_COLS} FROM entertainments WHERE type = 'movie' AND status = 1 AND deleted_at IS NULL${visible} ORDER BY id DESC LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${HERO_COLS} FROM entertainments WHERE type = 'tvshow' AND status = 1 AND deleted_at IS NULL${visible} ORDER BY id DESC LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${HERO_COLS} FROM entertainments WHERE status = 1 AND deleted_at IS NULL${visible} AND (release_date IS NULL OR release_date <= date('now')) ORDER BY release_date DESC LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${HERO_COLS} FROM entertainments WHERE movie_access = 'free' AND status = 1 AND deleted_at IS NULL${visible} LIMIT 12`,
      ),
      all(`SELECT id, name, slug, file_url FROM genres WHERE status = 1 AND deleted_at IS NULL ORDER BY name`),
      all(
        `SELECT id, name, poster_url FROM live_tv_channel WHERE status = 1 AND deleted_at IS NULL LIMIT 12`,
      ).catch(() => []),
      all<Content>(
        `SELECT ${HERO_COLS} FROM entertainments WHERE release_date > date('now') AND status = 1 AND deleted_at IS NULL${visible} ORDER BY release_date LIMIT 12`,
      ),
      all<Content>(
        `SELECT ${HERO_COLS} FROM entertainments WHERE movie_access = 'paid' AND status = 1 AND deleted_at IS NULL${visible} ORDER BY id DESC LIMIT 12`,
      ),
      all(
        `SELECT language AS name, COUNT(*) AS titles FROM entertainments
         WHERE language IS NOT NULL AND language != '' AND status = 1 AND deleted_at IS NULL
         GROUP BY language ORDER BY titles DESC LIMIT 10`,
      ).catch(() => []),
      loadPersonalities(12),
      loadConfiguredHeroes('home', child),
      loadRecommendationCandidates(child),
      loadRecommendationSignals(viewer, child),
    ])
  const bunnyLibraryId = await getBunnyLibraryId()
  const recommendations = buildRecommendationPayload({ candidates, ...signals, seed: viewer?.profileId ? `${viewer.userId}:${viewer.profileId}` : 'guest' })
  const popular = buildMixedPopular(candidates)
  const mostWatched = buildMixedPopular(candidates.filter(item => item.type === 'video'))
  const collections = (['movie', 'teaching', 'tvshow', 'video'] as const).flatMap(type => {
    const titles = candidates.filter(item => item.type === type)
    return titles.length ? [{ type, count: titles.length, artwork: titles.find(item => item.thumbnail_url)?.thumbnail_url || titles.find(item => item.poster_url)?.poster_url || null }] : []
  })
  return { popular, collections, top10, popularMovies, popularTvShows, latest, free, genres, channels, comingSoon, payPerView, languages, cast, mostWatched, recommendations, bunnyLibraryId, heroes }
})

export const getMovies = createServerFn({ method: 'GET' }).handler(async () => {
  const movies = await all<Content & { categories_json: string }>(
    `SELECT ${HERO_COLS},
      (SELECT json_group_array(json_object('id',g.id,'name',g.name))
       FROM genres g JOIN entertainment_gener_mapping m ON m.genre_id = g.id
       WHERE m.entertainment_id = entertainments.id AND g.status = 1 AND g.deleted_at IS NULL) AS categories_json
     FROM entertainments WHERE type = 'movie' AND status = 1 AND deleted_at IS NULL ORDER BY name`,
  )
  return movies.map(({ categories_json, ...movie }) => ({ ...movie, categories: JSON.parse(categories_json || '[]') as { id: number; name: string }[] }))
})

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
      `SELECT ${DETAIL_COLS} FROM entertainments WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
      id,
    )
    if (!movie) return null
    const session = await getSession()
    const genres = await all(
      `SELECT g.id, g.name FROM genres g JOIN entertainment_gener_mapping m ON m.genre_id = g.id WHERE m.entertainment_id = ?`,
      id,
    ).catch(() => [])
    const [cast, locations] = await Promise.all([loadTitlePeople(id), loadTitleLocations('entertainment', id)])
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
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), 'Halobox viewer') AS author
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
    const sub = session && requiresSubscription(movie) ? await resolveEntitlement(entitlementDatabase(), session.uid) : null
    const allowed = !!sub && await subscriptionPlaybackAccess()
    return { movie: subscriptionFields(playbackFields(movie, !!myPurchase), sub, allowed), genres, cast, locations, similar, reviewStats, reviews, clips, bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations, viewerId: session?.uid ?? null }
  })

export const getTvShow = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const show = await first<Content>(
      `SELECT ${DETAIL_COLS} FROM entertainments WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
      id,
    )
    if (!show) return null
    const session = await getSession()
    const seasons = await all(
      `SELECT id, name, season_index, poster_url, short_desc FROM seasons WHERE entertainment_id = ? AND deleted_at IS NULL ORDER BY CAST(season_index AS INTEGER)`,
      id,
    )
    const episodes = await all(
      `SELECT id, name, season_id, poster_url, thumbnail_url, duration, release_date, episode_number, description, short_desc, bunny_video_url, trailer_url, video_url_input, access, plan_id, price FROM episodes WHERE entertainment_id = ? AND status = 1 AND deleted_at IS NULL ORDER BY id`,
      id,
    )
    await Promise.all(episodes.map(async (episode) => { episode.locations = await loadTitleLocations('episode', Number(episode.id)) }))
    // Each paid episode has its own entitlement; a show rental is not an episode purchase.
    if (session?.uid) {
      const purchases = await all<{ movie_id: number }>(
        `SELECT movie_id FROM pay_per_views WHERE user_id = ? AND type = 'episode' AND (view_expiry_date IS NULL OR view_expiry_date >= datetime('now'))`,
        session.uid,
      ).catch(() => [])
      const owned = new Set(purchases.map((purchase) => Number(purchase.movie_id)))
      for (const episode of episodes) episode.myPurchase = owned.has(Number(episode.id))
    }
    const genres = await all(
      `SELECT g.id, g.name FROM genres g JOIN entertainment_gener_mapping m ON m.genre_id = g.id WHERE m.entertainment_id = ?`,
      id,
    ).catch(() => [])
    const [cast, locations] = await Promise.all([loadTitlePeople(id), loadTitleLocations('entertainment', id)])
    const reviews = await all(
      `SELECT r.id, r.rating, r.review, r.created_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), 'Halobox viewer') AS author
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
    const sub = session && [show,...episodes].some(requiresSubscription) ? await resolveEntitlement(entitlementDatabase(), session.uid) : null
    const allowed = !!sub && await subscriptionPlaybackAccess()
    const safeShow = subscriptionFields(playbackFields(show, !!myPurchase), sub, allowed)
    const parentDenied = (show.movie_access === 'paid' && !myPurchase) || safeShow.hasSubscriptionAccess === false
    return { show: safeShow, seasons, episodes: episodes.map(episode => subscriptionFields(playbackFields(episode, !!episode.myPurchase, parentDenied), sub, allowed)), genres, cast, locations, reviews, clips, similar, bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations, viewerId: session?.uid ?? null }
  })

export const getVideo = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const video = await first<Content>(
      `SELECT * FROM videos WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
      id,
    )
    if (!video) return null
    const locations = await loadTitleLocations('video', id)
    const similar = await all<Content>(
      `SELECT id, name, slug, poster_url, duration, IMDb_rating FROM videos WHERE id != ? AND status = 1 AND deleted_at IS NULL ORDER BY RANDOM() LIMIT 8`,
      id,
    )
    const reviews = await all(
      `SELECT r.id, r.rating, r.review, r.created_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), 'Halobox viewer') AS author
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
    const myPurchase = session && (video as any).access === 'paid' ? await first<any>(`SELECT id FROM pay_per_views WHERE user_id = ? AND movie_id = ? AND type = 'video' AND (view_expiry_date IS NULL OR view_expiry_date >= datetime('now'))`, session.uid, id).catch(() => null) : null
    const sub = session && requiresSubscription(video) ? await resolveEntitlement(entitlementDatabase(), session.uid) : null
    const allowed = !!sub && await subscriptionPlaybackAccess()
    return { video: subscriptionFields(playbackFields(video, !!myPurchase), sub, allowed), myPurchase, locations, similar, reviews, clips, bunnyLibraryId, ads, myReview, recommendations, viewerId: session?.uid ?? null }
  })

export const getChannel = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const channel = await first(
      `SELECT c.id, c.name, c.slug, c.poster_url, c.description, c.access, c.plan_id, c.category_id, cat.name AS category FROM live_tv_channel c LEFT JOIN live_tv_category cat ON cat.id = c.category_id WHERE c.id = ? AND c.status = 1 AND c.deleted_at IS NULL`,
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
  .validator((id: number) => positiveId(id))
  .handler(async ({ data: id }) => {
    const genre = await first(`SELECT id, name, description FROM genres WHERE id = ? AND status = 1 AND deleted_at IS NULL`, id)
    if (!genre) return { genre: null, items: [] as Content[] }
    const child = await isChildViewer(await getActiveViewer())
    const items = await all<Content>(
      `SELECT DISTINCT ${CONTENT_COLS.split(',').map((column) => `e.${column.trim()}`).join(', ')} FROM entertainments e JOIN entertainment_gener_mapping m ON m.entertainment_id = e.id
       WHERE m.genre_id = ? AND m.deleted_at IS NULL AND e.status = 1 AND e.deleted_at IS NULL
         AND TRIM(COALESCE(e.name, '')) != '' AND (? = 0 OR COALESCE(e.is_restricted, 0) = 0) ORDER BY e.name`,
      id, child ? 1 : 0,
    )
    return { genre, items }
  })

// ---------- auth ----------

export const login = createServerFn({ method: 'POST' })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => (await import('./auth.server')).passwordLogin(data))

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await clearSessionCookie()
  return { ok: true }
})

export const getSessionUser = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  const user = await first<any>(
    `SELECT id, email, first_name, last_name, mobile, is_subscribe, user_type FROM users WHERE id = ? AND status = 1 AND COALESCE(is_banned, 0) = 0 AND deleted_at IS NULL`,
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
  const viewer = await getActiveViewer()
  if (!viewer) return { needsAuth: true, needsProfile: false, items: [] }
  if (!viewer.profileId) return { needsAuth: false, needsProfile: true, items: [] }
  const items = await all(
    `SELECT w.id AS watch_id, e.id, e.name, e.type, e.poster_url, e.IMDb_rating
     FROM watchlists w JOIN entertainments e ON e.id = w.entertainment_id
       AND (w.type IS NULL OR w.type = e.type) AND e.status = 1 AND e.deleted_at IS NULL
     WHERE w.user_id = ? AND w.profile_id = ? AND w.deleted_at IS NULL ORDER BY w.id DESC`,
    viewer.userId, viewer.profileId,
  )
  return { needsAuth: false, needsProfile: false, items }
})

export const toggleWatchlist = createServerFn({ method: 'POST' })
  .validator((d: { entertainmentId: number }) => {
    if (!d || !Number.isSafeInteger(d.entertainmentId) || d.entertainmentId <= 0) throw new Error('Invalid title.')
    return d
  })
  .handler(async ({ data }) => {
    const viewer = await getActiveViewer()
    if (!viewer) return { ok: false, needsAuth: true }
    if (!viewer.profileId) return { ok: false, needsProfile: true }
    const content = await first<any>('SELECT id, type FROM entertainments WHERE id = ? AND status = 1 AND deleted_at IS NULL', data.entertainmentId)
    if (!content) return { ok: false }
    const existing = await first<any>(
      `SELECT id FROM watchlists WHERE user_id = ? AND profile_id = ? AND entertainment_id = ?
       AND (type IS NULL OR type = ?) AND deleted_at IS NULL`,
      viewer.userId, viewer.profileId, content.id, content.type,
    )
    if (existing) {
      await run(`UPDATE watchlists SET deleted_at = datetime('now') WHERE user_id = ? AND profile_id = ? AND entertainment_id = ? AND (type IS NULL OR type = ?) AND deleted_at IS NULL`, viewer.userId, viewer.profileId, content.id, content.type)
      return { ok: true, added: false }
    }
    await run(
      `INSERT INTO watchlists (user_id, profile_id, entertainment_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      viewer.userId, viewer.profileId, content.id, content.type,
    )
    return { ok: true, added: true }
  })

export const getContinueWatching = createServerFn({ method: 'GET' }).handler(() => loadViewingHistory(viewingQuery()))

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
  .handler(async ({ data }) => (await import('./auth.server')).registerAccount(data))

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
  const entitlement = session ? await resolveEntitlement(entitlementDatabase(), session.uid) : null
  const activeSub = entitlement ? { name: entitlement.name, end_date: entitlement.end_date, status: 'active', role: entitlement.owner_user_id === session?.uid ? 'owner' : 'member' } : null
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

export const getCastCrewList = createServerFn({ method: 'GET' }).handler(() => loadPersonalities())

export const getCastDetail = createServerFn({ method: 'GET' })
  .validator((id: number) => positiveId(id))
  .handler(({ data: id }) => loadPersonalityDetail(id))

export const getFaqs = createServerFn({ method: 'GET' }).handler(async () => {
  const rows = await all<any>(`SELECT id, question, answer FROM faqs WHERE status = 1 AND deleted_at IS NULL ORDER BY id`)
  return rows.map(row => ({ ...row, answer: sanitizePublicContentHtml(row.answer) }))
})

export const getPage = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const page = await first<any>(`SELECT id, name, description FROM pages WHERE slug = ? AND status = 1 AND deleted_at IS NULL`, slug)
    return page ? { ...page, description: sanitizePublicContentHtml(page.description) } : null
  })

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
    `SELECT ep.id, ep.name, ep.slug, ep.poster_url, ep.IMDb_rating, ep.price, ep.entertainment_id, e.name AS show_name, e.slug AS show_slug FROM episodes ep JOIN entertainments e ON e.id=ep.entertainment_id AND e.status=1 AND e.deleted_at IS NULL WHERE ep.access = 'paid' AND ep.status = 1 AND ep.deleted_at IS NULL ORDER BY ep.id DESC LIMIT 24`,
  ).catch(() => [])
  return { movies, videos, episodes }
})

// ---------- reviews ----------

export const getReviews = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) =>
    all(
      `SELECT r.id, r.rating, r.review, r.created_at,
              COALESCE(NULLIF(TRIM(u.first_name || ' ' || IFNULL(u.last_name,'')), ''), 'Halobox viewer') AS author
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.entertainment_id = ? AND r.deleted_at IS NULL ORDER BY r.id DESC LIMIT 10`,
      id,
    ).catch(() => []),
  )

// ---------- account section ----------

export const getAccountData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  // User row and the sharing dashboard are independent — run them together.
  const [user, sharing] = await Promise.all([
    first<any>(
      `SELECT id, first_name, last_name, email, mobile, user_type, is_subscribe, created_at FROM users WHERE id = ?`,
      session.uid,
    ),
    subscriptionDashboard(entitlementDatabase(), session),
  ])
  return { user, subscription: sharing.entitlement, devices: sharing.devices, sharing }
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

// Grouped money ledger for the account's Payment History: subscriptions,
// giving (donations incl. monthly partnerships) and store purchases.
export const getTransactionLedger = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) return null
  const [subscriptions, giving, purchases] = await Promise.all([
    all(`SELECT id, transaction_id, amount, payment_type, payment_status, created_at FROM subscriptions_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50`, session.uid).catch(() => []),
    all(`SELECT id, kind, frequency, amount_cents, currency, status, created_at FROM donations WHERE user_id = ? AND status != 'expired' ORDER BY created_at DESC LIMIT 50`, session.uid).catch(() => []),
    all(`SELECT id, order_id, total_minor, currency, status, created_at FROM store_checkouts WHERE user_id = ? AND status IN ('paid','failed') ORDER BY created_at DESC LIMIT 50`, session.uid).catch(() => []),
  ])
  return { subscriptions, giving, purchases }
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
  .handler(async ({ data }) => (await import('./auth.server')).changeAccountPassword(data))

// ---------- reviews (write) ----------

export const submitReview = createServerFn({ method: 'POST' })
  .validator((d: { entertainmentId: number; rating: number; review: string }) => {
    positiveId(d?.entertainmentId)
    if (!Number.isInteger(d.rating) || d.rating < 1 || d.rating > 5 || typeof d.review !== 'string' || !d.review.trim() || d.review.length > 5000) throw new Error('Choose a rating from 1–5 and write a review of up to 5,000 characters.')
    return d
  })
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
  .validator((d: { name: string; isChild?: boolean }) => profileInput(d))
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
    const avatar = `/images/avatars/icon${1 + Math.floor(Math.random() * 5)}.avif`
    await run(
      `INSERT INTO user_multi_profiles (user_id, name, avatar, is_child_profile, created_at, updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))`,
      session.uid, name, avatar, data.isChild ? 1 : 0,
    )
    return { ok: true }
  })

export const updateProfile = createServerFn({ method: 'POST' })
  .validator((d: { id: number; name: string; isChild?: boolean }) => ({ ...profileInput(d), id: positiveId(d.id) }))
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
  .validator((d: { id: number }) => ({ id: positiveId(d?.id) }))
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

export const getCheckoutInfo = createServerFn({ method: 'GET' })
  .validator((d: { planId: number }) => d)
  .handler(async ({ data }) => {
    const checkout = await import('./subscriptionCheckout.server')
    try { return await checkout.getSubscriptionCheckoutInfo(data.planId) }
    catch (error) { return { gateways: [], quote: null, error: checkout.checkoutError(error) } }
  })

export const validateCoupon = createServerFn({ method: 'GET' })
  .validator((d: { code: string; planId: number }) => d)
  .handler(async ({ data }) => {
    const checkout = await import('./subscriptionCheckout.server')
    try {
      const { db } = await checkout.stripeConfiguration()
      const { quote } = await checkout.readSubscriptionQuote(db, data.planId, data.code)
      return { ok: true as const, quote }
    } catch (error) { return { ok: false as const, error: checkout.checkoutError(error) } }
  })

export const subscribePlan = createServerFn({ method: 'POST' })
  .validator((d: { planId: number; gateway: string; couponCode?: string; requestKey: string; expectedTotalCents: number }) => d)
  .handler(async ({ data }) => {
    const checkout = await import('./subscriptionCheckout.server')
    try {
      const origin = checkout.subscriptionWriteOrigin()
      const user = await checkout.subscriptionActor()
      if (!user) return { ok: false as const, needsAuth: true, error: 'Sign in with an active account to subscribe.' }
      const { db, secret, enabled } = await checkout.stripeConfiguration()
      if (!enabled || !secret) return { ok: false as const, error: 'Online checkout is temporarily unavailable. Please try again later.' }
      return await checkout.createSubscriptionCheckout(db, user, data, origin, secret)
    } catch (error) { return { ok: false as const, error: checkout.checkoutError(error) } }
  })

export const confirmStripeSession = createServerFn({ method: 'POST' })
  .validator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const checkout = await import('./subscriptionCheckout.server')
    try {
      checkout.subscriptionWriteOrigin()
      const user = await checkout.subscriptionActor()
      if (!user) return { ok: false as const, needsAuth: true, error: 'Sign in to the account used at checkout to verify your payment.' }
      // A store order session confirms through the bridge; anything else is a subscription.
      const store = await import('./storeCheckout.server')
      const storeResult = await store.confirmStoreCheckout(data.sessionId, user.id)
      if (storeResult) return storeResult
      return await checkout.confirmSubscriptionCheckout(data.sessionId, user.id)
    } catch (error) { return { ok: false as const, error: checkout.checkoutError(error) } }
  })

// ---------- pay per view ----------

export const purchasePayPerView = createServerFn({ method: 'POST' })
  .validator((d: { type: 'movie' | 'video' | 'episode' | 'teaching'; id: number; gateway: string }) => { positiveId(d?.id); if (!['movie', 'video', 'episode', 'teaching'].includes(d.type)) throw new Error('Choose a valid rental.'); return d })
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) return { ok: false, needsAuth: true, error: 'Sign in to rent.' }
    const table = data.type === 'movie' || data.type === 'teaching' ? 'entertainments' : data.type === 'video' ? 'videos' : 'episodes'
    const purchaseType = data.type === 'teaching' ? 'movie' : data.type
    const item = await first<any>(`SELECT id, name, price, access_duration, available_for FROM ${table} WHERE id = ? AND status = 1 AND deleted_at IS NULL`, data.id)
    if (!item) return { ok: false, error: 'Content not found.' }
    const existing = await first<any>(
      `SELECT id FROM pay_per_views WHERE user_id = ? AND movie_id = ? AND type = ? AND (view_expiry_date IS NULL OR view_expiry_date >= datetime('now'))`,
      session.uid, data.id, purchaseType,
    ).catch(() => null)
    if (existing) return { ok: true, already: true }
    // A client-selected manual gateway is not proof of payment. Entitlements
    // are fulfilled only by a trusted payment/admin workflow.
    return { ok: false, error: 'Online rentals are unavailable. Contact support to arrange your rental.' }
  })

// ---------- OTP login ----------

// Retain endpoint contracts for older clients, but never return a login secret to its requester.
// A verified delivery provider is required before one-time code login can be enabled.
export const requestOtp = createServerFn({ method: 'POST' })
  .validator((d: { contact: string }) => d)
  .handler(async ({ data }) => (await import('./auth.server')).requestEmailOtp(data.contact))
export const verifyOtp = createServerFn({ method: 'POST' })
  .validator((d: { contact: string; code: string }) => d)
  .handler(async ({ data }) => (await import('./auth.server')).verifyEmailOtp(data.contact, data.code))

// ---------- ads ----------

export const fetchVastMedia = createServerFn({ method: 'GET' })
  .validator((url: string) => { if (typeof url !== 'string' || url.length > 2048) throw new Error('Invalid media URL.'); return url })
  .handler(async ({ data: url }) => {
    try {
      publicHttpsUrl(url)
      const today = new Date().toISOString().slice(0, 10)
      const configured = await first(`SELECT id FROM vast_ads_setting WHERE url = ? AND is_enable = '1' AND status = '1' AND deleted_at IS NULL AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) LIMIT 1`, url, today, today)
      if (!configured) return { ok: false, error: 'Ad unavailable.' }
      return await readVastMedia(url)
    } catch { return { ok: false, error: 'Ad unavailable.' } }
  })

export const getHomeAds = createServerFn({ method: 'GET' }).handler(async () => {
  const today = new Date().toISOString().slice(0, 10)
  return all<any>(
    `SELECT id, name, type, url_type, placement, media, redirect_url, duration
     FROM custom_ads_setting WHERE is_enable = '1' AND status = '1' AND deleted_at IS NULL AND placement = 'home_page'
       AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)`,
    today, today,
  ).then(rows => rows.map(ad => ({ ...ad, redirect_url: publicNavigationUrl(ad.redirect_url) }))).catch(() => [])
})

// ---------- social login ----------

export const getSocialConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const config = (await import('./better-auth.server')).authProviderConfig()
  return { googleEnabled: config.googleEnabled, appleEnabled: config.appleEnabled }
})

/** Old GIS responses have no server challenge; they must restart the bound authorization flow. */
export const googleSignIn = createServerFn({ method: 'POST' })
  .validator((d: { credential: string }) => d)
  .handler(async () => ({ ok: false, error: 'Please use Continue with Google to start a new sign-in.' }))
