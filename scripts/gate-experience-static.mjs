import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function run(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  assert.equal(result.status, 0, `${script} ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`)
}

for (const mode of ['--header', '--details', '--metadata', '--motion', '--responsive']) {
  run('scripts/gate-interface-static.mjs', mode)
}
for (const mode of ['--scoring', '--groups', '--api']) {
  run('scripts/gate-recommendations.mjs', mode)
}
for (const mode of ['--start', '--sound', '--timing']) {
  run('scripts/gate-hero-contract.mjs', mode)
}
for (const mode of ['--header', '--actions', '--episodes']) {
  run('scripts/gate-layout-contract.mjs', mode)
}

const allowedChanges = new Set([
  'src/routes/__root.tsx',
  'src/routes/index.tsx',
  'src/routes/login.tsx',
  'src/routes/register.tsx',
  'src/routes/movie.$id.tsx',
  'src/routes/video.$id.tsx',
  'src/routes/search.tsx',
  'src/components/Poster.tsx',
  'src/components/Detail.tsx',
  'src/components/ShowDetail.tsx',
  'src/components/ui/apple-spotlight.tsx',
  'src/styles.css',
  'src/lib/api.ts',
  'src/lib/recommendations.ts',
  'public/goodnews-halobox-logo.jpg',
  'scripts/leaf-labels.mjs',
  'scripts/gate-interface-static.mjs',
  'scripts/gate-recommendations.mjs',
  'scripts/gate-experience-static.mjs',
  'scripts/gate-experience-local.py',
  'scripts/gate-experience-deployed.mjs',
  'scripts/gate-hero-contract.mjs',
  'scripts/gate-layout-contract.mjs',
  'scripts/gate-public-restoration.mjs',
  'wrangler.jsonc',
])
const changed = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .trimEnd().split('\n').filter(Boolean).map((line) => line.slice(3))
for (const path of changed) {
  assert.ok(allowedChanges.has(path), `Unexpected source or configuration change: ${path}`)
}

const tree = readFileSync('src/routeTree.gen.ts', 'utf8')
for (const route of [
  '/', '/movies', '/tv-shows', '/teachings', '/videos', '/live-tv', '/watchlist',
  '/coming-soon', '/movie/$id', '/tv-show/$id', '/teaching/$id', '/video/$id',
  '/page/$slug', '/login', '/account-setting', '/continue-watching',
]) {
  assert.ok(tree.includes(`'${route}'`) || tree.includes(`"${route}"`), `Required route missing: ${route}`)
}

const root = readFileSync('src/routes/__root.tsx', 'utf8')
const home = readFileSync('src/routes/index.tsx', 'utf8')
const spotlight = readFileSync('src/components/ui/apple-spotlight.tsx', 'utf8')
assert.ok(!/All Content|Coming Soon/i.test(`${root}\n${home}\n${spotlight}`), 'Retired public discovery label remains')
assert.ok(root.includes('getSessionUser') && root.includes('getFooterData'), 'Session and existing footer data must remain')
assert.ok(home.includes('getHomeAds'), 'Existing admin-managed home content loader must remain')

const wrangler = readFileSync('wrangler.jsonc', 'utf8')
assert.ok(wrangler.includes('"binding": "DB"') && wrangler.includes('"binding": "MEDIA"'))
assert.ok(wrangler.includes('"binding": "IMAGES"'), 'Additive Images binding must remain')
assert.ok(wrangler.includes('3bc8aa15-6d59-42be-93df-23397c737c56'), 'Exact D1 identifier must remain')
assert.ok(wrangler.includes('halobox-migrated-20261105') && wrangler.includes('halobox-migrated-media-20261105'))

const packageJson = readFileSync('package.json', 'utf8')
const baselinePackage = execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' })
assert.equal(packageJson, baselinePackage, 'Deployment scripts and dependencies must remain unchanged')

console.log('EXPERIENCE_STATIC_OK')
