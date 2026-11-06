#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
assert.ok(['--scoring', '--groups', '--api'].includes(mode) && process.argv.length === 3,
  'Usage: node scripts/gate-recommendations.mjs --scoring|--groups|--api')

async function loadPureEngine() {
  const sourcePath = resolve(root, 'src/lib/recommendations.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const result = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  })
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
  assert.deepEqual(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [],
    'Pure recommendation module must transpile without errors')
  assert.ok(!result.outputText.includes("from './api'"), 'Type-only Content import must not create a runtime cycle')
  const dataUrl = `data:text/javascript;base64,${Buffer.from(result.outputText).toString('base64')}`
  return import(dataUrl)
}

const NOW = Date.parse('2026-11-06T00:00:00Z')

function candidate(id, type = 'movie', genres = [], totalViews = 0, dates = {}) {
  return {
    id,
    name: `Fixture ${id}`,
    slug: `fixture-${id}`,
    description: `Description ${id}`,
    type,
    poster_url: null,
    thumbnail_url: null,
    release_date: 'release_date' in dates ? dates.release_date : '2025-01-01',
    IMDb_rating: null,
    duration: null,
    language: 'English',
    movie_access: 'free',
    content_rating: null,
    genres,
    total_views: totalViews,
    created_at: 'created_at' in dates ? dates.created_at : '2025-01-01 00:00:00',
    updated_at: dates.updated_at ?? null,
  }
}

function history(id, type = 'movie', genres = [], watchedTime = 3600, updatedAt = '2026-11-01 00:00:00') {
  return {
    entertainment_id: id,
    entertainment_type: type,
    watched_time: watchedTime,
    total_watched_time: 7200,
    created_at: '2026-10-01 00:00:00',
    updated_at: updatedAt,
    genres,
  }
}

function allGroups(payload) {
  return [...payload.forYou, ...(payload.discovery ? [payload.discovery] : []), ...payload.recent]
}

async function scoringGate() {
  const {
    buildRecommendationPayload,
    buildWatchProfile,
    rankRecommendationCandidates,
    scoreCandidate,
  } = await loadPureEngine()

  const fixtures = [
    candidate(1, 'movie', ['Action'], 100),
    candidate(2, 'movie', ['Action'], 100),
    candidate(3, 'movie', ['Drama'], 100),
    candidate(4, 'movie', ['Comedy'], 1_000_000, { updated_at: '2026-11-05 00:00:00' }),
    candidate(5, 'tvshow', ['Action', 'Adventure'], 200),
    candidate(6, 'teaching', ['Drama'], 50),
  ]
  const actionProfile = buildWatchProfile([history(100, 'movie', ['Action'])])
  const dramaProfile = buildWatchProfile([history(101, 'movie', ['Drama'])])
  const actionRanking = rankRecommendationCandidates(fixtures, actionProfile, { now: NOW })
  const dramaRanking = rankRecommendationCandidates(fixtures, dramaProfile, { now: NOW })
  assert.equal(actionRanking[0].id, 1, 'Action history must rank an Action movie first')
  assert.equal(dramaRanking[0].id, 3, 'Drama history must rank the Drama movie first')
  assert.notEqual(actionRanking[0].id, dramaRanking[0].id, 'Different histories must produce different winners')
  assert.deepEqual(actionProfile.topGenres, ['Action'])
  assert.equal(actionProfile.hasHistory, true)

  // Negative control: popular/current fallback is not disguised personalization.
  const emptyProfile = buildWatchProfile([])
  const popularRanking = rankRecommendationCandidates(fixtures, emptyProfile, { now: NOW })
  assert.equal(popularRanking[0].id, 4, 'No-history fallback must favor the popular/current fixture')
  assert.notEqual(actionProfile.topGenres, emptyProfile.topGenres)
  assert.equal(emptyProfile.hasHistory, false)
  assert.equal(buildWatchProfile([history(0)]).hasHistory, false, 'Invalid history IDs are not history')

  // Recency and duration are actual weights, not decorative fields.
  const weighted = buildWatchProfile([
    history(20, 'movie', ['Drama'], 7200, '2026-11-05 00:00:00'),
    history(21, 'movie', ['Action'], 30, '2026-10-01 00:00:00'),
  ])
  assert.deepEqual(weighted.topGenres.slice(0, 2), ['Drama', 'Action'])
  const shortWatch = buildWatchProfile([history(30, 'movie', ['Action'], 1)])
  const longWatch = buildWatchProfile([history(30, 'movie', ['Action'], 7200)])
  assert.ok(longWatch.genreWeights.get('action') > shortWatch.genreWeights.get('action'),
    'Longer watching must increase genre affinity')

  // Content affinity must beat popularity/recency tiebreakers.
  const oldMatch = candidate(40, 'movie', ['Action'], 0, { updated_at: '2020-01-01 00:00:00' })
  const popularMismatch = candidate(41, 'movie', ['Comedy'], 10_000_000, { updated_at: '2026-11-06 00:00:00' })
  assert.ok(scoreCandidate(oldMatch, actionProfile, { now: NOW, maxViews: 10_000_000 })
    > scoreCandidate(popularMismatch, actionProfile, { now: NOW, maxViews: 10_000_000 }))

  // Detail fallback uses current genres while remaining explicitly non-personalized.
  const detailFallback = rankRecommendationCandidates(fixtures, emptyProfile, { now: NOW, currentGenres: ['Drama'] })
  assert.equal(detailFallback[0].id, 3)

  const excluded = buildRecommendationPayload({
    candidates: fixtures,
    history: [history(1, 'movie', ['Action'])],
    currentId: 2,
    currentType: 'movie',
    random: () => 0,
    now: NOW,
  })
  assert.equal(excluded.hasHistory, true)
  assert.ok(allGroups(excluded).every((item) => item.id !== 1 && item.id !== 2),
    'Watched and current items must be excluded from every group')

  const anonymous = buildRecommendationPayload({ candidates: fixtures, history: [], random: () => 0, now: NOW })
  assert.equal(anonymous.hasHistory, false)
  assert.deepEqual(anonymous.topGenres, [])
  for (const item of allGroups(anonymous)) {
    assert.ok(!('score' in item) && !('recommendationScore' in item) && !('genreWeights' in item),
      'Scores and profile metadata must not leak into UI-facing content')
    assert.ok(!('genre_names' in item) && !('total_views' in item) && !('updated_at' in item),
      'Internal candidate metadata must not leak into recommendation content')
  }

  console.log('RECOMMENDATION_SCORING_OK')
}

async function groupsGate() {
  const {
    buildRecommendationPayload,
    getContentRoute,
    sortByRecency,
  } = await loadPureEngine()
  const fixtures = Array.from({ length: 14 }, (_, index) => candidate(
    index + 1,
    index % 4 === 1 ? 'tvshow' : index % 4 === 2 ? 'teaching' : 'movie',
    [index % 2 ? 'Drama' : 'Action'],
    (index + 1) * 100,
    { updated_at: `2026-10-${String(index + 1).padStart(2, '0')} 00:00:00` },
  ))

  const payload = buildRecommendationPayload({ candidates: fixtures, history: [], random: () => 0, now: NOW })
  assert.equal(payload.forYou.length, 8)
  assert.equal(payload.recent.length, 5)
  assert.ok(payload.discovery)
  assert.equal(payload.discovery.id, 1)
  assert.equal(payload.hasHistory, false)
  assert.ok(!payload.forYou.some((item) => item.id === payload.discovery.id), 'Discovery must be outside forYou')
  const keys = allGroups(payload).map((item) => `${item.type}:${item.id}`)
  assert.equal(new Set(keys).size, keys.length, 'Groups must not contain duplicates')

  const expectedRecent = sortByRecency(fixtures.filter((item) =>
    item.id !== payload.discovery.id && !payload.forYou.some((picked) => picked.id === item.id && picked.type === item.type),
  )).slice(0, 8).map((item) => item.id)
  assert.deepEqual(payload.recent.map((item) => item.id), expectedRecent, 'Recent must use newest-first COALESCE ordering')

  const lastDiscovery = buildRecommendationPayload({ candidates: fixtures, history: [], random: () => 0.999999, now: NOW })
  assert.equal(lastDiscovery.discovery.id, 14, 'Injected RNG must control a genuinely random discovery choice')
  assert.notEqual(lastDiscovery.discovery.id, payload.discovery.id)

  const one = buildRecommendationPayload({ candidates: [candidate(90)], history: [], random: () => 0, now: NOW })
  assert.equal(one.discovery.id, 90, 'A sole eligible candidate still yields exactly one discovery')
  assert.equal(one.forYou.length, 0)
  assert.equal(one.recent.length, 0)
  assert.ok(!one.forYou.some((item) => item.id === one.discovery.id))

  const empty = buildRecommendationPayload({ candidates: [], history: [], now: NOW })
  assert.deepEqual(empty, { forYou: [], discovery: null, recent: [], hasHistory: false, topGenres: [] })

  const many = buildRecommendationPayload({
    candidates: Array.from({ length: 25 }, (_, index) => candidate(index + 1)),
    history: [],
    random: () => 0,
    now: NOW,
  })
  assert.equal(many.forYou.length, 8)
  assert.equal(many.recent.length, 8)
  assert.equal(new Set(allGroups(many).map((item) => item.id)).size, 17)

  const coalesceFixtures = [
    candidate(101, 'movie', [], 0, { updated_at: '2026-01-01 00:00:00', created_at: '2026-05-01 00:00:00' }),
    candidate(102, 'movie', [], 0, { updated_at: null, created_at: '2026-04-01 00:00:00' }),
    candidate(103, 'movie', [], 0, { updated_at: null, created_at: null, release_date: '2026-03-01' }),
    candidate(104, 'movie', [], 0, { updated_at: '2026-06-01 00:00:00' }),
  ]
  assert.deepEqual(sortByRecency(coalesceFixtures).map((item) => item.id), [104, 102, 103, 101],
    'updated_at must win over created_at even when created_at is newer')

  const filtered = buildRecommendationPayload({
    candidates: [candidate(201), { ...candidate(201) }, candidate(202, 'unknown'), candidate(0)],
    history: [],
    random: () => 0,
    now: NOW,
  })
  assert.equal(allGroups(filtered).length, 1, 'Duplicate and unroutable candidates must be removed')

  assert.equal(getContentRoute({ id: 1, type: 'movie' }), '/movie/1')
  assert.equal(getContentRoute({ id: 2, type: 'tvshow' }), '/tv-show/2')
  assert.equal(getContentRoute({ id: 3, type: 'teaching' }), '/teaching/3')
  assert.equal(getContentRoute({ id: 4, type: 'video' }), '/video/4')
  assert.equal(getContentRoute({ id: 5, type: 'unknown' }), null)

  console.log('RECOMMENDATION_GROUPS_OK')
}

function exportedBlock(source, name) {
  const marker = `export const ${name} =`
  const start = source.indexOf(marker)
  if (start < 0) return null
  const next = source.slice(start + marker.length).search(/\nexport const\s+/)
  return next < 0 ? source.slice(start) : source.slice(start, start + marker.length + next + 1)
}

function apiGate() {
  const sourcePath = resolve(root, 'src/lib/api.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const compact = source.replace(/\s+/g, ' ')
  const baseline = execFileSync('git', ['show', 'HEAD:src/lib/api.ts'], { cwd: root, encoding: 'utf8' })
  const baselineExports = [...baseline.matchAll(/export const\s+(\w+)/g)].map((match) => match[1])
  const currentExports = [...source.matchAll(/export const\s+(\w+)/g)].map((match) => match[1])
  const intentionallyChanged = new Set(['getDashboard', 'getMovie', 'getTvShow', 'getVideo'])

  for (const name of baselineExports) {
    assert.ok(currentExports.includes(name), `Existing exported API ${name} must remain`)
    if (!intentionallyChanged.has(name)) {
      assert.equal(exportedBlock(source, name), exportedBlock(baseline, name),
        `Untouched API ${name} must remain byte-for-byte compatible`)
    }
  }
  assert.ok(currentExports.includes('getRecommendations'))

  const home = exportedBlock(source, 'getDashboard')
  const movie = exportedBlock(source, 'getMovie')
  const show = exportedBlock(source, 'getTvShow')
  const video = exportedBlock(source, 'getVideo')
  const standalone = exportedBlock(source, 'getRecommendations')
  for (const [name, block] of Object.entries({ home, movie, show, video })) {
    assert.ok(block.includes('loadRecommendations'), `${name} must load recommendations`)
    assert.ok(block.includes('recommendations'), `${name} must return recommendations`)
  }
  assert.ok(standalone.includes("createServerFn({ method: 'GET' })"))
  assert.ok(standalone.includes('getSession()'))

  assert.ok(movie.includes('movie, genres, cast, similar, reviewStats, reviews, clips, bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations'))
  assert.ok(show.includes('show, seasons, episodes, genres, cast, reviews, clips, similar, bunnyLibraryId, ads, inWatchlist, myReview, myPurchase, recommendations'))
  assert.ok(video.includes('video, similar, reviews, clips, bunnyLibraryId, ads, myReview, recommendations'))
  assert.ok(video.includes('SELECT * FROM videos WHERE id = ? AND deleted_at IS NULL'), 'Video player fields must remain intact')
  assert.ok(home.includes('top10, popularMovies, popularTvShows, latest, free, genres, channels, comingSoon, payPerView, languages, cast, mostWatched, recommendations, bunnyLibraryId'))
  assert.ok(home.includes('Promise.all([getSession(), getBunnyLibraryId()])'), 'Dashboard must retrieve the existing Bunny library ID')

  const contentColumnsMatch = source.match(/const CONTENT_COLS\s*=\s*'([^']+)'/)
  const detailColumnsMatch = source.match(/const DETAIL_COLS = `\$\{CONTENT_COLS\}, ([^`]+)`/)
  assert.ok(contentColumnsMatch && detailColumnsMatch, 'Content and detail column definitions must remain inspectable')
  const contentColumns = contentColumnsMatch[1].split(',').map((column) => column.trim())
  const detailColumns = [...contentColumns, ...detailColumnsMatch[1].split(',').map((column) => column.trim())]
  assert.equal(new Set(detailColumns).size, detailColumns.length, 'DETAIL_COLS must not select duplicate columns')
  for (const field of ['bunny_video_url', 'bunny_trailer_url', 'video_url_input', 'video_upload_type']) {
    assert.ok(contentColumns.includes(field), `${field} must be available to home hero records`)
    assert.equal(detailColumns.filter((column) => column === field).length, 1,
      `${field} must occur exactly once in DETAIL_COLS`)
  }

  assert.ok(compact.includes('FROM continue_watch c'))
  assert.ok(compact.includes('WHERE c.user_id = ? AND c.deleted_at IS NULL'))
  assert.ok(compact.includes('GROUP BY c.id ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC LIMIT 40'))
  assert.ok(compact.includes('LEFT JOIN entertainment_gener_mapping m ON m.entertainment_id = c.entertainment_id'))
  assert.ok(compact.includes('LEFT JOIN genres g ON g.id = m.genre_id AND g.status = 1 AND g.deleted_at IS NULL'))
  assert.ok(compact.includes('WHERE e.status = 1 AND e.deleted_at IS NULL GROUP BY e.id'))
  assert.ok(compact.includes('history: history ?? []'), 'History-query errors must fall back to empty history')
  assert.ok(!source.includes('user_watch_histories'), 'Unknown history schema must not be guessed')
  assert.ok(movie.includes('currentGenres: genres.map') && show.includes('currentGenres: genres.map'),
    'Detail genre fallback must use current-item genres')
  assert.ok(movie.includes('currentId: id') && show.includes('currentId: id') && video.includes('currentId: id'))

  console.log('RECOMMENDATION_API_OK')
}

if (mode === '--scoring') await scoringGate()
else if (mode === '--groups') await groupsGate()
else apiGate()
