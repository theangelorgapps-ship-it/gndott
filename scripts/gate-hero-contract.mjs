import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/Poster.tsx', 'utf8')
const mode = process.argv[2]
const requireMatch = (pattern, message) => assert.match(source, pattern, message)

function startGate() {
  requireMatch(/HERO_START_SECONDS\s*=\s*80/, 'one 80-second hero start contract is required')
  requireMatch(/startSeconds=\{HERO_START_SECONDS\}/, 'the hero slide must feed the shared start offset to the preview')
  assert.ok(!/startSeconds=\{\d+\}/.test(source), 'the hero slide must not hard-code a numeric start offset')
  const preview = readFileSync('src/components/TitlePreview.tsx', 'utf8')
  assert.match(preview, /start=\$\{Math\.max\(0, Math\.round\(startSeconds\)\)\}/, 'YouTube embed must use the shared start offset')
  assert.match(preview, /[?&]t=\$\{startSeconds\}/, 'Bunny embed must use the shared start offset')
  assert.match(preview, /start: dedicatedDirect \? 0 : startSeconds/, 'direct video must seek to the shared start offset (dedicated trailers play from 0)')
  assert.ok(!/start=80/.test(source + preview), 'YouTube must not hard-code a second start contract')
  assert.ok(!/[?&]t=80/.test(source + preview), 'Bunny must not hard-code a second start contract')
  console.log('HERO_START_OK')
}

function soundGate() {
  // Sound lives in TitlePreview now: embeds are controlled via the player
  // bridge / YouTube postMessage, so no iframe reload on toggle.
  const preview = readFileSync('src/components/TitlePreview.tsx', 'utf8')
  assert.match(preview, /useState\(true\)/, 'hero sound state must initially be muted')
  assert.match(preview, /setMuted\(true\)/, 'slide changes must reset sound to muted')
  assert.match(preview, /aria-label=\{muted\s*\?\s*'Enable preview sound'\s*:\s*'Mute preview sound'\}/, 'sound button needs dynamic accessible labeling')
  assert.match(preview, /aria-pressed=\{!muted\}/, 'sound button must expose pressed sound state')
  assert.match(preview, /className="tv-detail-utility"/, 'sound control needs its contracted style hook')
  assert.match(preview, /onClick=\{sound\}/, 'sound control must change state from a user gesture')
  assert.match(preview, /bridgeRef\.current\.mute\(!muted\)/, 'Bunny sound must toggle through the player bridge')
  assert.match(preview, /youtubeCommand\(muted \? 'unMute' : 'mute'\)/, 'YouTube sound must toggle through postMessage commands')
  assert.match(preview, /void directRef\.current\.sound\(muted\)/, 'direct video sound must toggle through the playback controller')
  assert.ok(!/key=\{.*muted/.test(preview), 'sound changes must not reload the embed')
  console.log('HERO_SOUND_OK')
}

function timingGate() {
  const playback = readFileSync('src/components/previewPlayback.ts', 'utf8')
  assert.match(playback, /HERO_PREVIEW_DELAY_MS\s*=\s*1200/, '1200ms preview delay must remain')
  assert.match(playback, /clock\.set\(\(\) => \{ if \(!cancelled\) start\(\) \}, HERO_PREVIEW_DELAY_MS\)/, 'preview delay must remain connected')
  assert.match(playback, /clock\.clear\(timer\)/, 'preview delay cleanup must remain')
  requireMatch(/ADVANCE_DELAY_MS\s*=\s*8000/, '8-second advance delay must remain')
  requireMatch(/advanceTimer\s*=\s*slides\.length > 1 \? setTimeout\([\s\S]*?ADVANCE_DELAY_MS\)/, 'advance timer must remain connected')
  requireMatch(/clearTimeout\(advanceTimer\)/, 'advance timer cleanup must remain')
  const preview = readFileSync('src/components/TitlePreview.tsx', 'utf8')
  assert.match(preview, /prefers-reduced-motion:\s*reduce/, 'reduced motion must remain detected')
  assert.match(preview, /!reduced\.matches/, 'reduced motion must disable automatic scheduling')
  assert.match(preview, /document\.hidden/, 'document visibility must remain checked')
  assert.match(preview, /visibilitychange/, 'visibility changes must remain observed')
  assert.match(preview, /bridgeRef\.current\?\.pause\(\)/, 'media pause cleanup must remain')
  assert.match(preview, /data-preview-state=\{/, 'preview state instrumentation must remain')
  console.log('HERO_TIMING_OK')
}

const gates = { '--start': startGate, '--sound': soundGate, '--timing': timingGate }
assert.ok(mode && gates[mode], 'Usage: node scripts/gate-hero-contract.mjs --start|--sound|--timing')
gates[mode]()
