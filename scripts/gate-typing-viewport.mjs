import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const load = (path, imports = {}, globals = {}) => {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: name => imports[name], ...globals })
  return module.exports
}
const geometry = load('src/lib/keyboardViewport.ts')
const metrics = { height: 420, offsetTop: 18, scale: 1, baselineHeight: 844, editing: true, compact: true }
assert.equal(geometry.typingViewport(metrics).keyboard, true)
assert.equal(geometry.typingViewport(metrics).top, 18)
for (const changes of [{ height: 844 }, { height: 750 }, { scale: 1.3 }, { editing: false }, { compact: false }]) {
  assert.equal(geometry.typingViewport({ ...metrics, ...changes }).keyboard, false, JSON.stringify(changes))
}
assert.equal(geometry.caretScrollDelta(390, 412, 180, 400), 12)
assert.equal(geometry.caretScrollDelta(170, 192, 180, 400), -10)
assert.equal(geometry.caretScrollDelta(190, 212, 180, 400), 0)

class Events {
  events = new Map()
  addEventListener(name, fn) { const set = this.events.get(name) || new Set(); set.add(fn); this.events.set(name, set) }
  removeEventListener(name, fn) { this.events.get(name)?.delete(fn) }
  fire(name) { for (const fn of this.events.get(name) || []) fn() }
  count() { return [...this.events.values()].reduce((sum, set) => sum + set.size, 0) }
}
class Element extends Events {
  attrs = new Set()
  properties = new Map()
  style = { setProperty: (name, value) => this.properties.set(name, value), removeProperty: name => this.properties.delete(name) }
  parentElement = null
  isContentEditable = false
  scrollHeight = 100
  clientHeight = 100
  scrollTop = 0
  overflowY = 'visible'
  rect = { top: 0, bottom: 100, height: 100 }
  matches() { return false }
  getBoundingClientRect() { return this.rect }
  contains(node) { for (; node; node = node.parentElement) if (node === this) return true; return false }
  closest(selector) { return selector.includes('.tv-immersive-player') && root.contains(this) ? root : null }
  toggleAttribute(name, on) { if (on) this.attrs.add(name); else this.attrs.delete(name) }
  removeAttribute(name) { this.attrs.delete(name) }
}
const root = new Element(), panel = new Element(), input = new Element()
panel.parentElement = root; input.parentElement = panel; input.isContentEditable = true
panel.scrollHeight = 500; panel.clientHeight = 200; panel.overflowY = 'auto'; panel.rect = { top: 190, bottom: 410, height: 220 }
input.rect = { top: 200, bottom: 400, height: 200 }
const viewport = Object.assign(new Events(), { height: 844, offsetTop: 0, scale: 1 })
const compact = Object.assign(new Events(), { matches: true })
const document = Object.assign(new Events(), { activeElement: null })
const window = Object.assign(new Events(), { innerWidth: 390, innerHeight: 844, visualViewport: viewport, matchMedia: () => compact,
  getSelection: () => ({ rangeCount: 1, focusNode: input, focusOffset: 0, getRangeAt: () => ({ cloneRange: () => ({ setStart() {}, collapse() {}, getBoundingClientRect: () => ({ top: 415 - panel.scrollTop, bottom: 437 - panel.scrollTop, height: 22 }) }) }) }),
  scrollBy() { assert.fail('Player typing must not scroll the underlying page') },
})
let id = 0
const frames = new Map()
const requestAnimationFrame = fn => { frames.set(++id, fn); return id }
const cancelAnimationFrame = id => frames.delete(id)
const flush = () => { let rounds = 0; while (frames.size) { assert.ok(++rounds < 10); const jobs = [...frames]; frames.clear(); for (const [, fn] of jobs) fn() } }
const hooks = load('src/hooks/useTypingViewport.ts', { react: {}, '../lib/keyboardViewport': geometry }, {
  window, document, HTMLElement: Element, getComputedStyle: el => ({ overflowY: el.overflowY }), requestAnimationFrame, cancelAnimationFrame,
})
const cleanup = hooks.observeTypingViewport(root)
flush()
assert.equal(root.attrs.has('data-keyboard-open'), false)
document.activeElement = input; root.fire('focusin'); viewport.height = 430; viewport.offsetTop = 8; viewport.fire('resize')
assert.equal(frames.size, 1, 'Focus and keyboard animation changes coalesce into one frame')
flush()
assert.equal(root.properties.get('--typing-viewport-height'), '430px')
assert.equal(root.properties.get('--typing-viewport-top'), '8px')
assert.equal(root.attrs.has('data-keyboard-open'), true)
assert.equal(panel.scrollTop, 35, 'Only the panel scrolls enough to expose the real selection caret')
// The editor's native selection head must win over an empty/wrong DOM Range.
let lineTop = 700
const unregisterCaret = hooks.registerTypingCaret(input, () => ({ top: lineTop - panel.scrollTop, bottom: lineTop + 24 - panel.scrollTop }))
root.fire('gndott:caret-update'); flush()
assert.equal(panel.scrollTop, 322, 'A new paragraph exposes the actual typed line, not the full editor bounds')
lineTop = 400; document.fire('selectionchange'); flush()
assert.equal(panel.scrollTop, 202, 'Moving the selection head upward reveals that line')
unregisterCaret()
viewport.height = 844; viewport.fire('resize'); flush()
assert.equal(root.attrs.has('data-keyboard-open'), false)
assert.equal(root.attrs.has('data-typing-active'), true, 'Focus contracts the layout before the software keyboard animation')
viewport.height = 210; viewport.fire('resize'); flush()
assert.equal(root.attrs.has('data-typing-short'), true, 'Short landscape keyboards reserve remaining space for typing')
viewport.scale = 1.5; viewport.fire('resize'); flush()
assert.equal(root.attrs.has('data-typing-active'), false, 'Pinch zoom does not activate a keyboard layout')
viewport.scale = 1; window.innerWidth = 844; window.innerHeight = viewport.height = 210; viewport.fire('resize'); flush()
assert.equal(root.attrs.has('data-keyboard-open'), true, 'Rotating with the keyboard open retains the compact layout')
document.activeElement = null; root.fire('focusout'); flush()
assert.equal(root.attrs.has('data-keyboard-open'), false)
root.fire('focusin'); assert.equal(frames.size, 1)
cleanup()
assert.equal(frames.size, 0)
for (const target of [root, document, window, viewport, compact]) assert.equal(target.count(), 0, 'All listeners removed on unmount')
assert.equal(root.properties.size, 0)
assert.equal(root.attrs.size, 0)
const nestedCleanup = hooks.observeTypingViewport(panel)
assert.equal(frames.size, 0, 'Nested Notes/chat defer to the player observer')
nestedCleanup()
window.visualViewport = undefined; window.innerHeight = 844; document.activeElement = null
const fallbackCleanup = hooks.observeTypingViewport(root); flush()
document.activeElement = input; window.innerHeight = 420; window.fire('resize'); flush()
assert.equal(root.attrs.has('data-keyboard-open'), true, 'Resize-only browsers retain the safe fallback')
fallbackCleanup()
console.log('TYPING_VIEWPORT_OK: phone resize, offset, rotation, zoom, selection-head coordinates, upward selection, pre-keyboard focus, short viewport, nested ownership, resize fallback and listener cleanup; physical OS keyboard remains a manual integration check')
