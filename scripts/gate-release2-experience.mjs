import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(path, imports = {}, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, require: key => imports[key], setTimeout, clearTimeout, ...globals })
  return module.exports
}
const routes = load('src/lib/contentRoutes.ts')
const ending = load('src/components/playbackEnding.ts', { '../lib/contentRoutes': routes })
assert.equal(ending.nearPlaybackEnd(98, 100, false), false, 'A duration/seek alone cannot show completion')
assert.equal(ending.nearPlaybackEnd(91, 100, true), false)
assert.equal(ending.nearPlaybackEnd(92, 100, true), true)
assert.equal(ending.nearPlaybackEnd(3590, 3600, true), true)
assert.equal(ending.nearPlaybackEnd(3560, 3600, true), false)
assert.equal(ending.nearPlaybackEnd(15, 15, true), false, 'Short clips wait for the actual end')
assert.equal(ending.nearPlaybackEnd(Infinity, Infinity, true), false)
const items = ending.endRecommendations([
  { id: 1, type: 'movie', name: 'Current' },
  { id: 1, type: 'video', name: 'Same numeric ID, another table', access: 'paid' },
  { id: 2, type: 'teaching', name: 'Real Teaching', hasSubscriptionAccess: false },
  { id: 2, type: 'teaching', name: 'Duplicate' },
  { id: 3, type: 'episode', name: 'No standalone episode route' },
  { id: -1, name: 'Invalid' },
  { id: 4, type: 'tvshow', name: 'Real Show' },
], { contentType: 'movie', contentId: 1 })
assert.equal(items.length, 3)
assert.equal(items[0].paid, true)
assert.match(items[0].href, /^\/video\//)
assert.equal(items[1].subscription, true)
assert.match(items[2].href, /^\/tv-show\//)
const episodes = [{ id: 1, season_id: 20, episode_number: 2 }, { id: 8, season_id: 10, episode_number: 2 }, { id: 10, season_id: 10, episode_number: 1 }, { id: 2, season_id: 20, episode_number: 1 }]
assert.deepEqual(Array.from(ending.orderedEpisodes(episodes, [{ id: 10 }, { id: 20 }]), item => item.id), [10, 8, 2, 1], 'Next episode order crosses seasons by episode number, never insertion ID')
assert.equal(episodes[0].id, 1, 'The supplied catalogue stays unchanged')
let id = 0, now = 0
const jobs = new Map()
const clock = { set(fn, delay = 1000) { const key = ++id; jobs.set(key, { fn, at: now + delay }); return key }, clear(key) { jobs.delete(key) } }
function advance(ms) { now += ms; for (const [key, job] of [...jobs]) if (job.at <= now) { jobs.delete(key); job.fn() } }
let ticks = [], played = 0
const timer = ending.createNextCountdown(seconds => ticks.push(seconds), () => played++, clock)
assert.equal(jobs.size, 0, 'Countdown starts only after caller confirms actual end and foreground visibility')
timer.setVisible(true)
advance(999); assert.equal(ticks.at(-1), 8)
advance(1); assert.equal(ticks.at(-1), 7)
timer.setVisible(false); advance(10000); assert.equal(ticks.at(-1), 7, 'Background tabs pause countdown')
timer.setVisible(true)
for (let i = 0; i < 7; i++) advance(1000)
assert.equal(played, 1)
timer.setVisible(true); advance(10000); assert.equal(played, 1, 'Never double advance')
const cancelled = ending.createNextCountdown(() => {}, () => assert.fail('Cancelled autoplay fired'), clock)
cancelled.setVisible(true); advance(1000); cancelled.cancel(); advance(10000); assert.equal(jobs.size, 0)
const preview = load('src/components/previewPlayback.ts', { './directPlayback': {} })
let starts = 0
const stop = preview.deferHeroPreview(() => starts++, clock)
advance(1199); assert.equal(starts, 0)
advance(1); assert.equal(starts, 1, 'Hero starts at exactly 1200 ms')
stop()
const stopEarly = preview.deferHeroPreview(() => starts++, clock)
advance(1000); stopEarly(); advance(200); assert.equal(starts, 1, 'Hidden, replaced or unmounted heroes cancel delayed playback')
assert.equal(jobs.size, 0)
console.log('RELEASE2_EXPERIENCE_OK: real recommendations, typed IDs, chronological episode order, actual-end boundary, foreground countdown/cancel/single advance, exact 1200ms preview and cleanup')
