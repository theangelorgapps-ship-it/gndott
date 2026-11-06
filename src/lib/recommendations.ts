import type { Content } from './api'

export interface RecommendationPayload {
  forYou: Content[]
  discovery: Content | null
  recent: Content[]
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

export interface WatchHistoryEntry {
  entertainment_id: number
  entertainment_type?: string | null
  watched_time?: number | string | null
  total_watched_time?: number | string | null
  created_at?: string | null
  updated_at?: string | null
  genres?: string[] | string | null
  genre_names?: string | null
}

export interface WatchProfile {
  hasHistory: boolean
  genreWeights: ReadonlyMap<string, number>
  typeWeights: ReadonlyMap<string, number>
  topGenres: string[]
  watchedIds: ReadonlySet<number>
}

export interface ScoreOptions {
  currentGenres?: string[]
  maxViews?: number
  now?: number
}

export interface RecommendationOptions extends ScoreOptions {
  candidates: RecommendationCandidate[]
  history: WatchHistoryEntry[]
  currentId?: number | null
  currentType?: string | null
  random?: () => number
}

const DAY_MS = 86_400_000
const VALID_TYPES = new Set(['movie', 'tvshow', 'teaching', 'video'])

function finiteNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function genreList(value: RecommendationCandidate['genres'] | RecommendationCandidate['genre_names']): string[] {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',')
  return [...new Set(values.map((genre) => String(genre).trim()).filter(Boolean))]
}

function candidateGenres(candidate: RecommendationCandidate): string[] {
  return genreList(candidate.genres ?? candidate.genre_names)
}

function historyGenres(entry: WatchHistoryEntry): string[] {
  return genreList(entry.genres ?? entry.genre_names)
}

