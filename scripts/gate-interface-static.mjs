import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const owned = {
  root: 'src/routes/__root.tsx',
  home: 'src/routes/index.tsx',
  movie: 'src/routes/movie.$id.tsx',
  video: 'src/routes/video.$id.tsx',
  search: 'src/routes/search.tsx',
  poster: 'src/components/Poster.tsx',
  detail: 'src/components/Detail.tsx',
  show: 'src/components/ShowDetail.tsx',
  spotlight: 'src/components/ui/apple-spotlight.tsx',
  styles: 'src/styles.css',
}
const source = Object.fromEntries(
  Object.entries(owned).map(([key, path]) => [key, readFileSync(join(root, path), 'utf8')]),
)

function requireMatch(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message)
}
function rejectMatch(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message)
}
function ordered(text, snippets, message) {
  let cursor = -1
  for (const snippet of snippets) {
    const next = text.indexOf(snippet, cursor + 1)
    if (next < 0) throw new Error(`${message}: missing or out of order (${snippet})`)
    cursor = next
  }
}

function headerGate() {
  const { root: rootSource, home, spotlight, styles } = source
  requireMatch(rootSource, /className="site-header-bar"/, 'header must use the reference bar structure')
  requireMatch(rootSource, /className="brand"/, 'existing Streamit brand must remain')
  for (const label of ['Home', 'Sermons', 'Teachings', 'Shows', 'Videos', 'Live TV', 'Watchlist']) {
    requireMatch(rootSource, new RegExp(`label: '${label}'`), `missing top-level destination: ${label}`)
  }
  rejectMatch(`${rootSource}\n${home}\n${spotlight}`, /All Content|Coming Soon/i, 'retired discovery entries remain in public navigation or home')
  requireMatch(rootSource, /to="\/watchlist"|link: '\/watchlist'|to: '\/watchlist'/, 'Watchlist must be linked')
  requireMatch(rootSource, /AppleSpotlight[\s\S]*isOpen=\{spotlightOpen\}/, 'catalogue search must remain connected')
  requireMatch(rootSource, /event\.key === 'Escape'/, 'mobile menu must close on Escape')
  requireMatch(rootSource, /setMenuOpen\(false\)[\s\S]*\[pathname\]/, 'mobile menu must close on navigation')
  requireMatch(rootSource, /aria-expanded=\{menuOpen\}/, 'mobile menu trigger must expose state')
  requireMatch(rootSource, /mobile-menu-sheet[\s\S]*role="dialog"|role="dialog"[\s\S]*mobile-menu-sheet/, 'mobile sheet must be a dialog')
  requireMatch(rootSource, /mobile-menu-sheet[\s\S]*querySelectorAll|querySelectorAll[\s\S]*mobile-menu-sheet/, 'mobile sheet must manage keyboard focus')
  for (const label of ['Home', 'Sermons', 'Live TV', 'Watchlist', 'Menu']) {
    requireMatch(rootSource, new RegExp(`mobile-dock[\\s\\S]*${label}`), `mobile dock missing ${label}`)
  }
  requireMatch(styles, /\.site-header\s*\{[^}]*position:\s*fixed/s, 'header must be fixed')
  requireMatch(styles, /\.site-header-bar\s*\{[^}]*display:\s*grid/s, 'header bar must be a three-area grid')
  requireMatch(styles, /\.site-header\s*\{[^}]*z-index:\s*80/s, 'header z-index must be 80')
  requireMatch(styles, /\.brand\s*\{[^}]*width:\s*210px[^}]*height:\s*62px/s, 'desktop brand must be about 210 by 62')
  requireMatch(styles, /\.main-nav\s*\{[^}]*gap:\s*26px/s, 'desktop navigation gap must be 26px')
  requireMatch(styles, /\.main-nav a\s*\{[^}]*font-size:\s*14\.5px/s, 'desktop navigation type must be 14.5px')
  requireMatch(styles, /\.subscribe-glass\s*\{[^}]*width:\s*142px[^}]*height:\s*40px/s, 'subscription CTA must be a 142 by 40 pill')
  requireMatch(styles, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.main-nav\s*\{\s*display:\s*none/, 'desktop navigation must hide at mobile breakpoint')
  requireMatch(styles, /\.mobile-menu-sheet\s*\{[^}]*overflow-y:\s*auto/s, 'mobile sheet must scroll without page overflow')
  requireMatch(styles, /\.mobile-dock\s*\{[^}]*position:\s*fixed[^}]*border-radius:/s, 'mobile dock must be fixed and rounded')
}

