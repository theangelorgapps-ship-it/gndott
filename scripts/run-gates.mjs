#!/usr/bin/env node
// Runs every green offline gate in sequence; stops at the first failure.
// These execute production code offline — no network, DB, or credentials.
// gate-auth and gate-viewer are intentionally absent: they test the retired
// legacy cookie-session architecture; gate-better-auth covers the live stack.
import { spawnSync } from 'node:child_process'

const gates = [
  ['scripts/gate-nov08-security.mjs'],
  ['scripts/gate-better-auth.mjs'],
  ['scripts/gate-subscription-checkout.mjs'],
  ['scripts/gate-hero-contract.mjs', '--start'],
  ['scripts/gate-hero-contract.mjs', '--sound'],
  ['scripts/gate-hero-contract.mjs', '--timing'],
  ['scripts/gate-release2-entitlement.mjs'],
  ['scripts/gate-playback-data.mjs'],
]

let passed = 0
for (const [file, ...args] of gates) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\nGATES_FAIL: ${file} ${args.join(' ')} (after ${passed} passing)`)
    process.exit(result.status ?? 1)
  }
  passed++
}
console.log(`\nALL_GATES_PASS: ${passed} gates green`)
