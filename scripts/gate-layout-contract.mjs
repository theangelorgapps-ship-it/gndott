import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const styles = readFileSync('src/styles.css', 'utf8')
const show = readFileSync('src/components/ShowDetail.tsx', 'utf8')
const movie = readFileSync('src/routes/movie.$id.tsx', 'utf8')
const video = readFileSync('src/routes/video.$id.tsx', 'utf8')
const mode = process.argv[2]
const requireMatch = (text, pattern, message) => assert.match(text, pattern, message)

function hasRedundantDetailAction(source) {
  const actions = source.match(/<div className="hero-actions">[\s\S]*?<\/div>/)?.[0] ?? ''
  return /Watch now|<IconPlay\s*\/>|\bPlay\s*</.test(actions)
}

function headerGate() {
  requireMatch(styles, /\.site-header\s*\{[^}]*position:\s*fixed/s, 'header must be fixed')
  requireMatch(styles, /\.site-header\s*\{[^}]*(?:inset:\s*12px\s+\d+px\s+auto|top:\s*12px)/s, 'header must float below the viewport edge')
  requireMatch(styles, /\.site-header\s*\{[^}]*border-radius:\s*\d+px/s, 'floating header must be rounded')
  requireMatch(styles, /\.site-header\s*\{[^}]*background:\s*rgba\([^)]*,\s*\.\d+\)/s, 'header must be translucent')
  requireMatch(styles, /\.site-header\s*\{[^}]*backdrop-filter:\s*blur\(/s, 'header must use backdrop blur')
  requireMatch(styles, /\.site-header\.scrolled[^}]*background:\s*rgba\(/s, 'scrolled header needs a darker translucent treatment')
  requireMatch(styles, /\.page-enter\s*\{\s*padding-top:\s*calc\(var\(--header-h\) \+ 24px\)/, 'non-hero pages need visual header height plus floating inset clearance')
  requireMatch(styles, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.page-enter\s*\{\s*padding-top:\s*calc\(var\(--header-h\) \+ 20px\)/, 'mobile non-hero pages need floating inset clearance')
  requireMatch(styles, /\.page-enter:has\(\.hero\)\s*\{\s*padding-top:\s*0/, 'hero page must not reserve header space')
  requireMatch(styles, /\.hero\s*\{[^}]*padding-top:\s*0/s, 'hero itself must not be displaced by header padding')
  requireMatch(styles, /\.hero-sound-toggle\s*\{[^}]*position:\s*absolute/s, 'sound control must be positioned over the hero')
  requireMatch(styles, /\.hero-sound-toggle\s*\{[^}]*pointer-events:\s*auto/s, 'sound control must be interactive')
  console.log('LAYOUT_HEADER_OK')
}

function actionsGate() {
  assert.equal(hasRedundantDetailAction('<div className="hero-actions"><button><IconPlay /> Watch now</button></div>'), true, 'positive control must reject Watch now')
  assert.equal(hasRedundantDetailAction('<div className="hero-actions"><button>Play</button></div>'), true, 'positive control must reject Play')
  assert.equal(hasRedundantDetailAction('<div className="hero-actions"><WatchlistButton /><button>Share</button></div>'), false, 'secondary actions must not trigger rejection')
  for (const [name, source] of [['movie', movie], ['video', video], ['show/teaching', show]]) {
    assert.equal(hasRedundantDetailAction(source), false, `${name} retains a redundant detail play action`)
    requireMatch(source, /<WatchSection/, `${name} actual playback must remain`)
    requireMatch(source, /aria-label="Share"/, `${name} Share action must remain`)
  }
  requireMatch(movie, /<WatchlistButton/, 'movie Watchlist action must remain')
  requireMatch(show, /<WatchlistButton/, 'show/teaching Watchlist action must remain')
  console.log('LAYOUT_ACTIONS_OK')
}

function episodesGate() {
  requireMatch(show, /className="season-selector-layout"/, 'episode panel needs the two-region layout')
  requireMatch(show, /className="season-summary"/, 'selected season summary must be present')
  requireMatch(show, /className="season-selector"/, 'right selector column must be present')
  requireMatch(show, /className="episode-list"/, 'episode rows need their own list container')
  requireMatch(show, /season-selector[\s\S]*season-pills[\s\S]*episode-list/, 'season pills and episode rows must be inside the right selector')
  requireMatch(styles, /\.season-selector-layout\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/s, 'desktop selector must use grid columns')
  requireMatch(styles, /\.season-summary\s*\{[^}]*min-width:\s*0/s, 'summary column must shrink safely')
  requireMatch(styles, /\.season-selector\s*\{[^}]*min-width:\s*0/s, 'selector column must shrink safely')
  requireMatch(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.season-selector-layout\s*\{[^}]*grid-template-columns:\s*(?:minmax\(0,\s*)?1fr/s, 'selector layout must stack on mobile')
  console.log('LAYOUT_EPISODES_OK')
}

const gates = { '--header': headerGate, '--actions': actionsGate, '--episodes': episodesGate }
assert.ok(mode && gates[mode], 'Usage: node scripts/gate-layout-contract.mjs --header|--actions|--episodes')
gates[mode]()
