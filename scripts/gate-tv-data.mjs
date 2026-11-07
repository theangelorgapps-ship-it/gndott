#!/usr/bin/env node
// Run the real API handlers and DB adapter against isolated SQLite fixtures.
// No application SQL is copied here, no server is started, and no remote DB is used.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const db = new DatabaseSync(':memory:')
const queryErrors = []
let session = null

// These schema fixtures intentionally include id in both join tables. Using
// unqualified CONTENT_COLS would be ambiguous, as it was in the original query.
const tables = {
  entertainments: `id INTEGER PRIMARY KEY, name TEXT, slug TEXT, description TEXT, type TEXT, poster_url TEXT, thumbnail_url TEXT, release_date TEXT, IMDb_rating TEXT, duration TEXT, language TEXT, movie_access TEXT, content_rating TEXT, trailer_url TEXT, bunny_video_url TEXT, bunny_trailer_url TEXT, video_url_input TEXT, video_upload_type TEXT, enable_quality INTEGER, enable_subtitle INTEGER, subtitle_file TEXT, subtitle_language TEXT, price REAL, purchase_type TEXT, access_duration INTEGER, available_for TEXT, meta_title TEXT, meta_description TEXT, total_views INTEGER, created_at TEXT, updated_at TEXT, status INTEGER, deleted_at TEXT`,
  genres: `id INTEGER PRIMARY KEY, name TEXT, slug TEXT, description TEXT, status INTEGER, deleted_at TEXT`,
  entertainment_gener_mapping: `id INTEGER PRIMARY KEY, entertainment_id INTEGER, genre_id INTEGER`,
  seasons: `id INTEGER PRIMARY KEY, name TEXT, season_index TEXT, poster_url TEXT, short_desc TEXT, entertainment_id INTEGER, deleted_at TEXT`,
  episodes: `id INTEGER PRIMARY KEY, name TEXT, season_id INTEGER, entertainment_id INTEGER, poster_url TEXT, thumbnail_url TEXT, duration TEXT, release_date TEXT, episode_number TEXT, description TEXT, short_desc TEXT, bunny_video_url TEXT, trailer_url TEXT, video_url_input TEXT, access TEXT, price REAL, status INTEGER, deleted_at TEXT`,
  settings: `name TEXT, val TEXT`,
  live_tv_channel: `id INTEGER PRIMARY KEY, name TEXT, poster_url TEXT, status INTEGER, deleted_at TEXT`,
  cast_crew: `id INTEGER PRIMARY KEY, name TEXT, type TEXT, file_url TEXT, designation TEXT, status INTEGER, deleted_at TEXT`,
  entertainment_talent_mapping: `entertainment_id INTEGER, talent_id INTEGER`,
  videos: `id INTEGER PRIMARY KEY, name TEXT, slug TEXT, description TEXT, poster_url TEXT, thumbnail_url TEXT, release_date TEXT, IMDb_rating TEXT, duration TEXT, access TEXT, content_rating TEXT, trailer_url TEXT, video_url_input TEXT, created_at TEXT, updated_at TEXT, status INTEGER, deleted_at TEXT`,
  continue_watch: `id INTEGER PRIMARY KEY, entertainment_id INTEGER, entertainment_type TEXT, user_id INTEGER, watched_time INTEGER, total_watched_time INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT`,
  watchlists: `id INTEGER PRIMARY KEY, entertainment_id INTEGER, user_id INTEGER, deleted_at TEXT`,
  reviews: `id INTEGER PRIMARY KEY, rating REAL, review TEXT, created_at TEXT, user_id INTEGER, entertainment_id INTEGER, deleted_at TEXT`,
  users: `id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT`,
  clips: `id INTEGER PRIMARY KEY, title TEXT, url TEXT, poster_url TEXT, type TEXT, content_id INTEGER, content_type TEXT, deleted_at TEXT`,
  pay_per_views: `id INTEGER PRIMARY KEY, user_id INTEGER, movie_id INTEGER, type TEXT, view_expiry_date TEXT`,
  vast_ads_setting: `id INTEGER PRIMARY KEY, name TEXT, type TEXT, url TEXT, duration INTEGER, target_type TEXT, target_selection TEXT, enable_skip INTEGER, skip_after INTEGER, is_enable TEXT, status TEXT, deleted_at TEXT, start_date TEXT, end_date TEXT`,
  custom_ads_setting: `id INTEGER PRIMARY KEY, name TEXT, type TEXT, url_type TEXT, placement TEXT, media TEXT, redirect_url TEXT, duration INTEGER, skip_enabled INTEGER, skip_after INTEGER, is_enable TEXT, status TEXT, start_date TEXT, end_date TEXT`,
}
for (const [name, columns] of Object.entries(tables)) db.exec(`CREATE TABLE ${name} (${columns})`)
function insert(table, row) {
  const keys = Object.keys(row)
  db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...Object.values(row))
}
function content(id, overrides = {}) {
  insert('entertainments', { id, name: `Title ${id}`, type: 'movie', status: 1, total_views: 100 - id, movie_access: 'free', release_date: '2024-01-01', ...overrides })
}
content(1)
content(2)
content(3, { status: 0 })
content(4, { deleted_at: '2024-01-01' })
content(5) // Deliberately unmapped: no invented fallback genre.
content(6, { movie_access: 'paid', price: 5, release_date: '2999-01-01' })
content(10, { type: 'tvshow', movie_access: 'paid', price: 9, bunny_video_url: 'show-source' })
content(11, { type: 'tvshow' })
insert('videos', { id: 100, name: 'Video fixture', status: 1, access: 'free', trailer_url: 'https://example.test/video-trailer.mp4', video_url_input: 'https://example.test/video-full.mp4' })
insert('videos', { id: 101, name: 'Inactive video', status: 0 })
insert('videos', { id: 102, name: 'Deleted video', status: 1, deleted_at: '2024-01-01' })
for (const row of [
  { id: 1, name: 'Drama', status: 1 },
  { id: 2, name: 'Comedy', status: 1 },
  { id: 3, name: 'Inactive genre', status: 0 },
  { id: 4, name: 'Deleted genre', status: 1, deleted_at: '2024-01-01' },
]) insert('genres', row)
for (const [id, entertainment_id, genre_id] of [[101, 1, 1], [102, 2, 2], [103, 3, 1], [104, 4, 1], [105, 1, 3], [106, 1, 4], [107, 6, 1], [108, 10, 2]]) {
  insert('entertainment_gener_mapping', { id, entertainment_id, genre_id })
}
insert('settings', { name: 'bunny_library_id', val: 'library-fixture' })
insert('seasons', { id: 1, entertainment_id: 10, name: 'Season 2', season_index: '2' })
insert('seasons', { id: 2, entertainment_id: 10, name: 'Season 10', season_index: '10' })
insert('seasons', { id: 3, entertainment_id: 10, name: 'Season 1', season_index: '1' })
function episode(id, overrides = {}) {
  insert('episodes', { id, name: `Episode ${id}`, entertainment_id: 10, season_id: 1, status: 1, access: 'paid', price: 3.5, bunny_video_url: `episode-${id}`, trailer_url: `https://example.test/trailer-${id}.mp4`, video_url_input: `https://example.test/full-${id}.mp4`, thumbnail_url: `https://example.test/episode-${id}.jpg`, episode_number: String(id), description: `Full description ${id}`, short_desc: `Short description ${id}`, ...overrides })
}
episode(20)
episode(21, { status: 0 })
episode(22, { deleted_at: '2024-01-01' })
episode(23, { entertainment_id: 11 })
episode(24)
episode(25)
episode(26)
episode(27)
episode(28, { access: 'free', bunny_video_url: null, trailer_url: null, video_url_input: null })
for (const row of [
  { id: 1, user_id: 7, movie_id: 20, type: 'episode', view_expiry_date: '2999-01-01' },
  { id: 2, user_id: 7, movie_id: 24, type: 'episode', view_expiry_date: null },
  { id: 3, user_id: 7, movie_id: 25, type: 'episode', view_expiry_date: '2000-01-01' },
  { id: 4, user_id: 8, movie_id: 26, type: 'episode', view_expiry_date: '2999-01-01' },
  { id: 5, user_id: 7, movie_id: 27, type: 'movie', view_expiry_date: '2999-01-01' },
  { id: 6, user_id: 7, movie_id: 10, type: 'movie', view_expiry_date: '2999-01-01' },
]) insert('pay_per_views', row)

