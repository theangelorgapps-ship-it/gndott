import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function includes(source, text, label) {
  assert(source.includes(text), `${label}: missing ${JSON.stringify(text)}`)
}

function matches(source, pattern, label) {
  assert(pattern.test(source), `${label}: expected ${pattern}`)
}

function excludes(source, pattern, label) {
  assert(!pattern.test(source), `${label}: unexpected match for ${pattern}`)
}

function between(source, start, end, label) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert(from >= 0 && to > from, `${label}: could not isolate source section`)
  return source.slice(from, to)
}

function proveAbsenceChecks() {
  let failed = false
  try {
    excludes('IMDb positive control', /IMDb/, 'absence self-test')
  } catch {
    failed = true
  }
  assert(failed, 'Absence checks must reject a present forbidden token')
}

function checkLabels() {
  const rootRoute = read('src/routes/__root.tsx')
  includes(rootRoute, '<Link to="/movies">Sermons</Link>', 'root navigation')
  includes(rootRoute, '<Link to="/tv-shows">Shows</Link>', 'root navigation')
  includes(rootRoute, '<Link to="/teachings">Teachings</Link>', 'root navigation')
  includes(rootRoute, "'/teachings'", 'root active paths')
  includes(rootRoute, "'/teaching'", 'root active paths')
  includes(rootRoute, 'Watch sermons, shows, teachings, live TV and videos on GoodNews Halobox.', 'root metadata')
  includes(rootRoute, 'Unlimited Sermons, Shows and Teachings!', 'footer tagline')
  includes(rootRoute, 'best sermons, shows and teachings!', 'footer app copy')
  excludes(rootRoute, /Watch movies, TV shows|Unlimited Movies and Shows|best movies and shows/, 'old root copy')

  const movies = read('src/routes/movies.tsx')
  includes(movies, '<h2>Sermons</h2>', 'sermon list')
  includes(movies, 'No sermons available yet.', 'sermon list')
  includes(movies, "createFileRoute('/movies')", 'sermon list URL')
  includes(movies, 'base="/movie"', 'sermon detail URL')

  const shows = read('src/routes/tv-shows.tsx')
  includes(shows, '<h2>Shows</h2>', 'show list')
  includes(shows, 'No shows available yet.', 'show list')
  includes(shows, "createFileRoute('/tv-shows')", 'show list URL')
  includes(shows, 'base="/tv-show"', 'show detail URL')

  const home = read('src/routes/index.tsx')
  for (const title of ['New Released Sermons', 'Popular Sermons', 'Popular Shows', 'Free Sermons']) {
    includes(home, `title="${title}"`, 'home rails')
  }
  matches(home, /item\.type === 'teaching' \? '\/teaching' : item\.type === 'tvshow' \? '\/tv-show' : '\/movie'/, 'home mixed-rail routing')

  const search = read('src/routes/search.tsx')
  includes(search, "{ label: 'Sermons', q: 'movie' }", 'search categories')
  includes(search, "{ label: 'Shows', q: 'show' }", 'search categories')
  includes(search, "{ label: 'Teachings', q: 'teaching' }", 'search categories')
  includes(search, 'results.teachings', 'search results')
  includes(search, '<h2>Teachings</h2>', 'search results')
  includes(search, 'base="/teaching"', 'search results')
  includes(search, 'sermons, shows, teachings, and videos', 'search copy')

  const spotlight = read('src/components/ui/apple-spotlight.tsx')
  includes(spotlight, "{ label: 'Sermons', icon: <Clapperboard />, link: '/movies' }", 'spotlight shortcuts')
  includes(spotlight, "{ label: 'Shows', icon: <MonitorPlay />, link: '/tv-shows' }", 'spotlight shortcuts')
  includes(spotlight, "label: 'Teachings'", 'spotlight shortcuts')
  includes(spotlight, "link: '/teachings'", 'spotlight shortcuts')
  includes(spotlight, 'r.teachings', 'spotlight results')
  includes(spotlight, 'description: `Teaching', 'spotlight results')
  includes(spotlight, 'link: `/teaching/${m.id}`', 'spotlight results')

  const trending = read('src/routes/trending.tsx')
  includes(trending, 'Trending Sermons in your Country', 'trending')
  matches(trending, /item\.type === 'teaching' \? '\/teaching' : item\.type === 'tvshow' \? '\/tv-show' : '\/movie'/, 'trending mixed-rail routing')

  const comingSoon = read('src/routes/coming-soon.tsx')
  includes(comingSoon, "| 'teaching'", 'coming-soon kinds')
  includes(comingSoon, "['movie', 'Sermon']", 'coming-soon filters')
  includes(comingSoon, "['tvshow', 'Show']", 'coming-soon filters')
  includes(comingSoon, "['teaching', 'Teaching']", 'coming-soon filters')
  includes(comingSoon, 'sermons, shows and teachings', 'coming-soon copy')
  matches(comingSoon, /item\.type === 'teaching' \? '\/teaching' : item\.type === 'tvshow' \? '\/tv-show' : '\/movie'/, 'coming-soon mixed-rail routing')

  const payPerView = read('src/routes/pay-per-view.tsx')
  includes(payPerView, "movie: 'Sermon'", 'pay-per-view filters')
  excludes(payPerView, /k\[0\]\.toUpperCase\(\) \+ k\.slice\(1\)/, 'pay-per-view dynamic movie label')

  const ownedUi = [
    rootRoute, movies, shows, home, search, spotlight, trending, comingSoon, payPerView,
  ].join('\n')
  for (const oldLabel of ['New Released Movies', 'Popular Movies', 'Popular TV Shows', 'Free Movies', 'Trending Movies']) {
    excludes(ownedUi, new RegExp(oldLabel), 'old visible labels')
  }
  excludes(ownedUi, /label: 'Movies'|label: 'TV Shows'|>Movies<|>TV Shows</, 'old navigation/result labels')

  proveAbsenceChecks()
  console.log('LABELS_LEAF_OK')
}

