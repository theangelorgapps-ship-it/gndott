import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), 'utf8')
const check = (condition, message) => {
  if (!condition) throw new Error(message)
}
const section = (source, start, end) => {
  const from = source.indexOf(start)
  check(from >= 0, `Missing section: ${start}`)
  const to = source.indexOf(end, from + start.length)
  check(to >= 0, `Missing section boundary after: ${start}`)
  return source.slice(from, to)
}
const has = (source, fragment, message) => check(source.includes(fragment), message)
const lacks = (source, fragment, message) => check(!source.includes(fragment), message)

const api = read('src/lib/api.ts')
const listings = read('src/routes/teachings.tsx')
const teachingRoute = read('src/routes/teaching.$id.tsx')
const tvRoute = read('src/routes/tv-show.$id.tsx')
const detail = read('src/components/ShowDetail.tsx')
const continueWatching = read('src/routes/continue-watching.tsx')
const watchlist = read('src/routes/watchlist.tsx')
const cast = read('src/routes/cast.$id.tsx')

const getTeachings = section(api, 'export const getTeachings', 'export const getVideos')
has(getTeachings, "type = 'teaching'", 'Teachings must query the existing teaching content type.')
has(getTeachings, 'status = 1', 'Teachings must include active rows only.')
has(getTeachings, 'deleted_at IS NULL', 'Teachings must exclude soft-deleted rows.')
has(getTeachings, 'ORDER BY name', 'Teachings must be ordered by name.')
lacks(getTeachings, "type = 'tvshow'", 'Teachings must not reuse the TV-show query filter.')

const search = section(api, 'export const searchContent', 'export const getMovie')
has(search, 'const [movies, tvshows, teachings, videos, channels]', 'Search must query teachings alongside all existing result groups.')
has(search, "type = 'teaching' AND (name LIKE ? OR LOWER(?) IN ('teaching', 'teachings')) AND status = 1 AND deleted_at IS NULL LIMIT 20", 'Search teachings must support title text and the Teachings category using active, non-deleted admin content.')
has(search, 'return { movies, tvshows, teachings, videos, channels }', 'Search must return the teachings result group.')

const getTvShow = section(api, 'export const getTvShow =', 'export const getVideo =')
has(getTvShow, 'id, show.type,', 'Clips must be queried with the actual show type.')
has(getTvShow, 'show.type,', 'Similar content and ads must receive the actual show type.')
has(getTvShow, 'WHERE type = ? AND id != ?', 'Similar content must use a dynamic type filter.')
has(getTvShow, 'getPlaybackAds(show.type', 'Playback ads must use the actual show type.')
has(getTvShow, 'myPurchase', 'Show details must preserve paid-content purchase state.')
lacks(getTvShow, "content_type = 'tvshow'", 'Clips must not be hardcoded to TV shows.')
lacks(getTvShow, "WHERE type = 'tvshow' AND id != ?", 'Similar content must not be hardcoded to TV shows.')
lacks(getTvShow, "getPlaybackAds('tvshow'", 'Playback ads must not be hardcoded to TV shows.')
lacks(getTvShow, "'tvshow'", 'The shared show query must not fall back to a hardcoded TV-show type.')

const purchase = section(api, 'export const purchasePayPerView', '// ---------- OTP login ----------')
has(purchase, "| 'teaching'", 'Paid teachings must be accepted by the rental API.')
has(purchase, "data.type === 'movie' || data.type === 'teaching' ? 'entertainments'", 'Paid teachings must rent an entertainment record, not an episode.')
has(purchase, "const purchaseType = data.type === 'teaching' ? 'movie' : data.type", 'Teaching rentals must use the existing entertainment purchase convention.')
lacks(purchase, 'session.uid, data.id, data.type,', 'Teaching rentals must not persist an incompatible purchase type.')

has(listings, "createFileRoute('/teachings')", 'The Teachings listing route must be registered.')
has(listings, 'getTeachings()', 'The Teachings listing must load getTeachings.')
has(listings, "baseFor={() => '/teaching'}", 'The Teachings hero must link to teaching details.')
has(listings, 'base="/teaching"', 'The Teachings grid must link to teaching details.')
has(listings, '<h2>Teachings</h2>', 'The listing must visibly identify Teachings.')
has(listings, 'No teachings available yet.', 'The listing must have a teaching-specific empty state.')
lacks(listings, 'base="/tv-show"', 'The Teachings grid must not link to TV-show details.')
lacks(listings, '<h2>TV Shows</h2>', 'The Teachings listing must not retain the TV Shows heading.')

has(teachingRoute, "createFileRoute('/teaching/$id')", 'The teaching detail route must be registered.')
has(teachingRoute, 'getTvShow({ data: Number(params.id) })', 'Teaching detail must reuse the shared show loader API.')
has(teachingRoute, 'kind="teaching"', 'Teaching detail must select the teaching presentation.')
has(tvRoute, "createFileRoute('/tv-show/$id')", 'The existing TV-show detail route must remain registered.')
has(tvRoute, 'getTvShow({ data: Number(params.id) })', 'The existing TV-show loader must remain intact.')
has(tvRoute, 'kind="tvshow"', 'TV-show detail must use the shared detail component.')

has(detail, "kind: 'tvshow' | 'teaching'", 'ShowDetail must accept both supported kinds.')
has(detail, 'export function ShowDetail', 'The complete detail hierarchy must be shared.')
has(detail, 'contentType={show.type as any}', 'WatchSection must receive the actual content type.')
has(detail, 'ContentNotes contentType={show.type}', 'Notes must be scoped by the actual content type.')
has(detail, 'myPurchase={myPurchase}', 'Paid and free playback state must reach WatchSection.')
has(detail, '<BiblePanel />', 'The Bible panel must be preserved.')
has(detail, '<Rail title="Featured">', 'The Featured rail must be preserved.')
has(detail, "'Volumes (Series)'", 'Teaching season totals must be labelled Volumes (Series).')
has(detail, "`Volume ${s.season_index}`", 'Teaching season fallbacks must be labelled Volume.')
has(detail, 'No episodes listed for this volume.', 'Teaching empty season text must use volume terminology.')
has(detail, "type === 'teaching' ? '/teaching'", 'Mixed rails must map teaching content to teaching details.')
has(detail, "type === 'tvshow' ? '/tv-show'", 'Mixed rails must map TV-show content to TV-show details.')
has(detail, ": '/movie'", 'Mixed rails must retain movie fallback routing.')
lacks(detail, 'contentType="tvshow"', 'Shared detail must not hardcode WatchSection or Notes to TV shows.')
lacks(detail, 'base="/tv-show"', 'Shared Featured links must derive their base from content type.')

for (const [name, source, item] of [
  ['Continue Watching', continueWatching, 'm'],
  ['Watchlist', watchlist, 'm'],
  ['Cast', cast, 'w'],
]) {
  has(source, `${item}.type === 'teaching' ? '/teaching'`, `${name} must route teaching items correctly.`)
  has(source, `${item}.type === 'tvshow' ? '/tv-show'`, `${name} must preserve TV-show routing.`)
  has(source, ": '/movie'", `${name} must preserve movie fallback routing.`)
}

console.log('TEACHING_LEAF_OK')
