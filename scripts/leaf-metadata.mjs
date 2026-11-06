import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = dirname(dirname(fileURLToPath(import.meta.url)))

const ownedFiles = [
  'src/components/Poster.tsx',
  'src/components/ShowDetail.tsx',
  'src/components/Detail.tsx',
  'src/routes/movie.$id.tsx',
  'src/routes/index.tsx',
  'src/routes/coming-soon.tsx',
]

const forbiddenIdentifiers = new Set([
  'IMDb_rating',
  'imdb_rating',
  'content_rating',
  'language',
  'languages',
  'rating',
  'ratingOf',
  'ratingToStr',
  'review',
  'reviews',
  'myReview',
  'ReviewCard',
  'ReviewForm',
  'Stars',
  'IconStar',
  'IconGlobe',
  'submitReview',
])

const forbiddenText = [
  { pattern: /\bIMDb\b/i, label: 'IMDb label' },
  { pattern: /%\s*Match\b/i, label: 'Match percentage' },
  { pattern: /\bPopular\s+Language\b/i, label: 'Languages rail' },
  { pattern: /\bYour\s+rating\b/i, label: 'rating input' },
  { pattern: /\b(?:write|edit|submit|update)\s+(?:your\s+)?review\b/i, label: 'review UI' },
  { pattern: /[★☆]/, label: 'star glyph' },
  { pattern: /\b\d+(?:\.\d+)?\s*\/\s*(?:5|10)\b/, label: 'numeric rating' },
  {
    pattern: /\b(?:p-rating|pv-match|crating|stars|star-input|review-(?:card|form|avatar|body|head|author|date|text)|cs-lang|lang-(?:card|name|count))\b/,
    label: 'rating, review, or language class',
  },
]

function parseSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  if (source.parseDiagnostics.length > 0) {
    const messages = source.parseDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '))
    throw new Error(`${file}: TSX parse failed: ${messages.join('; ')}`)
  }
  return source
}