function checkRatings() {
  const video = read('src/routes/video.$id.tsx')
  includes(video, 'IconCalendar', 'video metadata positive control')
  includes(video, 'IconClock', 'video metadata positive control')
  excludes(video, /IMDb|imdb|IconStar/, 'video detail IMDb removal')

  const poster = read('src/components/Poster.tsx')
  const posterCard = between(poster, 'export function PosterCard', '/** Netflix-style', 'PosterCard')
  includes(posterCard, "const rating = base === '/video' ? null : ratingOf(item)", 'PosterCard video rating suppression')
  includes(posterCard, '<HoverPreview item={item} base={base} rating={rating} />', 'PosterCard match suppression')

  const hero = between(poster, 'export function HeroSlider', 'export function Top10Card', 'HeroSlider')
  matches(hero, /baseFor\(hero\) !== '\/video'\s*&&\s*\(hero\.IMDb_rating \|\| hero\.imdb_rating\)/, 'hero video IMDb guard')
  includes(hero, '<span><IconStar /> {hero.IMDb_rating ?? hero.imdb_rating} (IMDb)</span>', 'non-video hero rating positive control')

  const top10 = between(poster, 'export function Top10Card', 'export function CircleCard', 'Top10Card')
  includes(top10, "const rating = item.type === 'video' ? null : ratingOf(item)", 'Top 10 video rating suppression')
  includes(top10, '<IconStar size={10} /> {rating}', 'non-video Top 10 rating positive control')

  proveAbsenceChecks()
  console.log('VIDEO_RATINGS_LEAF_OK')
}

try {
  const mode = process.argv[2]
  assert(mode === undefined || mode === '--ratings', `Unknown argument: ${mode}`)
  if (mode === '--ratings') checkRatings()
  else checkLabels()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
