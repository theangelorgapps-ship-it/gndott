import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/Poster.tsx', 'utf8')
const mode = process.argv[2]
const requireMatch = (pattern, message) => assert.match(source, pattern, message)

function startGate() {
  requireMatch(/HERO_START_SECONDS\s*=\s*80/, 'one 80-second hero start contract is required')
  requireMatch(/start=\$\{HERO_START_SECONDS\}/, 'YouTube embed must use the shared start offset')
  requireMatch(/[?&]t=\$\{HERO_START_SECONDS\}/, 'Bunny embed must use the shared start offset')
  requireMatch(/onLoadedMetadata=/, 'direct video must seek after metadata is available')
  requireMatch(/currentTime\s*=\s*HERO_START_SECONDS/, 'direct video must seek to the shared start offset')
  assert.ok(!/start=80/.test(source), 'YouTube must not hard-code a second start contract')
  assert.ok(!/[?&]t=80/.test(source), 'Bunny must not hard-code a second start contract')
  console.log('HERO_START_OK')
}

function soundGate() {
  requireMatch(/useState\(true\)/, 'hero sound state must initially be muted')
  requireMatch(/setMuted\(true\)/, 'slide changes must reset sound to muted')
  requireMatch(/aria-label=\{muted\s*\?\s*'Unmute hero preview'\s*:\s*'Mute hero preview'\}/, 'sound button needs dynamic accessible labeling')
  requireMatch(/aria-pressed=\{!muted\}/, 'sound button must expose pressed sound state')
  requireMatch(/className="hero-sound-toggle"/, 'sound control needs its contracted style hook')
  requireMatch(/onClick=\{\(\)\s*=>\s*setMuted\(/, 'sound control must change state from a user gesture')
  requireMatch(/mute=\$\{muted\s*\?\s*1\s*:\s*0\}/, 'YouTube URL must reflect sound state')
  requireMatch(/muted=\$\{muted\}/, 'Bunny URL must reflect sound state')
  requireMatch(/key=\{`\$\{hero\.id\}-\$\{media\.kind\}-\$\{media\.url\}`\}/, 'iframe sound changes must reload the embed')
  requireMatch(/muted=\{muted\}/, 'direct video muted property must reflect sound state')
  console.log('HERO_SOUND_OK')
}

function timingGate() {
  requireMatch(/PREVIEW_DELAY_MS\s*=\s*3000/, '3-second preview delay must remain')
  requireMatch(/ADVANCE_DELAY_MS\s*=\s*8000/, '8-second advance delay must remain')
  requireMatch(/previewTimer\s*=\s*setTimeout\(\(\)\s*=>\s*setPreview\(true\),\s*PREVIEW_DELAY_MS\)/, 'preview timer must remain connected')
  requireMatch(/advanceTimer\s*=\s*setTimeout\([\s\S]*?ADVANCE_DELAY_MS\)/, 'advance timer must remain connected')
  requireMatch(/prefers-reduced-motion:\s*reduce/, 'reduced motion must remain detected')
  requireMatch(/if \(!canAutoplay\)[\s\S]{0,160}return/, 'reduced motion must disable automatic scheduling')
  requireMatch(/document\.hidden/, 'document visibility must remain checked')
  requireMatch(/visibilitychange/, 'visibility changes must remain observed')
  requireMatch(/clearTimeout\(previewTimer\)/, 'preview timer cleanup must remain')
  requireMatch(/clearTimeout\(advanceTimer\)/, 'advance timer cleanup must remain')
  requireMatch(/\.pause\(\)/, 'media pause cleanup must remain')
  requireMatch(/data-preview-state=\{previewState\}/, 'preview state instrumentation must remain')
  console.log('HERO_TIMING_OK')
}

const gates = { '--start': startGate, '--sound': soundGate, '--timing': timingGate }
assert.ok(mode && gates[mode], 'Usage: node scripts/gate-hero-contract.mjs --start|--sound|--timing')
gates[mode]()
