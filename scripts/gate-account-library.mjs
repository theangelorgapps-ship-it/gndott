import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const checks = [
  ['npx', ['tsc', '--noEmit']],
  ['node', ['scripts/gate-library.mjs']],
  ['node', ['scripts/gate-player.mjs']],
  ['node', ['scripts/gate-recommendation-v2.mjs']],
  ...['--groups', '--scoring', '--api'].map(mode => ['node', ['scripts/gate-recommendations.mjs', mode]]),
  ['node', ['scripts/gate-playback-data.mjs']],
  ['node', ['scripts/gate-viewer.mjs']],
]
for (const [command, args] of checks) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout: 120000 })
  if (result.error || result.status !== 0) {
    console.error(result.error || `${command} ${args.join(' ')} failed`)
    process.exit(1)
  }
}
const build = spawnSync('npm', ['run', 'build'], { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
writeFileSync('verification/library-build.log', (build.stdout || '') + (build.stderr || ''))
if (build.error || build.status !== 0) {
  console.error(build.error || build.stderr || build.stdout)
  process.exit(1)
}
console.log('HALOBOX_LIBRARY_RELEASE_OK')
