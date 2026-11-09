import { contentPath } from '../lib/contentRoutes'

export const NEXT_COUNTDOWN_SECONDS = 8
export type NextPlayback = {
  title: string
  poster?: string | null
  description?: string | null
  subtitle?: string
  requiresPurchase?: boolean
  requiresSubscription?: boolean
  onPlay: () => void
}
export type EndRecommendation = {
  id: number; name: string; type: string; href: string
  poster?: string | null; description?: string | null; paid: boolean; subscription: boolean
}

/** Near-end is a preview only: advancing always waits for the actual ended event. */
export function nearPlaybackEnd(position: number, duration: number, hasPlayed: boolean) {
  return hasPlayed && Number.isFinite(position) && Number.isFinite(duration) && duration > 30 &&
    position >= duration - Math.min(20, duration * .08)
}

export function endRecommendations(items: any[] | undefined, current: { contentType: string; contentId: number }): EndRecommendation[] {
  const seen = new Set([`${current.contentType}:${current.contentId}`])
  const results: EndRecommendation[] = []
  for (const item of Array.isArray(items) ? items : []) {
    const type = item?.type === 'show' ? 'tvshow' : item?.type || 'movie'
    const id = Number(item?.id)
    if (!['movie', 'video', 'tvshow', 'teaching'].includes(type) || !Number.isSafeInteger(id) || id <= 0 || typeof item?.name !== 'string' || !item.name.trim()) continue
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ id, name: item.name, type, href: contentPath({ ...item, id, type }), poster: item.thumbnail_url || item.poster_url,
      description: item.description || item.short_desc, paid: (item.movie_access === 'paid' || item.access === 'paid') && !item.myPurchase, subscription: item.hasSubscriptionAccess === false })
    if (results.length === 8) break
  }
  return results
}

/** Episode numbers, rather than insertion IDs, determine the next episode. */
export function orderedEpisodes<T extends { id: number; season_id?: number; episode_index?: unknown; episode_number?: unknown }>(episodes: T[], seasons: { id: number }[]): T[] {
  const order = new Map(seasons.map((season, index) => [String(season.id), index]))
  const number = (episode: T) => {
    const value = Number(episode.episode_index ?? episode.episode_number)
    return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER
  }
  return [...episodes].sort((a, b) => (order.get(String(a.season_id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b.season_id)) ?? Number.MAX_SAFE_INTEGER) || number(a) - number(b) || a.id - b.id)
}

/** Count visible seconds, pause in background tabs, and fire no more than once. */
export function createNextCountdown(onTick: (seconds: number) => void, onNext: () => void, clock = {
  set: (callback: () => void) => setTimeout(callback, 1000),
  clear: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
}) {
  let remaining = NEXT_COUNTDOWN_SECONDS
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let enabled = false
  const schedule = () => {
    if (stopped || !enabled || timer !== undefined) return
    timer = clock.set(() => {
      timer = undefined
      if (stopped || !enabled) return
      onTick(--remaining)
      if (!remaining) { stopped = true; onNext() }
      else schedule()
    })
  }
  onTick(remaining)
  return {
    setVisible(visible: boolean) {
      enabled = visible
      if (!visible && timer !== undefined) { clock.clear(timer); timer = undefined }
      schedule()
    },
    cancel() { stopped = true; if (timer !== undefined) clock.clear(timer); timer = undefined },
  }
}