const d1 = {
  prepare(sql) {
    assert.match(sql.trim(), /^SELECT\b/i, 'API verification must never issue a write')
    return { bind(...params) {
      async function query(first) {
        try {
          const statement = db.prepare(sql)
          return first ? statement.get(...params) ?? null : { results: statement.all(...params) }
        } catch (error) {
          queryErrors.push(error.message)
          throw error
        }
      }
      return { all: () => query(false), first: () => query(true), run: () => { throw new Error('Unexpected API write') } }
    } }
  },
}
function compile(relativePath, imports) {
  const filename = resolve(root, relativePath)
  const { outputText, diagnostics = [] } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  })
  assert.equal(diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0, `${relativePath} must transpile`)
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (name) => name in imports ? imports[name] : require(name), console, URL }, { filename })
  return module.exports
}
const dbModule = compile('src/lib/db.ts', { 'cloudflare:workers': { env: { DB: d1 } } })
const recommendations = compile('src/lib/recommendations.ts', {'./contentRoutes':compile('src/lib/contentRoutes.ts',{})})
const api = compile('src/lib/api.ts', {
  '@tanstack/react-start': { createServerFn: () => {
    let validate = (data) => data
    const builder = { validator: (fn) => { validate = fn; return builder }, handler: (fn) => (input = {}) => fn({ data: validate(input.data) }) }
    return builder
  } },
  './db': dbModule,
  './recommendations': recommendations,
  './viewer.server': { getActiveViewer: async () => session ? { userId: session.uid, profileId: null } : null },
  './session.server': { getSession: async () => session },
})
const ids = (rows) => Array.from(rows, (row) => Number(row.id)).sort((a, b) => a - b)

