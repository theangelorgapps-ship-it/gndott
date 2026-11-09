import { contentPath } from './contentRoutes'
import type { Content } from './api'

export interface RecommendationPayload {
  forYou: Content[]
  discovery: Content | null
  discoveries?: Content[]
  recent: Content[]
  /** True when meaningful viewing or an explicit saved title supplies preferences. */
  hasHistory: boolean
  topGenres: string[]
}

export interface RecommendationCandidate extends Content {
  genres?: string[] | string | null
  genre_names?: string | null
  total_views?: number | string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface SavedSignalEntry {
  entertainment_id: number
  entertainment_type?: string | null
  created_at?: string | null
  updated_at?: string | null
  genres?: string[] | string | null
  genre_names?: string | null
}

export interface WatchHistoryEntry extends SavedSignalEntry {
  /** Actual playback position, in seconds or a legacy HH:MM:SS/MM:SS string. */
  watched_time?: number | string | null
  /** Actual media duration, in seconds or a legacy clock string. */
  total_watched_time?: number | string | null
}

export interface WatchProfile {
  hasHistory: boolean
  genreWeights: ReadonlyMap<string, number>
  typeWeights: ReadonlyMap<string, number>
  topGenres: string[]
  watchedKeys: ReadonlySet<string>
  completedKeys: ReadonlySet<string>
  inProgressKeys: ReadonlySet<string>
  savedKeys: ReadonlySet<string>
  confidence: number
}

export interface ScoreOptions {
  currentGenres?: string[]
  maxViews?: number
  now?: number
}

export interface ProfileOptions {
  saved?: SavedSignalEntry[]
  now?: number
}

export interface RecommendationOptions extends ScoreOptions, ProfileOptions {
  candidates: RecommendationCandidate[]
  history: WatchHistoryEntry[]
  currentId?: number | null
  currentType?: string | null
  /** Opaque profile identity. Combined with the UTC day; never returned in content. */
  seed?: string | number
  /** Optional legacy test override; selects only within the discovery shortlist. */
  random?: () => number
}

const DAY_MS = 86_400_000
const VALID_TYPES = new Set(['movie', 'tvshow', 'teaching', 'video'])
const WATCH_HALF_LIFE_DAYS = 60
const SAVE_HALF_LIFE_DAYS = 180
const COMPLETION_THRESHOLD = .9

function finiteNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function validId(value: unknown): boolean {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0
}

function clockNow(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15 ? value : Date.now()
}

/** Reject malformed clocks, negative progress, NaN and Infinity instead of inventing engagement. */
export function parseWatchSeconds(value: unknown): number {
  if (typeof value === 'string' && value.includes(':')) {
    const parts = value.trim().split(':')
    if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return 0
    const numbers = parts.map(Number)
    if (numbers.slice(0, -1).some((number) => !Number.isInteger(number))) return 0
    if (numbers[numbers.length - 1] >= 60 || (numbers.length === 3 && numbers[1] >= 60)) return 0
    const seconds = numbers.reduce((total, number) => total * 60 + number, 0)
    return Number.isFinite(seconds) ? seconds : 0
  }
  return Math.max(0, finiteNumber(value))
}

function genreList(value: RecommendationCandidate['genres'] | RecommendationCandidate['genre_names']): string[] {
  const unique = new Map<string, string>()
  for (const raw of Array.isArray(value) ? value : String(value ?? '').split(',')) {
    const name = String(raw ?? '').trim()
    if (name && !unique.has(normalized(name))) unique.set(normalized(name), name)
  }
  return [...unique.values()]
}

function candidateGenres(candidate: RecommendationCandidate): string[] {
  return genreList(candidate.genres ?? candidate.genre_names)
}

function signalGenres(entry: SavedSignalEntry): string[] {
  return genreList(entry.genres ?? entry.genre_names)
}

function timestamp(value: unknown): number {
  if (value == null || value === '') return Number.NaN
  const text = String(value).trim()
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (dateParts) {
    const [, year, month, day] = dateParts.map(Number)
    const calendar = new Date(Date.UTC(year, month - 1, day))
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return Number.NaN
  }
  // SQLite datetime() is UTC, even when its serialized value has no timezone suffix.
  const utcText = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
    ? `${text.replace(' ', 'T')}Z` : text
  const parsed = Date.parse(utcText)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function firstTimestamp(values: unknown[]): number {
  for (const value of values) {
    const parsed = timestamp(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return Number.NaN
}

function contentTimestamp(content: Pick<RecommendationCandidate, 'updated_at' | 'created_at' | 'release_date'>): number {
  return firstTimestamp([content.updated_at, content.created_at, content.release_date])
}

function effectiveTimestamp(candidate: RecommendationCandidate, now: number): number {
  const value = contentTimestamp(candidate)
  return Number.isFinite(value) ? Math.min(value, now) : -Infinity
}

function decay(time: number, now: number, halfLifeDays: number, missingWeight: number): number {
  if (!Number.isFinite(time)) return missingWeight
  return Math.exp(-Math.LN2 * Math.max(0, now - time) / (DAY_MS * halfLifeDays))
}

function boundedPopularity(candidate: RecommendationCandidate, maxViews: number): number {
  if (!Number.isFinite(maxViews) || maxViews <= 0) return 0
  return Math.min(1, Math.log1p(Math.max(0, finiteNumber(candidate.total_views))) / Math.log1p(maxViews))
}

function boundedRecency(candidate: RecommendationCandidate, now: number): number {
  return decay(contentTimestamp(candidate), now, 90, 0)
}

function contentKey(content: Pick<Content, 'id' | 'type'> & Partial<Pick<Content,'name'|'slug'>>): string {
  return `${normalized(content.type)}:${Number(content.id)}`
}

function signalKey(entry: SavedSignalEntry): string | null {
  const type = normalized(entry.entertainment_type)
  return validId(entry.entertainment_id) && VALID_TYPES.has(type) ? `${type}:${Number(entry.entertainment_id)}` : null
}

function stableOrder(a: RecommendationCandidate, b: RecommendationCandidate): number {
  return normalized(a.type).localeCompare(normalized(b.type)) || Number(a.id) - Number(b.id)
}

function toContent(candidate: RecommendationCandidate): Content {
  const { genres: _genres, genre_names: _genreNames, total_views: _totalViews, created_at: _createdAt, updated_at: _updatedAt, ...content } = candidate
  return { ...content, id: Number(content.id), type: normalized(content.type) }
}

/** Progress must exceed 30 seconds and, for long media, a bounded 2% threshold. */
export function isMeaningfulWatch(entry: WatchHistoryEntry): boolean {
  const duration = parseWatchSeconds(entry.total_watched_time)
  const position = parseWatchSeconds(entry.watched_time)
  const watched = duration > 0 ? Math.min(position, duration) : position
  return watched >= Math.min(120, Math.max(30, duration * .02))
}

/** Order-independent, deduplicated preference signals with actual timestamp decay. */
export function buildWatchProfile(history: WatchHistoryEntry[], options: ProfileOptions = {}): WatchProfile {
  const now = clockNow(options.now)
  const genreWeights = new Map<string, number>()
  const typeWeights = new Map<string, number>()
  const genreNames = new Map<string, string>()
  const watchedKeys = new Set<string>()
  const completedKeys = new Set<string>()
  const inProgressKeys = new Set<string>()
  const savedKeys = new Set<string>()
  const preferredMetadata = (next: SavedSignalEntry, previous: SavedSignalEntry) => signalGenres(next).map(normalized).sort().join(',').localeCompare(signalGenres(previous).map(normalized).sort().join(',')) < 0
  const watchSignals = new Map<string, { entry: WatchHistoryEntry; weight: number }>()
  const saveSignals = new Map<string, { entry: SavedSignalEntry; weight: number }>()

  for (const entry of history) {
    const key = signalKey(entry)
    if (!key || !isMeaningfulWatch(entry)) continue
    const duration = parseWatchSeconds(entry.total_watched_time)
    const watched = duration > 0 ? Math.min(parseWatchSeconds(entry.watched_time), duration) : parseWatchSeconds(entry.watched_time)
    const completion = duration > 0 ? watched / duration : 0
    const durationWeight = Math.min(1, Math.log1p(watched) / Math.log1p(1800))
    const engagement = duration > 0 ? .2 + .5 * Math.sqrt(completion) + .3 * durationWeight : .35 + .35 * durationWeight
    const weight = engagement * decay(firstTimestamp([entry.updated_at, entry.created_at]), now, WATCH_HALF_LIFE_DAYS, .35)
    watchedKeys.add(key)
    if (duration > 0 && completion >= COMPLETION_THRESHOLD) completedKeys.add(key)
    else inProgressKeys.add(key)
    const previous = watchSignals.get(key)
    if (!previous || weight > previous.weight || (weight === previous.weight && preferredMetadata(entry, previous.entry))) watchSignals.set(key, { entry, weight })
  }
  for (const key of completedKeys) inProgressKeys.delete(key)
  for (const entry of options.saved ?? []) {
    const key = signalKey(entry)
    if (!key || completedKeys.has(key)) continue
    savedKeys.add(key)
    const weight = .45 * decay(firstTimestamp([entry.updated_at, entry.created_at]), now, SAVE_HALF_LIFE_DAYS, .5)
    const previous = saveSignals.get(key)
    if (!previous || weight > previous.weight || (weight === previous.weight && preferredMetadata(entry, previous.entry))) saveSignals.set(key, { entry, weight })
  }

  for (const { entry, weight } of [...watchSignals.values(), ...saveSignals.values()].sort((a, b) => signalKey(a.entry)!.localeCompare(signalKey(b.entry)!))) {
    if (weight <= 0) continue
    const genres = signalGenres(entry)
    for (const genre of genres) {
      const key = normalized(genre)
      const previousName = genreNames.get(key)
      genreNames.set(key, !previousName || genre.localeCompare(previousName) < 0 ? genre : previousName)
      // A title with six tags gets the same total voting weight as one with a single tag.
      genreWeights.set(key, (genreWeights.get(key) ?? 0) + weight / genres.length)
    }
    const type = normalized(entry.entertainment_type)
    typeWeights.set(type, (typeWeights.get(type) ?? 0) + weight)
  }
  const topGenres = [...genreWeights.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([key]) => genreNames.get(key)!)
  const strength = [...typeWeights.values()].reduce((sum, weight) => sum + weight, 0)
  const hasHistory = strength >= .05
  return { hasHistory, genreWeights, typeWeights, topGenres: hasHistory ? topGenres : [], watchedKeys, completedKeys, inProgressKeys, savedKeys, confidence: Math.min(1, strength / .65) }
}

/** Bounded preference, popularity and freshness features; no private scores leave the engine. */
export function scoreCandidate(candidate: RecommendationCandidate, profile: WatchProfile, options: ScoreOptions = {}): number {
  const genres = candidateGenres(candidate)
  const popularity = boundedPopularity(candidate, options.maxViews ?? 0)
  const recency = boundedRecency(candidate, clockNow(options.now))
  if (profile.hasHistory) {
    const genreTotal = [...profile.genreWeights.values()].reduce((sum, weight) => sum + weight, 0)
    const typeTotal = [...profile.typeWeights.values()].reduce((sum, weight) => sum + weight, 0)
    const matched = genres.reduce((sum, genre) => sum + (profile.genreWeights.get(normalized(genre)) ?? 0), 0)
    const genreAffinity = genreTotal > 0 ? Math.min(1, matched / genreTotal / Math.sqrt(Math.max(1, genres.length))) : 0
    const typeAffinity = typeTotal > 0 ? (profile.typeWeights.get(normalized(candidate.type)) ?? 0) / typeTotal : 0
    const preferenceScore = .62 * genreAffinity + .18 * typeAffinity + .10 * popularity + .10 * recency
    // Decay must reduce absolute confidence too; one ancient view is not a full-strength taste profile.
    const confidence = Math.max(0, Math.min(1, finiteNumber(profile.confidence)))
    return confidence * preferenceScore + (1 - confidence) * (.55 * popularity + .45 * recency)
  }
  const currentGenres = genreList(options.currentGenres ?? []).map(normalized)
  if (currentGenres.length) {
    const matches = genres.filter((genre) => currentGenres.includes(normalized(genre))).length
    return .70 * Math.min(1, matches / currentGenres.length) + .15 * popularity + .15 * recency
  }
  return .55 * popularity + .45 * recency
}

export function rankRecommendationCandidates(candidates: RecommendationCandidate[], profile: WatchProfile, options: ScoreOptions = {}): RecommendationCandidate[] {
  const now = clockNow(options.now)
  const maxViews = Number.isFinite(options.maxViews) ? Math.max(0, options.maxViews!) : candidates.reduce((max, candidate) => Math.max(max, finiteNumber(candidate.total_views)), 0)
  return candidates.map((candidate) => ({ candidate, score: scoreCandidate(candidate, profile, { ...options, maxViews, now }) }))
    .sort((a, b) => b.score - a.score || effectiveTimestamp(b.candidate, now) - effectiveTimestamp(a.candidate, now) || stableOrder(a.candidate, b.candidate))
    .map(({ candidate }) => candidate)
}

/** COALESCE(updated_at, created_at, release_date), with bad dates skipped and future dates capped. */
export function sortByRecency(candidates: RecommendationCandidate[], now = Date.now()): RecommendationCandidate[] {
  const reference = clockNow(now)
  return [...candidates].sort((a, b) => effectiveTimestamp(b, reference) - effectiveTimestamp(a, reference) || stableOrder(a, b))
}

function similarity(a: RecommendationCandidate, b: RecommendationCandidate): number {
  const first = new Set(candidateGenres(a).map(normalized))
  const second = new Set(candidateGenres(b).map(normalized))
  const union = new Set([...first, ...second]).size
  const overlap = [...first].filter((genre) => second.has(genre)).length
  return .75 * (union ? overlap / union : 0) + .25 * Number(normalized(a.type) === normalized(b.type))
}

function diversify(ranked: RecommendationCandidate[], profile: WatchProfile, options: ScoreOptions): RecommendationCandidate[] {
  const remaining = [...ranked]
  const selected: RecommendationCandidate[] = []
  while (remaining.length && selected.length < 8) {
    let winner = 0
    let best = -Infinity
    remaining.forEach((candidate, index) => {
      const comparisons = selected.map((item) => similarity(candidate, item))
      const nearest = comparisons.length ? Math.max(...comparisons) : 0
      const repetition = Math.min(.15, comparisons.filter((score) => score >= .74).length * .03)
      const score = scoreCandidate(candidate, profile, options) - .22 * nearest - repetition
      if (score > best) { best = score; winner = index }
    })
    selected.push(remaining.splice(winner, 1)[0])
  }
  return selected
}

function seededUnit(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  return (hash >>> 0) / 4294967296
}

export function buildRecommendationPayload(options: RecommendationOptions): RecommendationPayload {
  const now = clockNow(options.now)
  const profile = buildWatchProfile(options.history, { saved: options.saved, now })
  const unique = new Map<string, RecommendationCandidate>()
  for (const candidate of options.candidates) {
    if (!validId(candidate.id) || !VALID_TYPES.has(normalized(candidate.type))) continue
    const key = contentKey(candidate)
    // Meaningful unfinished titles belong in the separate Continue Watching row.
    if (profile.watchedKeys.has(key)) continue
    if (validId(options.currentId) && VALID_TYPES.has(normalized(options.currentType)) && Number(candidate.id) === Number(options.currentId)
      && normalized(candidate.type) === normalized(options.currentType)) continue
    const prior = unique.get(key)
    if (!prior || effectiveTimestamp(candidate, now) > effectiveTimestamp(prior, now)) unique.set(key, candidate)
  }
  const eligible = [...unique.values()]
  const scoreOptions: ScoreOptions = { currentGenres: options.currentGenres, now, maxViews: eligible.reduce((max, item) => Math.max(max, finiteNumber(item.total_views)), 0) }
  const ranked = rankRecommendationCandidates(eligible, profile, scoreOptions)
  // Choose the relevant row first. Exploration can never steal its strongest candidate.
  const forYou = diversify(ranked, profile, scoreOptions)
  const used = new Set(forYou.map(contentKey))
  const remaining = ranked.filter((candidate) => !used.has(contentKey(candidate)))
  const discoveryRanking = remaining.map((candidate) => {
    const nearest = forYou.length ? Math.max(...forYou.map((item) => similarity(candidate, item))) : 0
    const knownGenres = profile.hasHistory ? candidateGenres(candidate).filter((genre) => profile.genreWeights.has(normalized(genre))).length : 0
    const unseenGenre = candidateGenres(candidate).length > 0 && knownGenres === 0
    const novelty = .65 * (1 - nearest) + .35 * Number(unseenGenre)
    return { candidate, score: .50 * scoreCandidate(candidate, profile, scoreOptions) + .35 * novelty + .15 * boundedRecency(candidate, now) }
  }).sort((a, b) => b.score - a.score || stableOrder(a.candidate, b.candidate))
  const bestExploration = discoveryRanking[0]?.score ?? 0
  const shortlist = discoveryRanking.filter((entry) => entry.score >= bestExploration - .08).slice(0, 5)
  const seed = `${String(options.seed ?? 'anonymous')}:${Math.floor(now / DAY_MS)}`
  const unit = options.random ? Math.min(1 - Number.EPSILON, Math.max(0, finiteNumber(options.random()))) : seededUnit(seed)
  const discovery = shortlist.length ? shortlist[Math.floor(unit * shortlist.length)].candidate : null
  const discoveries = [discovery, ...discoveryRanking.map(entry => entry.candidate).filter(candidate => contentKey(candidate)!==(discovery && contentKey(discovery)))].filter((item): item is RecommendationCandidate => !!item).slice(0,8)
  const discoveryKeys = new Set(discoveries.map(contentKey))
  const recent = sortByRecency(remaining.filter(candidate => !discoveryKeys.has(contentKey(candidate))), now).slice(0,8)
  return { forYou: forYou.map(toContent), discovery: discovery ? toContent(discovery) : null, discoveries: discoveries.map(toContent), recent: recent.map(toContent), hasHistory: profile.hasHistory, topGenres: profile.topGenres }
}

export function getContentRoute(content: Pick<Content, 'id' | 'type'> & Partial<Pick<Content,'name'|'slug'>>): string | null {
  if (!validId(content.id)) return null
  switch (normalized(content.type)) {
    case 'movie': return contentPath(content,'/movie')
    case 'tvshow': return contentPath(content,'/tv-show')
    case 'teaching': return contentPath(content,'/teaching')
    case 'video': return contentPath(content,'/video')
    default: return null
  }
}

/** Keep every browseable title, but use the existing preference engine for its initial order. */
export function buildCatalogueRecommendations<T extends RecommendationCandidate>(candidates: T[], history: WatchHistoryEntry[], options: ProfileOptions = {}) {
  const profile = buildWatchProfile(history, options)
  const ranked = rankRecommendationCandidates(candidates, profile, options)
  const byKey = new Map(candidates.map(item => [contentKey(item), item]))
  const items = ranked.map(item => byKey.get(contentKey(item))!)
  const payload = buildRecommendationPayload({ candidates, history, ...options })
  return {
    items,
    suggestions: payload.forYou.map(item => byKey.get(contentKey(item))!),
    personalized: profile.hasHistory,
  }
}

/** Popular within each format, interleaved so the catalogue's largest format cannot hide the rest. */
export function buildMixedPopular(candidates: RecommendationCandidate[], limit = 12): Content[] {
  const now = Date.now()
  const groups = ['movie', 'teaching', 'tvshow', 'video'].map(type => candidates.filter(item => item.type === type)
    .sort((a, b) => Math.max(0, finiteNumber(b.total_views)) - Math.max(0, finiteNumber(a.total_views))
      || effectiveTimestamp(b, now) - effectiveTimestamp(a, now) || stableOrder(a, b)))
  const result: Content[] = []
  const seen = new Set<string>()
  for (let index = 0; result.length < limit && groups.some(group => group.length > index); index++) {
    for (const group of groups) {
      const item = group[index]
      if (!item || seen.has(contentKey(item)) || result.length >= limit) continue
      seen.add(contentKey(item))
      result.push(toContent(item))
    }
  }
  return result
}
