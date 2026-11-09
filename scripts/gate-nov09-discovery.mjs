// Real server handlers and production SQL, isolated from accounts and remote databases.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const clean = value => JSON.parse(JSON.stringify(value))
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
function load(path, imports = {}) {
  const { outputText, diagnostics } = ts.transpileModule(read(path), { fileName: path, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal(diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, URL, require: name => { assert.ok(name in imports, `Unexpected import ${name} in ${path}`); return imports[name] } })
  return module.exports
}
const db = new DatabaseSync(':memory:')
const common = 'id INTEGER PRIMARY KEY, name TEXT, slug TEXT, description TEXT, poster_url TEXT, thumbnail_url TEXT, release_date TEXT, IMDb_rating TEXT, duration TEXT, content_rating TEXT, trailer_url TEXT, bunny_video_url TEXT, video_url_input TEXT, video_upload_type TEXT, created_at TEXT, updated_at TEXT, status INTEGER DEFAULT 1, deleted_at TEXT, is_restricted INTEGER DEFAULT 0'
db.exec(`CREATE TABLE entertainments (${common}, type TEXT, language TEXT, movie_access TEXT, bunny_trailer_url TEXT, total_views INTEGER);
 CREATE TABLE videos (${common}, access TEXT);
 CREATE TABLE user_multi_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, is_child_profile INTEGER, deleted_at TEXT);
 CREATE TABLE genres (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, file_url TEXT, status INTEGER DEFAULT 1, deleted_at TEXT);
 CREATE TABLE entertainment_gener_mapping (id INTEGER PRIMARY KEY, entertainment_id INTEGER, genre_id INTEGER, deleted_at TEXT);
 CREATE TABLE video_gener_mappings (id INTEGER PRIMARY KEY, video_id INTEGER, genre_id INTEGER, deleted_at TEXT);
 CREATE TABLE continue_watch (id INTEGER PRIMARY KEY, user_id INTEGER, profile_id INTEGER, entertainment_id INTEGER, entertainment_type TEXT, watched_time TEXT, total_watched_time TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
 CREATE TABLE watchlists (id INTEGER PRIMARY KEY, user_id INTEGER, profile_id INTEGER, entertainment_id INTEGER, type TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
 CREATE TABLE seasons (id INTEGER PRIMARY KEY, entertainment_id INTEGER, status INTEGER DEFAULT 1, deleted_at TEXT);
 CREATE TABLE episodes (id INTEGER PRIMARY KEY, season_id INTEGER, entertainment_id INTEGER, status INTEGER DEFAULT 1, deleted_at TEXT, is_restricted INTEGER DEFAULT 0);
 CREATE TABLE settings (name TEXT, val TEXT);
 CREATE TABLE live_tv_channel (id INTEGER PRIMARY KEY, name TEXT, poster_url TEXT, status INTEGER DEFAULT 1, deleted_at TEXT);`)
function insert(table, row) {
  const cols = Object.keys(row)
  db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(row))
}
const now = new Date().toISOString()
for (const [id, type, genre, name, extra] of [
  [1, 'movie', 1, 'Faith alpha', {}], [2, 'movie', 2, 'Prayer alpha', { total_views: 10000 }],
  [3, 'movie', 1, 'Watched faith', {}], [4, 'movie', 2, 'Watched prayer', {}],
  [5, 'movie', 3, 'Restricted sermon', { is_restricted: 1 }], [6, 'movie', 1, 'Hidden sermon', { status: 0 }],
  [7, 'movie', 1, 'Paid sermon', { movie_access: 'paid', video_url_input: 'secret-paid' }],
  [8, 'movie', 1, 'Subscriber sermon', { movie_access: 'subscription', video_url_input: 'secret-subscription' }],
  [10, 'teaching', 1, 'Faith teaching', {}], [11, 'teaching', 2, 'Prayer teaching', { total_views: 10000 }],
  [12, 'teaching', 3, 'Restricted teaching', { is_restricted: 1 }],
  [20, 'tvshow', 1, 'Faith show', {}], [21, 'tvshow', 3, 'Restricted show', { is_restricted: 1 }],
  [22, 'movie', 1, 'Deleted title', { deleted_at: now }],
]) {
  insert('entertainments', { id, type, name, movie_access: 'free', poster_url: 'poster-' + id, video_url_input: 'free-' + id, total_views: 10, created_at: now, updated_at: now, release_date: '2025-01-01', ...extra })
  insert('entertainment_gener_mapping', { id, entertainment_id: id, genre_id: genre })
}
for (const [id, extra] of [[1, {}], [2, { is_restricted: 1 }], [3, { access: 'paid', video_url_input: 'secret-video' }], [4, { access: 'subscription', video_url_input: 'secret-video-subscription' }]]) {
  insert('videos', { id, name: 'Video ' + id, access: 'free', video_url_input: 'video-' + id, created_at: now, updated_at: now, release_date: '2024-01-01', ...extra })
  insert('video_gener_mappings', { id, video_id: id, genre_id: id === 2 ? 3 : 2 })
}
for (const [id, name] of [[1, 'Faith'], [2, 'Prayer'], [3, 'Adult only'], [4, 'Hidden genre']]) insert('genres', { id, name, status: id === 4 ? 0 : 1 })
insert('video_gener_mappings', { id: 10, video_id: 1, genre_id: 1, deleted_at: now })
insert('video_gener_mappings', { id: 11, video_id: 1, genre_id: 4 })
for (const [id, user_id, is_child_profile] of [[100, 9, 0], [101, 9, 0], [102, 9, 1], [103, 10, 0]]) insert('user_multi_profiles', { id, user_id, is_child_profile })
let progressId = 0
function watch(user_id, profile_id, entertainment_id, entertainment_type = 'movie', extra = {}) {
  insert('continue_watch', { id: ++progressId, user_id, profile_id, entertainment_id, entertainment_type, watched_time: '900', total_watched_time: '1000', created_at: now, updated_at: now, ...extra })
}
watch(9, 100, 3); watch(9, 101, 4); watch(10, 100, 4) // same profile ID under a different user must never count
watch(9, 102, 3); watch(9, 102, 5); watch(9, 100, 6); watch(9, 100, 22)
watch(9, 100, 4, 'movie', { deleted_at: now }); watch(9, 100, 2, 'movie', { watched_time: '5' })
watch(10, 103, 1, 'video'); watch(10, 103, 1, 'video') // duplicate progress must not inflate public video popularity
watch(11, 104, 1, 'video', { watched_time: '5' })
insert('watchlists', { id: 1, user_id: 9, profile_id: 101, entertainment_id: 4, type: 'movie', created_at: now })
insert('watchlists', { id: 2, user_id: 9, profile_id: 102, entertainment_id: 5, type: 'movie', created_at: now })
const queries = []
const data = { all: async (sql, ...params) => { queries.push({ sql, params }); return db.prepare(sql).all(...params) }, first: async (sql, ...params) => { queries.push({ sql, params }); return db.prepare(sql).get(...params) ?? null }, run: () => { throw Error('Unexpected write') } }
const routes = load('src/lib/contentRoutes.ts')
const engine = load('src/lib/recommendations.ts', { './contentRoutes': routes })
const service = load('src/lib/recommendations.server.ts', { './db': data })
const filters = load('src/lib/catalogueFilters.ts')
let viewer = { userId: 9, profileId: 100, profileName: 'Test' }
const viewerApi = { getActiveViewer: async () => viewer }
const createServerFn = () => { let validate = x => x; const b = { validator(fn) { validate = fn; return b }, handler(fn) { return (input = {}) => fn({ data: validate(input.data) }) } }; return b }
const heroes = { loadConfiguredHeroes: async (placement, child) => { heroCalls.push({ placement, child }); return [] } }
const heroCalls = []
const catalogue = load('src/lib/catalogue.ts', { '@tanstack/react-start': { createServerFn }, './db': data, './viewer.server': viewerApi, './catalogueFilters': filters, './recommendations': engine, './recommendations.server': service, './heroes.server': heroes })
const ids = items => Array.from(items, item => item.id)
const key = item => `${item.type}:${item.id}`
const noLeaks = payload => {
  const json = JSON.stringify(payload)
  for (const secret of ['secret-paid', 'secret-subscription', 'secret-video', 'userId', 'profileId', 'watched_time', 'genreWeights']) assert.equal(json.includes(secret), false, secret)
}
let checks = 0
async function check(name, action) { await action(); checks++; console.log('PASS ' + name) }
await check('Signals require both active user and active profile, and skip deleted/unpublished titles', async () => {
  const result = await service.loadRecommendationSignals(viewer, false)
  assert.deepEqual(ids(result.history.map(x => ({ id: x.entertainment_id }))).sort((a,b) => a-b), [2,3])
  assert.equal(result.saved.length, 0)
  const before = queries.length
  assert.deepEqual(clean(await service.loadRecommendationSignals(null, false)), { history: [], saved: [] })
  assert.deepEqual(clean(await service.loadRecommendationSignals({ userId: 9, profileId: null }, false)), { history: [], saved: [] })
  assert.equal(queries.length, before, 'No unscoped anonymous history query')
})
await check('Switching real profile history changes sermon AND teaching suggestions and default ordering', async () => {
  for (const kind of ['sermons', 'teachings']) {
    viewer = { userId: 9, profileId: 100 }
    const faith = await catalogue.getCatalogue({ data: kind })
    viewer = { userId: 9, profileId: 101 }
    const prayer = await catalogue.getCatalogue({ data: kind })
    assert.equal(faith.personalized, true); assert.equal(prayer.personalized, true)
    assert.equal(faith.suggestions[0].name.startsWith('Faith'), true)
    assert.equal(prayer.suggestions[0].name.startsWith('Prayer'), true)
    assert.equal(faith.items[0].genre_names, 'Faith')
    assert.equal(prayer.items[0].genre_names, 'Prayer')
    assert.equal(faith.suggestions.some(item => item.id === 3), false, 'Watched titles stay out of suggestions')
    assert.ok(faith.items.some(item => item.id === (kind === 'sermons' ? 3 : 10)), 'Browse retains every title')
    noLeaks(faith); noLeaks(prayer)
    assert.ok(faith.items.every(item => !('total_views' in item) && !('created_at' in item)))
  }
})
await check('Anonymous or unselected profiles get deterministic useful fallback without personalization claims', async () => {
  viewer = null
  const guest = await catalogue.getCatalogue({ data: 'sermons' })
  const repeat = await catalogue.getCatalogue({ data: 'sermons' })
  assert.equal(guest.personalized, false); assert.ok(guest.suggestions.length)
  assert.deepEqual(ids(guest.suggestions), ids(repeat.suggestions))
  viewer = { userId: 9, profileId: null }
  assert.deepEqual(ids((await catalogue.getCatalogue({ data: 'sermons' })).suggestions), ids(guest.suggestions))
})
await check('Child profile restrictions cover candidates, preference signals, facets, suggestions and hero placement', async () => {
  viewer = { userId: 9, profileId: 102 }
  assert.equal(await service.isChildViewer(viewer), true)
  assert.equal(await service.isChildViewer({ userId: 9, profileId: 999 }), true, 'Deleted selection fails closed')
  const signals = await service.loadRecommendationSignals(viewer, true)
  assert.equal(signals.history.some(item => item.entertainment_id === 5), false)
  assert.equal(signals.saved.length, 0)
  const candidates = await service.loadRecommendationCandidates(true)
  for (const restricted of ['movie:5', 'teaching:12', 'tvshow:21', 'video:2']) assert.equal(candidates.some(item => key(item) === restricted), false)
  for (const kind of ['sermons','teachings','shows','videos']) {
    const result = await catalogue.getCatalogue({ data: kind })
    assert.equal(JSON.stringify(result).includes('Restricted'), false)
    assert.equal(JSON.stringify(result.categories).includes('Adult only'), false)
    assert.equal(heroCalls.at(-1).child, true)
    assert.equal(heroCalls.at(-1).placement, { sermons:'movie', teachings:'teaching', shows:'tv_show', videos:'video' }[kind])
    noLeaks(result)
  }
})
await check('Video signal tags use video IDs, meaningful aggregate views deduplicate profiles, paid sources stay private', async () => {
  const signals = await service.loadRecommendationSignals({ userId: 10, profileId: 103 }, false)
  assert.ok(signals.history.every(item => item.entertainment_type === 'video' && item.genre_names === 'Prayer'))
  const candidates = await service.loadRecommendationCandidates(false)
  const video = candidates.find(item => key(item) === 'video:1')
  assert.equal(video.total_views, 1)
  assert.equal(video.genre_names, 'Prayer')
  noLeaks(candidates)
  assert.equal(candidates.find(item => key(item) === 'movie:1').video_url_input, 'free-1')
})
await check('Mixed popularity includes every available format, respects within-format popularity and has no duplicate typed IDs', async () => {
  const popular = engine.buildMixedPopular(await service.loadRecommendationCandidates(false))
  assert.deepEqual(Array.from(popular.slice(0,4), item => item.type), ['movie','teaching','tvshow','video'])
  assert.equal(popular[0].id, 2); assert.equal(popular[1].id, 11); assert.equal(popular[3].id, 1)
  assert.equal(new Set(popular.map(key)).size, popular.length)
  noLeaks(popular)
})
await check('The actual homepage handler supplies mixed popularity and visible collection counts with child-safe heroes', async () => {
  const imports = { '@tanstack/react-start': { createServerFn }, './db': data, './heroes.server': heroes, './api-security': {}, './session.server': { getSession: async () => viewer ? { uid: viewer.userId } : null }, './recommendations': engine, './recommendations.server': service, './viewer.server': viewerApi, './entitlement.server': {}, './entitlement-core': {}, './subscriptionPolicy': {}, './people.server': { loadPersonalities: async () => [] }, './content-html': { sanitizeContentHtml: x => x } }
  // Unrelated integrations are not executed by this handler, but remain explicit mocks.
  for (const spec of read('src/lib/api.ts').matchAll(/^import .* from '([^']+)'/gm)) if (!(spec[1] in imports)) imports[spec[1]] = {}
  const api = load('src/lib/api.ts', imports)
  viewer = { userId: 9, profileId: 102 }
  const dash = await api.getDashboard()
  assert.equal(new Set(dash.popular.map(item => item.type)).size, 4)
  assert.deepEqual(Array.from(dash.collections, item => item.type), ['movie','teaching','tvshow','video'])
  assert.equal(dash.collections.find(item => item.type === 'teaching').count, 2)
  for (const field of ['popular','top10','popularMovies','popularTvShows','latest','free','payPerView','mostWatched','recommendations']) assert.equal(JSON.stringify(dash[field]).includes('Restricted'), false, field)
  assert.deepEqual(heroCalls.at(-1), { placement:'home', child:true })
  noLeaks(dash)
})
await check('Catalogue search and filters are functional with categories before search and honest personalized copy', async () => {
  const react = { useId: () => 'search-test', useState: value => [value, () => {}], useEffect: () => {}, useMemo: fn => fn() }
  const FilterBar = () => null, PosterCard = () => null, Rail = () => null
  const { Catalogue } = load('src/components/Catalogue.tsx', { react, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': {}, '../lib/catalogueFilters': filters, './Poster': { PosterCard, Rail }, './ui/choice-picker': {}, './ui/catalogue-filter-bar': { CatalogueFilterBar: FilterBar } })
  let search
  const input = { title:'Sermons', singular:'sermon', base:'/movie', data:{ items:[{ id:1,name:'Faith',categories:[{id:1,name:'Faith'}],release_date:'2025-01-01' },{id:2,name:'Other'}], categories:[{id:1,name:'Faith'}], years:[2025], suggestions:[] }, search:{ q:'Faith',category:1 }, onSearchChange: next => { search = next } }
  const tree = Catalogue(input)
  const section = tree.props.children.find(child => child?.type === 'section')
  const children = section.props.children
  assert.ok(children.findIndex(child => child?.type === FilterBar) < children.findIndex(child => child?.type === 'form'))
  const form = children.find(child => child?.type === 'form')
  let prevented = false
  form.props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, true); assert.equal(search.q, 'Faith'); assert.equal(search.category, 1)
  const bar = children.find(child => child?.type === FilterBar)
  bar.props.onCategoryChange('2'); assert.equal(search.category, 2)
  const field = form.props.children.props.children
  field.find(child => child?.props?.['aria-label'] === 'Clear search').props.onClick()
  assert.equal(search.q, undefined); assert.equal(search.category, 1)
  const grid = children.find(child => child?.props?.className === 'grid catalogue-grid')
  assert.equal(grid.props.children.length, 1)
  assert.equal(grid.props.children[0].props.item.name, 'Faith')
  const shop = read('src/routes/shop.index.tsx')
  assert.ok(shop.indexOf('<CatalogueFilterBar') < shop.indexOf('role="search"'))
  const css = read('src/catalogue-filter-bar.css')
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.beam-search::before \{ animation:none;/)
  assert.ok(read('src/components/Poster.tsx').includes("paused ? 'Resume Slide' : 'Pause Slide'"))
  assert.equal(read('src/routes/index.tsx').includes('New Released Sermons'), false)
})
db.close()
console.log(`NOV09_DISCOVERY_OK (${checks} integration groups)`)
