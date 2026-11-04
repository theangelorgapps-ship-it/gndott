import { createServerFn } from '@tanstack/react-start'
import { getSession, setSessionCookie, clearSessionCookie } from './session.server'
import { all, first, run } from './db'
import bcrypt from 'bcryptjs'

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
  'id, name, slug, description, type, poster_url, thumbnail_url, release_date, IMDb_rating, duration, language, movie_access, content_rating, trailer_url'

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
  return { top10, popularMovies, popularTvShows, latest, free, genres, channels, comingSoon, payPerView, languages, cast, mostWatched }
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
    const [movies, tvshows, videos, channels] = await Promise.all([
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'movie' AND name LIKE ? AND status = 1 AND deleted_at IS NULL LIMIT 20`,
        like,
      ),
      all<Content>(
        `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'tvshow' AND name LIKE ? AND status = 1 AND deleted_at IS NULL LIMIT 20`,
        like,
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
    return { movies, tvshows, videos, channels }
  })

export const getMovie = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const movie = await first<Content>(
      `SELECT ${CONTENT_COLS} FROM entertainments WHERE id = ? AND deleted_at IS NULL`,
      id,
    )
    if (!movie) return null
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
    return { movie, genres, cast, similar, reviewStats, reviews, clips }
  })

export const getTvShow = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const show = await first<Content>(
      `SELECT ${CONTENT_COLS} FROM entertainments WHERE id = ? AND deleted_at IS NULL`,
      id,
    )
    if (!show) return null
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
      `SELECT id, title, url, poster_url, type FROM clips WHERE content_id = ? AND content_type = 'tvshow' AND deleted_at IS NULL LIMIT 8`,
      id,
    ).catch(() => [])
    const similar = await all<Content>(
      `SELECT ${CONTENT_COLS} FROM entertainments WHERE type = 'tvshow' AND id != ? AND status = 1 AND deleted_at IS NULL ORDER BY RANDOM() LIMIT 8`,
      id,
    ).catch(() => [])
    return { show, seasons, episodes, genres, cast, reviews, clips, similar }
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
    return { video, similar, reviews, clips }
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
    return { ok: true }
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
