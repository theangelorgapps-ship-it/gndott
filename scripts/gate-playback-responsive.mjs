import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// These checks exercise the existing data/player contracts. Responsive geometry,
// material, editing and reveal behavior are inspected in the browser separately.
const cwd = fileURLToPath(new URL('../', import.meta.url))
const checks = [
  ['node', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['node', ['scripts/gate-library.mjs']],
  ['node', ['scripts/gate-tv-motion.mjs']],
  ['node', ['scripts/gate-halo.mjs', 'preview']],
  ['node', ['scripts/gate-player.mjs']],
  ['node', ['scripts/gate-recommendation-v2.mjs']],
  ['git', ['diff', '--check']],
]
for (const [command, args] of checks) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', timeout: 120000 })
  if (result.error || result.status !== 0) {
    console.error(result.error || `${command} ${args.join(' ')} failed`)
    process.exit(1)
  }
}
const build = spawnSync('npm', ['run', 'build'], { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
mkdirSync(new URL('../verification/', import.meta.url), { recursive: true })
writeFileSync(new URL('../verification/playback-build.log', import.meta.url), (build.stdout || '') + (build.stderr || ''))
if (build.error || build.status !== 0) {
  console.error(build.error || build.stderr || build.stdout)
  process.exit(1)
}
console.log('PLAYBACK_RESPONSIVE_OK')
