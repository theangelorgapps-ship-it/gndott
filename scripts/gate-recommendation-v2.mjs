#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const code = ts.transpileModule(readFileSync(resolve(root, 'src/lib/recommendations.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true },
}).outputText
const routeCode = ts.transpileModule(readFileSync(resolve(root,'src/lib/contentRoutes.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const linkedCode = code.replace("'./contentRoutes'", JSON.stringify('data:text/javascript;base64,'+Buffer.from(routeCode).toString('base64')))
const engine = await import(`data:text/javascript;base64,${Buffer.from(linkedCode).toString('base64')}`)
const { parseWatchSeconds, isMeaningfulWatch, buildWatchProfile, buildRecommendationPayload, scoreCandidate, rankRecommendationCandidates, sortByRecency } = engine
const NOW = Date.parse('2026-11-07T12:00:00Z')
const key = (item) => `${item.type}:${item.id}`
const contents = (payload) => [...payload.forYou, ...(payload.discoveries || (payload.discovery ? [payload.discovery] : [])), ...payload.recent]
const candidate = (id, type = 'movie', genres = ['Drama'], extra = {}) => ({
  id, type, name: `${type} ${id}`, slug: null, description: '', poster_url: null, thumbnail_url: null,
  release_date: '2025-01-01', IMDb_rating: null, duration: null, language: 'English', content_rating: null,
  genres, total_views: 100, created_at: '2025-01-01 00:00:00', updated_at: '2026-11-01 00:00:00', ...extra,
})
const history = (id, type = 'movie', genres = ['Drama'], extra = {}) => ({
  entertainment_id: id, entertainment_type: type, genres,
  watched_time: 900, total_watched_time: 1000, updated_at: '2026-11-06 00:00:00', ...extra,
})
const payload = (candidates, historyEntries = [], extra = {}) => buildRecommendationPayload({ candidates, history: historyEntries, now: NOW, seed: 'user:profile', ...extra })
let checks = 0
function check(name, run) { run(); checks++; console.log(`PASS ${name}`) }

check('Clock parsing accepts real legacy duration formats and rejects corruption', () => {
  for (const [value, expected] of [['01:02:03', 3723], ['125:30', 7530], ['9:30.5', 570.5], [' 120.5 ', 120.5], [30, 30]]) assert.equal(parseWatchSeconds(value), expected)
  for (const value of ['1:60:00', '10:99', '1::2', '1:-2:3', '-30', 'garbage', '', NaN, Infinity, -1, null]) assert.equal(parseWatchSeconds(value), 0)
})
check('Accidental/tiny playback never creates preferences or exclusion', () => {
  const tiny = [history(1, 'movie', ['Drama'], { watched_time: 29 }), history(2, 'video', ['Music'], { watched_time: '00:00:05' })]
  const profile = buildWatchProfile(tiny, { now: NOW })
  assert.equal(profile.hasHistory, false)
  assert.equal(profile.watchedKeys.size, 0)
  assert.deepEqual(profile.topGenres, [])
  assert.deepEqual(payload([candidate(1), candidate(2, 'video')], tiny).forYou.map(key).sort(), ['movie:1', 'video:2'])
  assert.equal(isMeaningfulWatch(history(3, 'movie', [], { watched_time: 30, total_watched_time: 1000 })), true)
  assert.equal(isMeaningfulWatch(history(3, 'movie', [], { watched_time: 30, total_watched_time: 7200 })), false)
})
check('Completion and actual duration change preference weight', () => {
  const partial = buildWatchProfile([history(1, 'movie', ['Drama'], { watched_time: 120, total_watched_time: 1200 })], { now: NOW })
  const complete = buildWatchProfile([history(1, 'movie', ['Drama'], { watched_time: 1200, total_watched_time: 1200 })], { now: NOW })
  assert.ok(complete.genreWeights.get('drama') > partial.genreWeights.get('drama') * 1.4)
  assert.equal(complete.completedKeys.has('movie:1'), true)
  assert.equal(partial.inProgressKeys.has('movie:1'), true)
  const sameSecondsShorter = buildWatchProfile([history(1, 'movie', ['Drama'], { watched_time: 120, total_watched_time: 120 })], { now: NOW })
  assert.ok(sameSecondsShorter.genreWeights.get('drama') > partial.genreWeights.get('drama'))
})
check('Timestamp decay is independent of input order and discounts stale views', () => {
  const rows = [history(1, 'movie', ['Old'], { updated_at: '2025-11-06 00:00:00' }), history(2, 'movie', ['Fresh'])]
  const profile = buildWatchProfile(rows, { now: NOW })
  const reversed = buildWatchProfile([...rows].reverse(), { now: NOW })
  assert.deepEqual(profile.topGenres, ['Fresh', 'Old'])
  assert.deepEqual(profile.topGenres, reversed.topGenres)
  assert.ok(profile.genreWeights.get('fresh') > profile.genreWeights.get('old') * 50)
})
check('A lone ancient event loses absolute confidence instead of normalizing back to full preference', () => {
  const fresh = buildWatchProfile([history(1)], { now: NOW })
  const old = buildWatchProfile([history(1, 'movie', ['Drama'], { updated_at: '2024-01-01' })], { now: NOW })
  assert.ok(fresh.confidence > old.confidence)
  assert.equal(old.hasHistory, false)
  assert.deepEqual(old.topGenres, [])
  assert.equal(old.completedKeys.has('movie:1'), true, 'Decayed preferences must not forget completed-title exclusion')
})
check('Saved-only profiles provide deliberate preferences without fabricated viewing', () => {
  const saved = [history(99, 'teaching', ['Faith'])]
  const profile = buildWatchProfile([], { saved, now: NOW })
  assert.equal(profile.hasHistory, true)
  assert.equal(profile.watchedKeys.size, 0)
  assert.equal(profile.savedKeys.has('teaching:99'), true)
  const ranked = rankRecommendationCandidates([candidate(1, 'movie', ['Comedy'], { total_views: 1e9 }), candidate(2, 'teaching', ['Faith'])], profile, { now: NOW })
  assert.equal(ranked[0].id, 2)
  assert.deepEqual(profile.topGenres, ['Faith'])
})
check('Repeated progress writes and duplicate saves cannot multiply votes', () => {
  const row = history(1)
  const once = buildWatchProfile([row], { saved: [history(2)], now: NOW })
  const repeated = buildWatchProfile(Array.from({ length: 40 }, () => ({ ...row })), { saved: [history(2), history(2)], now: NOW })
  assert.equal(once.genreWeights.get('drama'), repeated.genreWeights.get('drama'))
  const completedThenRestarted = buildWatchProfile([row, history(1, 'movie', ['Drama'], { watched_time: 300 })], { now: NOW })
  assert.equal(completedThenRestarted.completedKeys.has('movie:1'), true)
  assert.equal(completedThenRestarted.inProgressKeys.has('movie:1'), false)
})
check('Multiple genre tags split a fixed signal budget and deduplicate casing', () => {
  const one = buildWatchProfile([history(1, 'movie', ['Drama'])], { now: NOW })
  const many = buildWatchProfile([history(1, 'movie', ['Drama', 'Faith', 'DRAMA'])], { now: NOW })
  assert.equal(many.genreWeights.size, 2)
  assert.equal([...one.genreWeights.values()].reduce((a, b) => a + b), [...many.genreWeights.values()].reduce((a, b) => a + b))
})
check('Typed IDs prevent collisions across videos, sermons and current titles', () => {
  const rows = [history(1, 'video'), history(3, 'movie', ['Drama'], { watched_time: 300 })]
  const result = payload([candidate(1), candidate(1, 'video'), candidate(2), candidate(2, 'video'), candidate(3)], rows, { currentId: 2, currentType: 'video' })
  assert.deepEqual(contents(result).map(key).sort(), ['movie:1', 'movie:2'])
  assert.equal(result.hasHistory, true)
  assert.equal(contents(payload([candidate(1), candidate(1, 'video')], [], { currentId: 1 })).length, 2, 'An untyped current ID cannot exclude two unrelated titles')
})
check('Preference winners remain first while diversity improves the row', () => {
  const catalogue = [...Array.from({ length: 14 }, (_, index) => candidate(index + 1, 'movie', ['Drama'], { total_views: 300 - index })),
    ...Array.from({ length: 4 }, (_, index) => candidate(30 + index, 'teaching', ['Faith'], { total_views: 150 }))]
  const rows = [history(100, 'movie', ['Drama']), history(101, 'teaching', ['Faith'])]
  const profile = buildWatchProfile(rows, { now: NOW })
  const raw = rankRecommendationCandidates(catalogue, profile, { now: NOW })
  const result = payload(catalogue, rows)
  assert.equal(key(result.forYou[0]), key(raw[0]))
  assert.ok(result.forYou.slice(0, 4).some((item) => item.type === 'teaching'))
  assert.ok(result.forYou.slice(0, 4).some((item) => item.type === 'movie'))
  assert.equal(result.forYou.length, 8)
})
check('Discovery is genuine exploration and never removes the highest-ranked title', () => {
  const catalogue = [...Array.from({ length: 9 }, (_, index) => candidate(index + 1, 'movie', ['Drama'], { total_views: 1000 - index })), candidate(50, 'video', ['Travel'])]
  const rows = [history(100)]
  const result = payload(catalogue, rows)
  assert.equal(result.forYou[0].id, 1)
  assert.equal(result.discovery.id, 50, 'Unfamiliar well-supported genre should beat another near-identical title for discovery')
  assert.equal(contents(result).length, new Set(contents(result).map(key)).size)
})
check('A profile/day seed is reproducible and insensitive to catalogue ordering', () => {
  const catalogue = Array.from({ length: 20 }, (_, index) => candidate(index + 1, 'movie', ['Drama'], { total_views: 100 }))
  const first = payload(catalogue)
  assert.deepEqual(payload(catalogue), first)
  assert.deepEqual(payload([...catalogue].reverse()), first)
  const byProfile = new Set(Array.from({ length: 16 }, (_, index) => payload(catalogue, [], { seed: `profile${index}` }).discovery.id))
  const byDay = new Set(Array.from({ length: 16 }, (_, index) => payload(catalogue, [], { now: NOW + index * 86400000 }).discovery.id))
  assert.ok(byProfile.size > 1)
  assert.ok(byDay.size > 1)
})
check('Cold start balances popular and fresh without claiming personalization', () => {
  const result = payload([candidate(1, 'movie', ['Drama'], { total_views: 1e6, updated_at: '2020-01-01' }), candidate(2, 'teaching', ['Faith'], { total_views: 100, updated_at: '2026-11-07' })])
  assert.equal(result.hasHistory, false)
  assert.deepEqual(result.topGenres, [])
  assert.equal(result.forYou[0].id, 2, 'A fresh title with genuine activity can outrank a years-old hit')
  const current = payload([candidate(1, 'movie', ['Drama']), candidate(2, 'teaching', ['Faith'])], [], { currentGenres: ['Faith'] })
  assert.equal(current.forYou[0].id, 2)
  assert.equal(current.hasHistory, false)
})
check('Tiny and exhausted catalogues retain useful recommendations without duplication', () => {
  const one = payload([candidate(1)])
  assert.equal(one.forYou.length, 1)
  assert.equal(one.discovery, null)
  assert.deepEqual(one.recent, [])
  const exhausted = payload([candidate(1)], [history(1)])
  assert.deepEqual(contents(exhausted), [])
  const empty = payload([])
  assert.deepEqual(empty, { forYou: [], discovery: null, discoveries: [], recent: [], hasHistory: false, topGenres: [] })
  const many = payload(Array.from({ length: 30 }, (_, index) => candidate(index + 1)))
  assert.equal(many.forYou.length, 8)
  assert.equal(many.recent.length, 8)
  assert.equal(contents(many).length, 24)
})
check('Bad IDs, unsupported types, malformed dates and nonfinite numbers are safe', () => {
  const result = payload([candidate(NaN), candidate(Infinity), candidate(-1), candidate(1.5), candidate(2, 'unknown'), candidate(3), candidate(3)])
  assert.deepEqual(contents(result).map(key), ['movie:3'])
  const profile = buildWatchProfile([history(0), history(1, 'unknown'), history(2, 'movie', [], { watched_time: NaN }), history(3, 'video', [], { watched_time: 'garbage' })], { now: NOW })
  assert.equal(profile.hasHistory, false)
  for (const views of [NaN, Infinity, -100, 'bad']) {
    const score = scoreCandidate(candidate(9, 'movie', [], { total_views: views, updated_at: '2026-02-30', created_at: 'broken', release_date: null }), profile, { maxViews: NaN, now: NOW })
    assert.ok(Number.isFinite(score) && score >= 0 && score <= 1)
  }
  const today = scoreCandidate(candidate(10, 'movie', [], { updated_at: '2026-11-07T12:00:00Z' }), profile, { maxViews: 100, now: NOW })
  const future = scoreCandidate(candidate(10, 'movie', [], { updated_at: '2099-01-01' }), profile, { maxViews: 100, now: NOW })
  assert.equal(future, today, 'Clock skew cannot award freshness beyond today')
})
check('SQLite UTC, ISO dates and recency fallback produce real chronological ordering', () => {
  const rows = [candidate(1, 'movie', [], { updated_at: 'invalid', created_at: '2026-11-06 10:00:00' }),
    candidate(2, 'movie', [], { updated_at: '2026-11-06T11:00:00Z' }),
    candidate(3, 'movie', [], { updated_at: null, created_at: null, release_date: '2026-11-05' }),
    candidate(4, 'movie', [], { updated_at: '2026-02-30', created_at: 'bad', release_date: null })]
  assert.deepEqual(sortByRecency(rows, NOW).map((item) => item.id), [2, 1, 3, 4])
  const scoreA = buildWatchProfile([history(10, 'movie', ['Drama'], { updated_at: '2026-11-06 10:00:00' })], { now: NOW }).genreWeights.get('drama')
  const scoreB = buildWatchProfile([history(10, 'movie', ['Drama'], { updated_at: '2026-11-06T10:00:00Z' })], { now: NOW }).genreWeights.get('drama')
  assert.equal(scoreA, scoreB)
})
check('No ranking internals or identity seed leak into public catalogue payloads', () => {
  const result = payload(Array.from({ length: 20 }, (_, index) => candidate(index + 1)), [history(100)], { saved: [history(101)], seed: 'private-user-profile' })
  for (const item of contents(result)) {
    for (const field of ['genres', 'genre_names', 'total_views', 'updated_at', 'created_at', 'score', 'seed', 'genreWeights']) assert.equal(field in item, false)
  }
  assert.equal(JSON.stringify(result).includes('private-user-profile'), false)
})

check('Full discovery row contains eight distinct unwatched titles',()=>{const p=payload(Array.from({length:50},(_,i)=>candidate(i+1,i%2?'movie':'teaching',[(i%5).toString()])));assert.equal(p.discoveries.length,8);assert.equal(new Set(contents(p).map(key)).size,contents(p).length)})

console.log(`RECOMMENDATION_V2_OK (${checks} behavioral fixtures)`)
