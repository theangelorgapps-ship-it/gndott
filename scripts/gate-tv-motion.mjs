import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/components/Motion.tsx', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace('export function MotionRoot', 'function MotionRoot')
const listeners = new Map(), toggles = []
let cleanup, revealed = 0
const window = {
  scrollY: 0,
  addEventListener(name, callback, options) { assert.equal(name, 'scroll', 'No wheel or touch interception'); assert.equal(options.passive, true); listeners.set(name, callback) },
  removeEventListener(name) { listeners.delete(name) },
}
const document = {
  querySelector: () => ({ classList: { toggle: (name, active) => toggles.push([name, active]) } }),
  querySelectorAll: () => [{ classList: { add: () => revealed++ } }],
}
new Function('useEffect', 'window', 'document', `${js}; MotionRoot()`)(effect => { cleanup = effect() }, window, document)
assert.deepEqual(toggles.at(-1), ['scrolled', false])
window.scrollY = 300; listeners.get('scroll')()
assert.deepEqual(toggles.at(-1), ['scrolled', true])
window.scrollY = 0; listeners.get('scroll')()
assert.deepEqual(toggles.at(-1), ['scrolled', false])
assert.equal(revealed, 1)
cleanup(); assert.equal(listeners.size, 0)
console.log('TV_MOTION_OK: native wheel/touch scrolling, passive header updates, teardown')
