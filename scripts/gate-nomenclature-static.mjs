import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function run(script, arg) {
  const result = spawnSync(process.execPath, [script, ...(arg ? [arg] : [])], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${script} failed: ${result.stderr || result.stdout}`)
}
function assert(value, message) {
  if (!value) throw new Error(message)
}

run('scripts/leaf-teaching.mjs')
run('scripts/leaf-labels.mjs')
run('scripts/leaf-labels.mjs', '--ratings')

const tree = readFileSync('src/routeTree.gen.ts', 'utf8')
assert(tree.includes("createFileRoute('/teachings')") || tree.includes("id: '/teachings'"), 'Teachings listing missing from generated route tree')
assert(tree.includes("createFileRoute('/teaching/$id')") || tree.includes("id: '/teaching/$id'"), 'Teaching detail missing from generated route tree')
assert(tree.includes("id: '/tv-shows'") && tree.includes("id: '/movies'"), 'Existing Sermons/Shows URLs were not preserved')

const videoDetail = readFileSync('src/routes/video.$id.tsx', 'utf8')
assert(!/IMDb|imdb|IconStar/.test(videoDetail), 'Video detail retains an IMDb reference')
const positiveControl = 'IMDb'
assert(/IMDb/.test(positiveControl), 'IMDb absence positive control failed')

console.log('NOMENCLATURE_STATIC_OK')