try {
  const genre = await api.getGenreContent({ data: 1 })
  assert.equal(genre.genre.name, 'Drama')
  assert.deepEqual(ids(genre.items), [1, 6], 'Genre query must return active matching title IDs, excluding deleted/inactive/unrelated rows')
  assert.equal(genre.items.find((item) => item.id === 1).name, 'Title 1', 'Joined mapping id must not replace entertainment id')
  assert.equal((await api.getGenreContent({ data: 999 })).items.length, 0)

  const movies = await api.getMovies()
  assert.deepEqual(Array.from(movies.find(item => item.id === 1).categories, item => item.id), [1], 'Catalogue filter categories exclude inactive/deleted genres')
  assert.equal(movies.find(item => item.id === 5).categories.length, 0, 'Unmapped titles have no fabricated category')

  const dashboard = await api.getDashboard()
  for (const rail of ['top10', 'popularMovies', 'popularTvShows', 'latest', 'free', 'comingSoon', 'payPerView']) {
    assert.ok(dashboard[rail].length > 0, `${rail} fixture must exercise its real query`)
    for (const item of dashboard[rail]) {
      const expected = ({ 1: 'Drama', 2: 'Comedy', 5: null, 6: 'Drama', 10: 'Comedy', 11: null })[item.id]
      assert.equal(item.genre_names, expected, `${rail} must return actual active mapped genres for ${item.id}`)
      assert.ok(![3, 4].includes(item.id), `${rail} must exclude inactive/deleted titles`)
    }
  }
  assert.equal(dashboard.bunnyLibraryId, 'library-fixture')
  const videos = await api.getVideos()
  assert.deepEqual(ids(videos), [100], 'Video catalogue excludes inactive and deleted rows')
  assert.equal(videos[0].name, 'Video fixture')
  assert.deepEqual(Object.keys(videos[0]).sort(), ['id', 'name', 'slug', 'description', 'poster_url', 'thumbnail_url', 'release_date', 'IMDb_rating', 'duration'].sort(), 'Video catalogue retains its existing public response fields')
  assert.deepEqual(ids(dashboard.mostWatched), [100], 'Dashboard video query must return real active rows')
  for (const [label, rows] of [['dashboard', dashboard.mostWatched], ['recommendations', dashboard.recommendations.forYou]]) {
    const video = rows.find(item => item.id === 100)
    assert.ok(video, `${label} must retain the video fixture`)
    assert.equal(video.trailer_url, 'https://example.test/video-trailer.mp4', `${label} must retain the trailer source`)
    assert.equal(video.video_url_input, 'https://example.test/video-full.mp4', `${label} must retain the full video source`)
    assert.equal(video.bunny_trailer_url, null, `${label} must preserve the absent Bunny field without querying a nonexistent videos column`)
  }

  const anonymous = await api.getTvShow({ data: 10 })
  assert.deepEqual(ids(anonymous.episodes), [20, 24, 25, 26, 27, 28], 'Only active, undeleted episodes for this show are returned')
  assert.deepEqual(Array.from(anonymous.seasons, (item) => item.season_index), ['1', '2', '10'], 'Season ordering must be numeric')
  const projected = anonymous.episodes.find((item) => item.id === 20)
  for (const [key, expected] of Object.entries({ bunny_video_url: 'episode-20', trailer_url: 'https://example.test/trailer-20.mp4', video_url_input: 'https://example.test/full-20.mp4', thumbnail_url: 'https://example.test/episode-20.jpg', episode_number: '20', description: 'Full description 20', short_desc: 'Short description 20', access: 'paid', price: 3.5 })) {
    assert.equal(projected[key], expected, `Episode projection must retain ${key}`)
  }
  assert.ok(anonymous.episodes.every((item) => !item.myPurchase), 'Anonymous visitors must not inherit purchases')
  assert.equal(anonymous.episodes.find((item) => item.id === 28).bunny_video_url, null, 'Missing source remains missing')

  session = { uid: 7 }
  const signedIn = await api.getTvShow({ data: 10 })
  assert.ok(signedIn.myPurchase, 'Parent title purchase fixture is loaded independently')
  assert.deepEqual(ids(signedIn.episodes.filter((item) => item.myPurchase)), [20, 24], 'Episode ownership requires matching user, episode type, and valid expiry; parent ownership grants no episode ownership')
  session = { uid: 8 }
  const otherViewer = await api.getTvShow({ data: 10 })
  assert.deepEqual(ids(otherViewer.episodes.filter((item) => item.myPurchase)), [26], 'Another viewer sees only their own entitlement')
  assert.equal(otherViewer.myPurchase, null, 'Parent purchase is viewer-specific too')
  assert.deepEqual(queryErrors, [], 'No SQL error may be swallowed into an empty fallback')
  console.log('TV_DATA_API_OK: actual genre join, seven hero projections, video catalogue/dashboard/recommendation sources, episode sources/access, and user/type/expiry isolation')
} finally {
  db.close()
}
