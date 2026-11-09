import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Exercise the compiled artifact: source-only checks missed this minification bug.
const files = process.argv[2] ? [process.argv[2]] : readdirSync('dist/client/assets')
  .filter((file) => file.endsWith('.css')).map((file) => join('dist/client/assets', file))
const css = files.map((file) => readFileSync(file, 'utf8')).join('\n')
const rule = css.match(/\.site-header,\.site-header\.on-hero,\.site-header\.scrolled,\.site-header\.on-hero\.scrolled\{([^}]+)\}/)?.[1]
assert.ok(rule, 'The shared header reset must survive the production build')
for (const property of ['backdrop-filter', '-webkit-backdrop-filter']) {
  assert.match(rule, new RegExp(`(?:^|;)${property}:none(?:;|$)`), `${property}:none must survive minification`)
}
console.log('PASS: production header resets both standard and WebKit backdrop filters')
