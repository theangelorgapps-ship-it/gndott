import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function run(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${script} ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
}
function assert(value, message) {
  if (!value) throw new Error(message)
}
function tsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : []
  })
}

run('scripts/leaf-metadata.mjs')
run('scripts/leaf-metadata.mjs', '--preserve')
run('scripts/leaf-search.mjs', '--header')
run('scripts/leaf-search.mjs', '--spotlight')
run('scripts/leaf-search.mjs', '--responsive')

const publicSources = tsxFiles('src').map((file) => ({ file, source: readFileSync(file, 'utf8') }))
for (const { file, source } of publicSources) {
  assert(!/\bIMDb\b|\bimdb_rating\b|\bIMDb_rating\b|\bIconStar\b|\bIconGlobe\b|\bratingOf\b|\bcontent_rating\b/.test(source), `${file}: forbidden rating/language rendering reference remains`)
  assert(!/%\s*Match|Popular Language|className="(?:p-rating|pv-match|crating|cs-lang|stars|star-input)/.test(source), `${file}: forbidden visible metadata UI remains`)
}
const forbiddenControl = '<span className="p-rating"><IconStar /> 8.5 (IMDb)</span>'
assert(/\bIMDb\b|\bIconStar\b/.test(forbiddenControl), 'global forbidden-token positive control failed')

const root = readFileSync('src/routes/__root.tsx', 'utf8')
const spotlight = readFileSync('src/components/ui/apple-spotlight.tsx', 'utf8')
assert(root.includes('<AppleSpotlight isOpen={spotlightOpen}'), 'root no longer opens the redesigned Spotlight')
assert(spotlight.includes('r.teachings') || spotlight.includes('response.teachings'), 'Teachings live results missing')
assert(spotlight.includes("link: '/movies'") && spotlight.includes("link: '/tv-shows'") && spotlight.includes("link: '/teachings'"), 'catalogue shortcuts incomplete')

const tree = readFileSync('src/routeTree.gen.ts', 'utf8')
for (const route of ['/movies', '/tv-shows', '/teachings', '/videos', '/coming-soon', '/movie/$id', '/tv-show/$id', '/teaching/$id', '/video/$id', '/page/$slug']) {
  assert(tree.includes(`'${route}'`) || tree.includes(`\"${route}\"`), `existing route missing: ${route}`)
}

console.log('METADATA_SEARCH_STATIC_OK')