function detailsGate() {
  const { movie, video, show, detail, home, search, styles } = source
  for (const [name, text] of [['movie', movie], ['video', video], ['show', show]]) {
    requireMatch(text, /useState\('more'\)/, `${name} must default to Featured`)
    ordered(text, ["key: 'more'", "key: 'bible'", "key: 'notes'", "key: 'about'"], `${name} tab order is incorrect`)
    requireMatch(text, /data\.recommendations/, `${name} must consume recommendations when supplied`)
    requireMatch(text, /<AboutPanel/, `${name} must render About including empty states`)
  }
  requireMatch(show, /label:\s*isTeaching\s*\?\s*'Volumes'\s*:\s*'Episodes'/, 'show and teaching collection tab must use Episodes or Volumes')
  ordered(show, ["key: 'more'", "key: 'episodes'", "key: 'bible'", "key: 'notes'", "key: 'about'"], 'collection tab must follow Featured')
  requireMatch(detail, /about:\s*Info/, 'About needs its own appropriate icon')
  requireMatch(detail, /function AboutPanel/, 'shared About panel is missing')
  requireMatch(detail, /Personality/, 'cast must be publicly labelled Personality')
  requireMatch(detail, /Location/, 'directors must be publicly labelled Location')
  requireMatch(detail, /about-grid/, 'About must use the two-column layout')
  requireMatch(styles, /\.about-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, 'About columns must be adjacent on desktop')
  requireMatch(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.about-grid\s*\{\s*grid-template-columns:\s*1fr/, 'About columns must stack on mobile')
  requireMatch(home, /data\.recommendations/, 'home must consume recommendations')
  for (const title of ['Recommended for You', 'Featured for You', 'Discover Something Different', 'Recently Updated']) {
    requireMatch(`${home}\n${source.poster}`, new RegExp(title), `missing recommendation group: ${title}`)
  }
  requireMatch(source.poster, /recommendations\?\./, 'recommendation rendering must tolerate an absent payload')
  requireMatch(source.poster, /type === 'video'\s*\?\s*'\/video'/, 'recommendation links must route videos by item.type')
  requireMatch(search, /label:\s*'Location',\s*q:\s*'director'/, 'search filter Directors must become Location')
}

const forbiddenMetadata = [
  { name: 'rating', pattern: /\b(?:imdb(?:_rating)?|rating|ratings|age[_-]?rating|content[_-]?rating|maturity[_-]?rating)\b/i },
  { name: 'age label', pattern: /(?:>|\{|\s)NR(?:<|\}|\s|$)/i },
  { name: 'language metadata', pattern: /\b(?:audio[_-]?language|language[_-]?(?:name|id|code)|item\.language|movie\.language|show\.language|video\.language)\b/i },
]
function metadataViolations(text) {
  return forbiddenMetadata.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name)
}
function metadataGate() {
  const positiveControl = '<span>{movie.rating} IMDb · NR · {movie.language}</span>'
  const control = metadataViolations(positiveControl)
  if (!control.includes('rating') || !control.includes('age label') || !control.includes('language metadata')) {
    throw new Error('metadata positive control was not rejected')
  }
  for (const [name, path] of Object.entries(owned)) {
    if (!path.endsWith('.tsx')) continue
    const violations = metadataViolations(source[name])
    if (violations.length) throw new Error(`${path} exposes forbidden metadata: ${violations.join(', ')}`)
  }
  rejectMatch(source.styles, /\.p-rating\s*\{/, 'obsolete public rating presentation remains')
}

function motionGate() {
  const text = source.poster
  requireMatch(text, /PREVIEW_DELAY_MS\s*=\s*3000/, 'hero preview delay must be 3 seconds')
  requireMatch(text, /ADVANCE_DELAY_MS\s*=\s*8000/, 'hero advance delay must be 8 seconds')
  requireMatch(text, /previewTimer\s*=\s*setTimeout\(\(\)\s*=>\s*setPreview\(true\),\s*PREVIEW_DELAY_MS\)/, 'preview must be scheduled with the 3 second delay')
  requireMatch(text, /advanceTimer\s*=\s*setTimeout\([\s\S]*?ADVANCE_DELAY_MS\)/, 'next slide must be scheduled with the 8 second delay')
  requireMatch(text, /autoPlay[\s\S]{0,100}muted[\s\S]{0,100}playsInline/, 'direct hero media must autoplay muted and inline')
  requireMatch(text, /autoplay=1&mute=1/, 'YouTube previews must autoplay muted')
  requireMatch(text, /playsinline=1/, 'YouTube previews must play inline')
  requireMatch(text, /prefers-reduced-motion:\s*reduce/, 'reduced motion must be detected')
  requireMatch(text, /if \(!canAutoplay\)[\s\S]{0,160}return/, 'reduced motion must disable automatic scheduling')
  requireMatch(text, /document\.hidden/, 'document visibility must be checked')
  requireMatch(text, /visibilitychange/, 'visibility changes must be observed')
  requireMatch(text, /clearTimeout\(previewTimer\)/, 'preview timer must be cleaned up')
  requireMatch(text, /clearTimeout\(advanceTimer\)/, 'advance timer must be cleaned up')
  requireMatch(text, /\.pause\(\)/, 'preview media must be paused during cleanup')
  requireMatch(text, /data-hero-slide=\{idx\}/, 'stable hero slide test attribute is missing')
  requireMatch(text, /data-preview-state=\{previewState\}/, 'stable preview state test attribute is missing')
  requireMatch(text, /setCycle\(\(value\)\s*=>\s*value\s*\+\s*1\)/, 'manual controls must reset the timing cycle')
  requireMatch(text, /createPortal/, 'hover preview must escape clipping ancestors')
  requireMatch(text, /videoTimer[\s\S]*3000|3000[\s\S]*videoTimer/, 'hover preview video must wait for a 3 second dwell')
  requireMatch(source.home, /bunnyLibraryId=\{data\.bunnyLibraryId\}/, 'home must provide the Bunny library to the hero')
  requireMatch(text, /item\?\.bunny_trailer_url/, 'hero source mapping must include Bunny trailer URLs')
  requireMatch(text, /item\?\.video_url_input/, 'hero source mapping must include configured direct video URLs')
  requireMatch(text, /hero\?\.bunny_video_url/, 'hero source mapping must include Bunny video IDs')
  requireMatch(text, /encodeURIComponent\(libraryId\)[\s\S]*encodeURIComponent\(videoId\)/, 'Bunny library and video IDs must form a safe embed path')
  requireMatch(text, /iframe\.mediadelivery\.net\/embed/, 'Bunny preview must use the iframe player')
  requireMatch(text, /autoplay=true&muted=true&playsinline=true&loop=true&controls=false/, 'Bunny preview must be muted, inline, looping, and free of controls')
  requireMatch(text, /kind:\s*'bunny'/, 'Bunny media must have a distinct source kind')
  requireMatch(text, /preview\s*&&\s*media\s*\?\s*media\.kind/, 'Bunny source kind must flow into data-preview-state')
}

function responsiveGate() {
  const { poster, styles } = source
  requireMatch(poster, /getBoundingClientRect\(\)/, 'preview position must be based on its host rectangle')
  requireMatch(poster, /Math\.min\(window\.innerWidth\s*-\s*width\s*-\s*VIEWPORT_GUTTER/, 'preview horizontal position must be clamped to viewport')
  requireMatch(poster, /window\.innerHeight/, 'preview vertical placement must account for viewport height')
  requireMatch(poster, /addEventListener\('scroll'/, 'preview must hide on scroll')
  requireMatch(poster, /addEventListener\('resize'/, 'preview must hide on resize')
  requireMatch(poster, /\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/, 'touch devices must not open hover previews')
  requireMatch(styles, /\.pv-card\s*\{[^}]*position:\s*fixed/s, 'preview must use viewport-fixed positioning')
  requireMatch(styles, /\.pv-card\s*\{[^}]*z-index:\s*120/s, 'preview needs an adequate stacking level')
  requireMatch(styles, /\.pv-card\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*24px\)/s, 'preview must not exceed viewport height')
  requireMatch(styles, /overflow-x:\s*(?:hidden|clip)/, 'global horizontal overflow protection is missing')
  requireMatch(styles, /\.hero-title\s*\{[^}]*font-size:\s*clamp\(28px,[^}]*42px\)/s, 'hero type must retain a responsive capped size')
  requireMatch(styles, /@media\s*\(max-width:\s*420px\)/, 'a narrow-phone responsive pass is required')
  requireMatch(styles, /@media\s*\(max-width:\s*860px\)[\s\S]*?body\s*\{[^}]*padding-bottom:\s*calc\(/s, 'body must clear the mobile dock')
  requireMatch(styles, /\.mobile-dock\s*\{[^}]*bottom:\s*calc\([^}]*safe-area-inset-bottom/s, 'dock must account for device safe area')
  requireMatch(styles, /\.site-footer\s*\{[^}]*margin-bottom:/s, 'footer must clear the mobile dock')
  requireMatch(styles, /\.about-people\s*\{[^}]*minmax\(min\(140px,\s*100%\),\s*1fr\)/s, 'About cards must retain readable minimum tracks')
  requireMatch(styles, /\.about-people \.c-circle\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*visible/s, 'About cards must not shrink or clip their contents')
  requireMatch(styles, /\.about-people \.c-circle \.c-name\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s, 'About names must wrap naturally without overflowing')
  for (const selector of ['detail-info', 'detail-tabs', 'bible-grid', 'notes-panel', 'search-cols']) {
    requireMatch(styles, new RegExp(`\\.${selector}[^{]*\\{[^}]*(?:min-width:\\s*0|max-width:\\s*100%|grid-template-columns)`, 's'), `${selector} needs overflow-safe sizing`)
  }
}

const mode = process.argv[2]
const gates = {
  '--header': ['INTERFACE_HEADER_OK', headerGate],
  '--details': ['INTERFACE_DETAILS_OK', detailsGate],
  '--metadata': ['INTERFACE_METADATA_OK', metadataGate],
  '--motion': ['INTERFACE_MOTION_OK', motionGate],
  '--responsive': ['INTERFACE_RESPONSIVE_OK', responsiveGate],
}
if (!mode || !(mode in gates)) {
  console.error('Usage: node scripts/gate-interface-static.mjs --header|--details|--metadata|--motion|--responsive')
  process.exit(2)
}
try {
  const [token, check] = gates[mode]
  check()
  console.log(token)
} catch (error) {
  console.error(`${mode} failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
