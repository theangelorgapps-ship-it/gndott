import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const restorationBase = 'HEAD^'
const production = 'https://gndott.theangelorgapps.workers.dev'
const read = (path) => readFileSync(join(root, path), 'utf8')
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function gitRaw(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
}

function git(...args) {
  return gitRaw(...args).trim()
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`)
}

function runJson(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

function assertPublicBrand(source, label) {
  assert.ok(source.includes('GoodNews Halobox'), `${label}: GoodNews Halobox branding is missing`)
  assert.ok(!/Streamit/i.test(source), `${label}: legacy Streamit branding remains`)
}

function assertConfig(config) {
  assert.equal(config.name, 'gndott')
  assert.equal(config.compatibility_date, '2026-01-15')
  assert.deepEqual(config.compatibility_flags, ['nodejs_compat'])
  assert.equal(config.images?.binding, 'IMAGES')
  assert.equal(config.d1_databases?.length, 1)
  assert.equal(config.d1_databases[0].binding, 'DB')
  assert.equal(config.d1_databases[0].database_name, 'halobox-migrated-20261105')
  assert.equal(config.d1_databases[0].database_id, '3bc8aa15-6d59-42be-93df-23397c737c56')
  assert.equal(config.r2_buckets?.length, 1)
  assert.equal(config.r2_buckets[0].binding, 'MEDIA')
  assert.equal(config.r2_buckets[0].bucket_name, 'halobox-migrated-media-20261105')
}

function staticGate() {
  const rootRoute = read('src/routes/__root.tsx')
  for (const [path, source] of [
    ['src/routes/__root.tsx', rootRoute],
    ['src/routes/login.tsx', read('src/routes/login.tsx')],
    ['src/routes/register.tsx', read('src/routes/register.tsx')],
  ]) assertPublicBrand(source, path)

  assert.ok(rootRoute.includes("{ title: 'GoodNews Halobox: Sermons, Shows & Teachings' }"))
  assert.ok(rootRoute.includes('<span className="brand-word"><span>GoodNews</span><strong>Halobox</strong></span>'))
  assert.ok(rootRoute.includes('src="/goodnews-halobox-logo.jpg"'))
  assert.ok(rootRoute.includes('support@goodnewsworld.com'))
  assert.ok(!rootRoute.includes('hello@iqonic.design'))
  assert.match(read('src/styles.css'), /\.brand-word\s*\{[^}]*flex-direction:\s*column/s)
  assert.match(read('src/styles.css'), /\.brand-word strong\s*\{[^}]*font-size:\s*25px/s)
  const poster = read('src/components/Poster.tsx')
  assert.match(poster, /direct\s*&&\s*!hasBunnyFallback/, 'HLS heroes must prefer their existing Bunny source')
  assert.match(poster, /\\\.m3u8\(\?:\$\|\[\?\#\]\)\/i\.test\(direct\)/, 'Only HLS direct sources may use the Bunny fallback')

  const logo = readFileSync(join(root, 'public/goodnews-halobox-logo.jpg'))
  assert.ok(logo.length > 1000 && logo[0] === 0xff && logo[1] === 0xd8, 'Recovered logo must be a non-empty JPEG')

  const config = JSON.parse(read('wrangler.jsonc'))
  assertConfig(config)
  const badConfig = structuredClone(config)
  delete badConfig.images
  assert.throws(() => assertConfig(badConfig), 'Binding negative control must reject a missing Images binding')
  assert.throws(() => assertPublicBrand('<title>Streamit</title>', 'negative control'), 'Branding negative control must reject Streamit')

  for (const path of ['src/lib/api.ts', 'src/lib/db.ts', 'src/lib/session.server.ts', 'src/lib/recommendations.ts']) {
    assert.equal(read(path), gitRaw('show', `${restorationBase}:${path}`), `${path} must remain byte-for-byte unchanged`)
  }
  console.log('PUBLIC_BRANDING_STATIC_OK')
}

function staticSuitesGate() {
  run(process.execPath, ['scripts/gate-experience-static.mjs'])
  console.log('PUBLIC_STATIC_SUITES_OK')
}

function buildGate() {
  run(executable, ['tsc', '--noEmit'])
  run(npm, ['run', 'build'])
  console.log('PUBLIC_BUILD_OK')
}

async function deployedGate() {
  for (const path of ['/', '/login', '/register']) {
    const response = await fetch(`${production}${path}`, { cache: 'no-store' })
    assert.equal(response.status, 200, `${path} returned ${response.status}`)
    assertPublicBrand(await response.text(), `deployed ${path}`)
  }
  const logoResponse = await fetch(`${production}/goodnews-halobox-logo.jpg`, { cache: 'no-store' })
  assert.equal(logoResponse.status, 200, 'Deployed GoodNews logo is unavailable')
  assert.match(logoResponse.headers.get('content-type') ?? '', /^image\/jpeg/)
  assert.deepEqual(Buffer.from(await logoResponse.arrayBuffer()), readFileSync(join(root, 'public/goodnews-halobox-logo.jpg')))
  console.log('PUBLIC_BRANDING_DEPLOYED_OK')
}

function runtimeGate() {
  const deployments = runJson(executable, ['wrangler', 'deployments', 'list', '--json'])
  assert.ok(Array.isArray(deployments) && deployments.length > 0, 'No Worker deployments returned')
  const latest = [...deployments].sort((a, b) => a.created_on.localeCompare(b.created_on)).at(-1)
  const active = latest.versions?.find((version) => version.percentage === 100)
  assert.ok(active?.version_id, 'Latest deployment must route 100% traffic to one version')
  const version = runJson(executable, ['wrangler', 'versions', 'view', active.version_id, '--json'])
  const bindings = version.resources?.bindings ?? []
  const byName = new Map(bindings.map((binding) => [binding.name, binding]))
  assert.equal(byName.get('DB')?.type, 'd1')
  assert.equal(byName.get('DB')?.database_id, '3bc8aa15-6d59-42be-93df-23397c737c56')
  assert.equal(byName.get('MEDIA')?.type, 'r2_bucket')
  assert.equal(byName.get('MEDIA')?.bucket_name, 'halobox-migrated-media-20261105')
  assert.equal(byName.get('IMAGES')?.type, 'images')
  assert.equal(byName.get('SESSION_SECRET')?.type, 'secret_text')
  console.log(`PUBLIC_RUNTIME_BINDINGS_OK ${active.version_id}`)
}

function deliveryGate() {
  const allowed = [
    'public/goodnews-halobox-logo.jpg',
    'scripts/gate-experience-static.mjs',
    'scripts/gate-public-restoration.mjs',
    'scripts/leaf-labels.mjs',
    'src/components/Poster.tsx',
    'src/routes/__root.tsx',
    'src/routes/login.tsx',
    'src/routes/register.tsx',
    'src/styles.css',
    'wrangler.jsonc',
  ].sort()
  assert.equal(git('status', '--porcelain'), '', 'Worktree must be clean')
  assert.equal(git('rev-parse', 'HEAD'), git('rev-parse', 'origin/main'), 'HEAD must exactly match origin/main')
  const changed = git('diff', '--name-only', `${restorationBase}..HEAD`).split('\n').filter(Boolean).sort()
  assert.deepEqual(changed, allowed, 'Committed restoration must contain only the intended files')
  for (const path of ['src/lib/api.ts', 'src/lib/db.ts', 'src/lib/session.server.ts', 'src/lib/recommendations.ts']) {
    assert.equal(gitRaw('show', `HEAD:${path}`), gitRaw('show', `${restorationBase}:${path}`), `${path} differs from the Expo-safe baseline`)
  }
  console.log(`PUBLIC_DELIVERY_OK ${git('rev-parse', 'HEAD')}`)
}

const mode = process.argv[2]
if (mode === 'static') staticGate()
else if (mode === 'static-suites') staticSuitesGate()
else if (mode === 'build') buildGate()
else if (mode === 'deployed') await deployedGate()
else if (mode === 'runtime') runtimeGate()
else if (mode === 'delivery') deliveryGate()
else throw new Error('Usage: node scripts/gate-public-restoration.mjs static|static-suites|build|deployed|runtime|delivery')