function forbiddenInSource(file, text) {
  const source = parseSource(file, text)
  const hits = []

  function visit(node) {
    if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text)) {
      hits.push(`${file}: forbidden identifier ${node.text}`)
    }

    let visibleText = null
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      visibleText = node.text
    } else if (ts.isJsxText(node)) {
      visibleText = node.getText(source)
    }

    if (visibleText !== null) {
      for (const { pattern, label } of forbiddenText) {
        if (pattern.test(visibleText)) hits.push(`${file}: forbidden ${label}`)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return [...new Set(hits)]
}

function runAbsenceControls() {
  const forbiddenFixtures = [
    {
      name: 'IMDb property',
      source: 'const x = <span>{item.IMDb_rating} IMDb</span>',
      expected: 'identifier IMDb_rating',
    },
    {
      name: 'lowercase IMDb property',
      source: 'const x = <span>{movie.imdb_rating}</span>',
      expected: 'identifier imdb_rating',
    },
    {
      name: 'star rating card',
      source: 'const x = <span className="p-rating"><IconStar /> {rating}</span>',
      expected: 'identifier IconStar',
    },
    {
      name: 'Match percentage',
      source: 'const x = <span className="pv-match">{`${score}% Match`}</span>',
      expected: 'Match percentage',
    },
    {
      name: 'content rating chip',
      source: 'const x = <div className="crating">{movie.content_rating}</div>',
      expected: 'identifier content_rating',
    },
    {
      name: 'language metadata',
      source: 'const x = <span className="cs-lang"><IconGlobe /> {item.language}</span>',
      expected: 'identifier language',
    },
    {
      name: 'Languages rail',
      source: 'const x = <Rail title="Popular Language">{data.languages.map(renderLanguage)}</Rail>',
      expected: 'Languages rail',
    },
    {
      name: 'review stars',
      source: 'const x = <div className="stars" aria-label="Your rating">★★★★★</div>',
      expected: 'star glyph',
    },
    {
      name: 'review form',
      source: 'const x = <form className="review-form"><button>Submit Review</button></form>',
      expected: 'review UI',
    },
    {
      name: 'numeric rating',
      source: 'const x = <span>8.5/10</span>',
      expected: 'numeric rating',
    },
  ]

  for (const fixture of forbiddenFixtures) {
    const hits = forbiddenInSource(`control-${fixture.name}.tsx`, fixture.source)
    if (!hits.some((hit) => hit.includes(fixture.expected))) {
      throw new Error(`Absence control failed: ${fixture.name} did not produce ${fixture.expected}`)
    }
  }

  const cleanFixture = `
    export function CleanControl({ item, seasons, episodes }) {
      return <section>
        <img src={item.poster_url} alt={item.name} />
        <span>{String(item.release_date).slice(0, 4)}</span>
        <span>{item.duration}</span>
        <span>{seasons.length} Seasons · {episodes.length} Episodes</span>
        <button>Play now</button>
        <nav>Bible Notes Watchlist</nav>
      </section>
    }
  `
  const cleanHits = forbiddenInSource('control-clean.tsx', cleanFixture)
  if (cleanHits.length > 0) throw new Error(`Positive control failed: ${cleanHits.join('; ')}`)
}

function verifyAbsence(sources) {
  runAbsenceControls()
  const hits = ownedFiles.flatMap((file) => forbiddenInSource(file, sources.get(file)))
  if (hits.length > 0) throw new Error(hits.join('\n'))
}

const preservedSnippets = new Map([
  ['src/components/Poster.tsx', [
    'export function img(',
    'MANIFEST[base] ?? MANIFEST[stem] ?? DEFAULT_IMG',
    'export function PosterCard(',
    'to={`${base}/${item.id}` as any}',
    'img(item.poster_url)',
    'img(item.thumbnail_url || item.poster_url)',
    'item.release_date',
    'item.duration',
    'export function LiveChannelCard(',
    'to={`/channel/${channel.id}` as any}',
    'export function HeroSlider(',
    'img(hero.thumbnail_url || hero.poster_url)',
    'hero.release_date',
    'hero.duration',
    'baseFor(hero)',
    '<IconPlay /> {ctaLabel}',
    'aria-label="Add to watchlist"',
    'export function Top10Card(',
    '<span className="top10-rank">{rank}</span>',
    'export function CircleCard(',
    'export function Rail(',
    'export function ContentCard(',
  ]],
  ['src/components/ShowDetail.tsx', [
    'export function ShowDetail(',
    "type === 'teaching' ? '/teaching' : type === 'tvshow' ? '/tv-show' : '/movie'",
    '<WatchSection',
    'bunnyVideoId={show.bunny_video_url}',
    'trailerUrl={show.trailer_url}',
    'poster={show.thumbnail_url || show.poster_url}',
    'show.release_date',
    '{seasons.length} {seasonNoun} · {episodes.length} Episodes',
    'ep.duration',
    'ep.release_date',
    'img(ep.poster_url)',
    'seasons.map(',
    'seasonEps.map(',
    '<DetailTabs',
    '<ClipsRail clips={clips} />',
    '<WatchlistButton',
    "{ key: 'bible', label: 'Bible' }",
    "{ key: 'notes', label: 'Notes' }",
    "{activeTab === 'bible' && <BiblePanel />}",
    "{activeTab === 'notes' && <ContentNotes",
    'similar.map(',
  ]],
  ['src/components/Detail.tsx', [
    'export function TrailerPlayer(',
    'https://www.youtube.com/embed/',
    'export function DetailTabs(',
    '<DiscreteTabs',
    'const BIBLE_READINGS = [',
    "reference: 'Psalm 119:105'",
    'export function BiblePanel(',
    'Open YouVersion Bible',
    'export function ContentNotes(',
    'const storageKey = `streamit-notes:${contentType}:${contentId}`',
    'window.localStorage.setItem',
    'window.localStorage.removeItem',
    'Save note',
    'export function ClipsRail(',
    'img(c.poster_url)',
    'export function WatchlistButton(',
    'toggleWatchlist({ data: { entertainmentId } })',
    "router.navigate({ to: '/login' })",
    'export function BunnyPlayer(',
    'https://iframe.mediadelivery.net/embed/',
    'export function WatchSection(',
    'purchasePayPerView({',
    'movieAccess',
    'myPurchase',
    '<TrailerPlayer',
  ]],
  ['src/routes/movie.$id.tsx', [
    "createFileRoute('/movie/$id')",
    'getMovie({ data: Number(params.id) })',
    '<WatchSection',
    'contentType="movie"',
    'poster={movie.thumbnail_url || movie.poster_url}',
    'bunnyVideoId={movie.bunny_video_url}',
    'trailerUrl={movie.trailer_url}',
    'movie.release_date',
    'movie.duration',
    '<DetailTabs',
    '<ClipsRail clips={clips} />',
    '<WatchlistButton',
    "{ key: 'bible', label: 'Bible' }",
    "{ key: 'notes', label: 'Notes' }",
    "{tab === 'bible' && <BiblePanel />}",
    "{tab === 'notes' && <ContentNotes",
    'similar.map(',
    '<PosterCard',
  ]],
  ['src/routes/index.tsx', [
    "createFileRoute('/')",
    'getDashboard()',
    'getHomeAds()',
    '<HeroSlider slides={slides} baseFor={baseFor} genres={data.genres} />',
    '<HomeAds',
    '<Top10Card',
    'title="New Released Sermons"',
    'title="Pay Per View"',
    'title="Popular Sermons"',
    'title="Top Channels"',
    'title="Popular Shows"',
    'title="Popular Personalities"',
    'title="Free Sermons"',
    'title="Genres"',
    'title="Coming Soon"',
    'title="Most Watched Videos"',
    'data.latest.map(',
    'data.payPerView.map(',
    'data.popularMovies.map(',
    'data.channels.map(',
    'data.popularTvShows.map(',
    'data.cast.map(',
    'data.free.map(',
    'data.genres.map(',
    'data.comingSoon.map(',
    'data.mostWatched.map(',
    "item.type === 'teaching' ? '/teaching' : item.type === 'tvshow' ? '/tv-show' : '/movie'",
    'img(c.poster_url)',
  ]],
  ['src/routes/coming-soon.tsx', [
    "createFileRoute('/coming-soon')",
    'getComingSoon()',
    'function daysToGo(',
    'item.release_date',
    'daysToGo(item.release_date)',
    'img(item.thumbnail_url || item.poster_url)',
    'to={`${base}/${item.id}` as any}',
    'item.genres',
    'item.trailer_url',
    'Watch Trailer',
    "['movie', 'Sermon']",
    "['tvshow', 'Show']",
    "['teaching', 'Teaching']",
    "['video', 'Video']",
    'shown.map(',
  ]],
])

function verifyPreservation(sources) {
  for (const file of ownedFiles) {
    parseSource(file, sources.get(file))
    const compact = sources.get(file).replace(/\s+/g, ' ')
    const snippets = preservedSnippets.get(file)
    const missing = snippets.filter((snippet) => !compact.includes(snippet.replace(/\s+/g, ' ')))
    if (missing.length > 0) {
      throw new Error(`${file}: preserved features missing:\n- ${missing.join('\n- ')}`)
    }
  }

  const api = readFileSync(join(root, 'src/lib/api.ts'), 'utf8')
  const internalData = [
    'IMDb_rating',
    'imdb_rating',
    'language',
    'content_rating',
    'submitReview',
    'FROM reviews',
    'AVG(rating)',
    'SELECT language AS name',
  ]
  const missingInternalData = internalData.filter((snippet) => !api.includes(snippet))
  if (missingInternalData.length > 0) {
    throw new Error(`Internal API/admin data changed: ${missingInternalData.join(', ')}`)
  }
}

function main() {
  const args = process.argv.slice(2)
  const preserve = args.length === 1 && args[0] === '--preserve'
  if (args.length > 1 || (args.length === 1 && !preserve)) {
    throw new Error('Usage: node scripts/leaf-metadata.mjs [--preserve]')
  }

  const sources = new Map(ownedFiles.map((file) => [file, readFileSync(join(root, file), 'utf8')]))
  if (preserve) {
    verifyPreservation(sources)
    console.log('METADATA_PRESERVE_OK')
  } else {
    verifyAbsence(sources)
    console.log('METADATA_LEAF_OK')
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
