import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
const executableCode = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

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
  const to = from < 0 ? -1 : source.indexOf(end, from + start.length)
  assert(from >= 0 && to > from, `${label}: could not isolate source section`)
  return source.slice(from, to)
}

function proveAbsenceChecks() {
  let rejected = false
  try {
    excludes('Downloads lang-pill', /Downloads|lang-pill/, 'absence positive control')
  } catch {
    rejected = true
  }
  assert(rejected, 'Forbidden-absence assertions must reject present forbidden code')
}

function checkHeader() {
  const source = executableCode(read('src/routes/__root.tsx'))
  const styles = executableCode(read('src/styles.css'))
  const header = between(source, '<header className={`', '</header>', 'site header')

  excludes(source, /function\s+IconDownload\b/, 'unused header download icon')
  excludes(header, /\bIconDownload\b|aria-label="Downloads"|className="icon-btn-dark"/, 'header Downloads control')
  excludes(header, /className="lang-pill"|EN\s*<IconChevronDown|viewBox="0 0 20 14"/, 'header language selector')
  excludes(styles, /\.icon-btn-dark\b|\.lang-pill\b/, 'unused header control styles')

  includes(header, 'aria-label="Search"', 'preserved search action')
  includes(header, 'aria-haspopup="dialog"', 'search dialog relationship')
  includes(header, 'aria-controls="catalogue-search-dialog"', 'search dialog control')
  includes(header, 'aria-expanded={spotlightOpen}', 'search expanded state')
  includes(header, 'onClick={() => setSpotlightOpen(true)}', 'search open interaction')
  includes(header, "onClick={() => navigate({ to: '/subscription-plan' })}", 'preserved subscription action')
  includes(header, '<Link to="/account-setting"', 'preserved account action')
  includes(header, "onClick={() => navigate({ to: '/login' })}", 'preserved login action')
  includes(header, 'aria-label="Notifications"', 'preserved notifications action')

  for (const destination of ['/movies', '/tv-shows', '/teachings', '/videos', '/coming-soon', '/live-tv']) {
    includes(header, `to="${destination}"`, `preserved navigation ${destination}`)
  }
  includes(source, '<h4>Download Our App</h4>', 'unrelated footer app downloads')
  includes(source, 'best sermons, shows and teachings!', 'unrelated footer app copy')

  proveAbsenceChecks()
  console.log('HEADER_LEAF_OK')
}