function timestamp(value: unknown): number {
  if (value == null || value === '') return Number.NaN
  const text = String(value).trim()
  // SQLite datetime() returns UTC without a zone suffix.
  const normalizedDate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(' ', 'T')}Z`
    : text
  const parsed = Date.parse(normalizedDate)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function contentTimestamp(content: Pick<RecommendationCandidate, 'updated_at' | 'created_at' | 'release_date'>): number {
  for (const value of [content.updated_at, content.created_at, content.release_date]) {
    const parsed = timestamp(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function boundedPopularity(candidate: RecommendationCandidate, maxViews: number): number {
  if (maxViews <= 0) return 0
  return Math.min(1, Math.max(0, Math.log1p(Math.max(0, finiteNumber(candidate.total_views))) / Math.log1p(maxViews)))
}

function boundedRecency(candidate: RecommendationCandidate, now: number): number {
  const updated = contentTimestamp(candidate)
  if (!updated) return 0
  const ageDays = Math.max(0, (now - updated) / DAY_MS)
  return Math.min(1, Math.max(0, Math.exp(-ageDays / 180)))
}

function contentKey(content: Pick<Content, 'id' | 'type'>): string {
  return `${normalized(content.type)}:${content.id}`
}

function toContent(candidate: RecommendationCandidate): Content {
  const {
    genres: _genres,
    genre_names: _genreNames,
    total_views: _totalViews,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...content
  } = candidate
  return content
}

/** Build a recency- and watch-duration-weighted profile from newest-first history. */
export function buildWatchProfile(history: WatchHistoryEntry[]): WatchProfile {
  const genreWeights = new Map<string, number>()
  const typeWeights = new Map<string, number>()
  const genreNames = new Map<string, string>()
  const watchedIds = new Set<number>()
  const usableHistory = history.filter((entry) => Number.isFinite(Number(entry.entertainment_id)) && Number(entry.entertainment_id) > 0)

  usableHistory.forEach((entry, index) => {
    const id = Number(entry.entertainment_id)
    watchedIds.add(id)
    const recencyWeight = 1 / (1 + index * 0.12)
    const watchedSeconds = Math.max(0, finiteNumber(entry.watched_time))
    const durationAffinity = Math.min(1, Math.log1p(watchedSeconds) / Math.log1p(2 * 60 * 60))
    const weight = recencyWeight * (0.75 + 0.25 * durationAffinity)

    for (const genre of historyGenres(entry)) {
      const key = normalized(genre)
      if (!key) continue
      genreNames.set(key, genreNames.get(key) ?? genre)
      genreWeights.set(key, (genreWeights.get(key) ?? 0) + weight)
    }
    const type = normalized(entry.entertainment_type)
    if (VALID_TYPES.has(type)) typeWeights.set(type, (typeWeights.get(type) ?? 0) + weight)
  })

  const topGenres = [...genreWeights.entries()]
    .sort((a, b) => b[1] - a[1] || (genreNames.get(a[0]) ?? a[0]).localeCompare(genreNames.get(b[0]) ?? b[0]))
    .slice(0, 3)
    .map(([key]) => genreNames.get(key) ?? key)

  return {
    hasHistory: usableHistory.length > 0,
    genreWeights,
    typeWeights,
    topGenres,
    watchedIds,
  }
}

/** Score only with bounded, transparent features; never attach scores to API content. */
export function scoreCandidate(candidate: RecommendationCandidate, profile: WatchProfile, options: ScoreOptions = {}): number {
  const genres = candidateGenres(candidate)
  const popularity = boundedPopularity(candidate, Math.max(0, options.maxViews ?? 0))
  const recency = boundedRecency(candidate, options.now ?? Date.now())

  if (profile.hasHistory) {
    const totalGenreWeight = [...profile.genreWeights.values()].reduce((sum, weight) => sum + weight, 0)
    const totalTypeWeight = [...profile.typeWeights.values()].reduce((sum, weight) => sum + weight, 0)
    const matchedGenreWeight = genres.reduce((sum, genre) => sum + (profile.genreWeights.get(normalized(genre)) ?? 0), 0)
    const genreAffinity = totalGenreWeight > 0 ? Math.min(1, matchedGenreWeight / totalGenreWeight) : 0
    const typeAffinity = totalTypeWeight > 0 ? (profile.typeWeights.get(normalized(candidate.type)) ?? 0) / totalTypeWeight : 0
    // Genre and type dominate; popularity and recency can only break near-ties.
    return 0.80 * genreAffinity + 0.15 * typeAffinity + 0.025 * popularity + 0.025 * recency
  }

  const currentGenres = genreList(options.currentGenres ?? [])
  if (currentGenres.length > 0) {
    const preferred = new Set(currentGenres.map(normalized))
    const matches = genres.filter((genre) => preferred.has(normalized(genre))).length
    const currentGenreAffinity = matches / currentGenres.length
    return 0.75 * currentGenreAffinity + 0.15 * popularity + 0.10 * recency
  }

  // Anonymous/no-history fallback is explicitly popular + current, not personalized.
  return 0.80 * popularity + 0.20 * recency
}

export function rankRecommendationCandidates(
  candidates: RecommendationCandidate[],
  profile: WatchProfile,
  options: ScoreOptions = {},
): RecommendationCandidate[] {
  const maxViews = options.maxViews ?? candidates.reduce((max, candidate) => Math.max(max, finiteNumber(candidate.total_views)), 0)
  const scoreOptions = { ...options, maxViews }
  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(candidate, profile, scoreOptions) }))
    .sort((a, b) => b.score - a.score || contentTimestamp(b.candidate) - contentTimestamp(a.candidate) || a.index - b.index)
    .map(({ candidate }) => candidate)
}

/** COALESCE(updated_at, created_at, release_date), newest first, with stable input-order ties. */
export function sortByRecency(candidates: RecommendationCandidate[]): RecommendationCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => contentTimestamp(b.candidate) - contentTimestamp(a.candidate) || a.index - b.index)
    .map(({ candidate }) => candidate)
}

function randomIndex(length: number, random: () => number): number {
  const value = random()
  const unit = Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0
  return Math.floor(unit * length)
}

export function buildRecommendationPayload(options: RecommendationOptions): RecommendationPayload {
  const profile = buildWatchProfile(options.history)
  const unique = new Map<string, RecommendationCandidate>()
  for (const candidate of options.candidates) {
    if (!Number.isFinite(Number(candidate.id)) || Number(candidate.id) <= 0) continue
    if (!VALID_TYPES.has(normalized(candidate.type))) continue
    if (profile.watchedIds.has(Number(candidate.id))) continue
    const isCurrent = Number(candidate.id) === Number(options.currentId)
      && (options.currentId != null)
      && (!options.currentType || normalized(candidate.type) === normalized(options.currentType))
    if (isCurrent) continue
    const key = contentKey(candidate)
    if (!unique.has(key)) unique.set(key, candidate)
  }

  const eligible = [...unique.values()]
  const random = options.random ?? Math.random
  const discoveryIndex = eligible.length > 0 ? randomIndex(eligible.length, random) : -1
  const discoveryCandidate = discoveryIndex >= 0 ? eligible[discoveryIndex] : null
  const afterDiscovery = eligible.filter((_, index) => index !== discoveryIndex)

  const scoreOptions: ScoreOptions = {
    currentGenres: options.currentGenres,
    now: options.now,
  }
  const forYouCandidates = rankRecommendationCandidates(afterDiscovery, profile, scoreOptions).slice(0, 8)
  const used = new Set(forYouCandidates.map(contentKey))
  const recentCandidates = sortByRecency(afterDiscovery.filter((candidate) => !used.has(contentKey(candidate)))).slice(0, 8)

  return {
    forYou: forYouCandidates.map(toContent),
    discovery: discoveryCandidate ? toContent(discoveryCandidate) : null,
    recent: recentCandidates.map(toContent),
    hasHistory: profile.hasHistory,
    topGenres: profile.topGenres,
  }
}

export function getContentRoute(content: Pick<Content, 'id' | 'type'>): string | null {
  switch (normalized(content.type)) {
    case 'movie': return `/movie/${content.id}`
    case 'tvshow': return `/tv-show/${content.id}`
    case 'teaching': return `/teaching/${content.id}`
    case 'video': return `/video/${content.id}`
    default: return null
  }
}