function checkSpotlight() {
  const source = executableCode(read('src/components/ui/apple-spotlight.tsx'))

  includes(source, 'role="dialog"', 'modal dialog semantics')
  includes(source, 'aria-modal="true"', 'modal dialog semantics')
  includes(source, 'aria-labelledby={titleId}', 'accessible dialog name')
  includes(source, 'aria-describedby={descriptionId}', 'accessible dialog description')
  includes(source, 'Search the catalogue', 'catalogue title')
  includes(source, 'Find Sermons, Shows and Teachings, or browse Live TV and Coming Soon.', 'catalogue subtitle')
  includes(source, 'aria-label="Close catalogue search"', 'labelled close button')
  includes(source, 'onClick={() => closeRef.current()}', 'working close button')
  includes(source, "event.key === 'Escape'", 'Escape close')
  includes(source, 'event.target === event.currentTarget', 'backdrop-only close')
  includes(source, 'window.requestAnimationFrame(() => {', 'deferred open focus')
  includes(source, 'inputRef.current?.focus({ preventScroll: true })', 'reliable input autofocus')

  includes(source, 'role="combobox"', 'combobox semantics')
  includes(source, 'aria-label="Search Sermons, Shows and Teachings"', 'accessible search name')
  includes(source, 'aria-autocomplete="list"', 'autocomplete semantics')
  includes(source, 'aria-activedescendant={activeResult ? `${instanceId}-result-${activeIndex}` : undefined}', 'active descendant')
  includes(source, 'onChange={(event) => setQuery(event.target.value)}', 'live query input')
  includes(source, 'onKeyDown={onSearchKeyDown}', 'input keyboard handler')

  const shortcuts = between(source, 'const SITE_SHORTCUTS', 'const RESULT_ICONS', 'category shortcut definitions')
  for (const [label, link] of [
    ['Sermons', '/movies'],
    ['Shows', '/tv-shows'],
    ['Teachings', '/teachings'],
    ['Live TV', '/live-tv'],
    ['Coming Soon', '/coming-soon'],
  ]) {
    matches(shortcuts, new RegExp(`label: '${label}', icon: \\w+, link: '${link}'`), `${label} shortcut`)
  }
  includes(source, '{shortcuts.map((shortcut) => {', 'persistent shortcut rendering')
  includes(source, '<span>{shortcut.label}</span>', 'visible shortcut labels')
  includes(source, 'onClick={() => go(shortcut.link)}', 'shortcut navigation')
  excludes(source, /hoveredShortcut|SVGFilter|url\(#blob\)|setHovered\(/, 'old hover-only experiment')

  includes(source, 'await searchContent({ data: searchTerm })', 'live searchContent request')
  for (const collection of ['movies', 'tvshows', 'teachings', 'channels']) {
    includes(source, `response.${collection}`, `live ${collection} mapping`)
  }
  for (const route of ['/movie/${movie.id}', '/tv-show/${show.id}', '/teaching/${teaching.id}', '/channel/${channel.id}']) {
    includes(source, `link: \`${route}\``, `result route ${route}`)
  }
  matches(source, /const go = \(link: string\) => \{\s*closeRef\.current\(\)\s*navigate\(\{ to: link as any \}\)/, 'results and shortcuts navigate then close')
  includes(source, 'let cancelled = false', 'stale response protection')
  includes(source, 'cancelled = true', 'request cleanup')

  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']) {
    includes(source, `event.key === '${key}'`, `${key} result navigation`)
  }
  includes(source, 'role="listbox"', 'result listbox semantics')
  includes(source, 'role="option"', 'result option semantics')
  includes(source, 'aria-selected={isActive}', 'active result semantics')
  includes(source, 'onMouseEnter={() => setActiveIndex(index)}', 'pointer result selection')
  includes(source, 'onClick={() => go(result.link)}', 'result activation')
  includes(source, "scrollIntoView({ block: 'nearest' })", 'active result visibility')

  includes(source, "setStatus('loading')", 'loading state')
  includes(source, 'Searching Sermons, Shows and Teachings…', 'friendly loading copy')
  includes(source, 'No catalogue titles match', 'friendly empty copy')
  includes(source, 'Search is unavailable right now.', 'friendly error copy')
  includes(source, "setStatus('error')", 'error state')
  includes(source, "setQuery('')", 'transient query reset')
  includes(source, 'setActiveIndex(-1)', 'transient active result reset')
  includes(source, "document.body.style.overflow = 'hidden'", 'body scroll lock')
  includes(source, 'document.body.style.overflow = previousOverflow', 'body scroll restoration')
  includes(source, 'previousFocus.focus({ preventScroll: true })', 'trigger focus restoration')
  includes(source, 'FOCUSABLE_SELECTOR', 'dialog focus containment')

  proveAbsenceChecks()
  console.log('SPOTLIGHT_LEAF_OK')
}

function checkResponsive() {
  const styles = executableCode(read('src/styles.css'))
  const source = executableCode(read('src/components/ui/apple-spotlight.tsx'))

  for (const selector of [
    '.spotlight-backdrop',
    '.spotlight-panel',
    '.spotlight-search-input',
    '.spotlight-shortcuts',
    '.spotlight-shortcut',
    ".spotlight-result[aria-selected='true']",
    '.spotlight-panel button:focus-visible',
    '.spotlight-panel input:focus-visible',
  ]) {
    includes(styles, selector, `spotlight styling ${selector}`)
  }
  includes(styles, 'max-width: 760px', 'bounded desktop dialog')
  includes(styles, 'max-height: calc(100dvh - 48px)', 'viewport-safe desktop dialog')
  includes(styles, 'max-height: calc(100dvh - 24px)', 'viewport-safe mobile dialog')
  includes(styles, 'grid-template-columns: repeat(5, minmax(0, 1fr))', 'desktop category grid')
  includes(styles, 'grid-template-columns: repeat(3, minmax(0, 1fr))', 'compact mobile category grid')
  includes(styles, '@media (max-width: 600px)', 'mobile breakpoint')
  includes(styles, '@media (max-width: 360px)', 'narrow mobile breakpoint')
  includes(styles, '.spotlight-footer { display: none; }', 'compact mobile keyboard footer')
  includes(styles, 'min-width: 0', 'overflow-safe flexible content')
  includes(styles, 'overflow-y: auto', 'scrollable small-height content')
  includes(styles, 'font-size: 16px', 'mobile input zoom prevention')
  includes(styles, 'color: #a9b9cc; opacity: 1;', 'high-contrast placeholder')
  includes(styles, 'outline: 2px solid #93c5fd', 'visible keyboard focus')
  includes(styles, 'background: rgba(37, 99, 235, 0.2)', 'visible active result')
  includes(styles, '@media (prefers-reduced-motion: reduce)', 'reduced-motion styles')
  includes(styles, 'animation: none !important', 'reduced-motion animation handling')
  includes(styles, 'transition: none !important', 'reduced-motion transition handling')

  includes(source, 'useReducedMotion', 'motion preference integration')
  includes(source, 'duration: reduceMotion ? 0 : 0.16', 'reduced-motion backdrop')
  includes(source, 'duration: reduceMotion ? 0 : 0.2', 'reduced-motion dialog')
  includes(source, "reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.985 }", 'purposeful dialog motion')

  proveAbsenceChecks()
  console.log('SPOTLIGHT_RESPONSIVE_OK')
}

try {
  const mode = process.argv[2]
  assert(process.argv.length === 3, 'Usage: node scripts/leaf-search.mjs --header|--spotlight|--responsive')
  if (mode === '--header') checkHeader()
  else if (mode === '--spotlight') checkSpotlight()
  else if (mode === '--responsive') checkResponsive()
  else assert(false, `Unknown argument: ${mode}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
