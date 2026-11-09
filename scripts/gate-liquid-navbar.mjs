// Exercise the supplied Waterline adaptation without a browser or GPU.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync('src/components/ui/liquid-glass-navbar.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
function load(react, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(source, { module, exports: module.exports, require: n => n === 'react' ? react : n.endsWith('.css') ? {} : require(n), console, ...globals })
  return module.exports.LiquidNavbar
}
const component = load(React)
const items = [{ label: 'Notes' }, { label: 'Bible' }, { label: 'Info' }, { label: 'Continue Watching', action: true }]
const html = renderToStaticMarkup(React.createElement('div', {}, React.createElement(component, { items, active: -1 }), React.createElement(component, { items, active: 1 })))
assert.equal((html.match(/role="group"/g) || []).length, 2)
assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
assert.equal((html.match(/aria-pressed=/g) || []).length, 6, 'Continue Watching is an action, not a toggle')
assert.equal((html.match(/Continue Watching/g) || []).length, 4, 'Mobile label and accessible name remain intact')
const ids = [...html.matchAll(/<filter id="([^"]+)"/g)].map(m => m[1])
assert.equal(new Set(ids).size, 2, 'Simultaneous players cannot share an SVG filter ID')

const states = [], refs = [], effects = [], layouts = [], events = new Map(), frames = new Map(), observerCleanups = []
let si = 0, ri = 0, frameId = 0, now = 0, observer, resized, reduceChanged, disposed = 0, draws = 0, lastBlobs
const gl = new Proxy({
  COMPILE_STATUS: 1, LINK_STATUS: 2,
  createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}),
  getShaderParameter: () => true, getProgramParameter: () => true, getAttribLocation: () => 0, getUniformLocation: (_, key) => key,
  uniform4fv: (key, data) => { if (key === 'uBlob') lastBlobs = [...data] },
  drawArrays: () => draws++, deleteBuffer: () => disposed++, deleteProgram: () => disposed++, deleteShader: () => disposed++,
}, { get(target, key) { return target[key] ?? (() => {}) } })
const canvasEvents = new Map()
const cv = { style: {}, getContext: () => gl, width: 0, height: 0, addEventListener: (n, f) => canvasEvents.set(n, f), removeEventListener: n => canvasEvents.delete(n) }
const document = { hidden: false, activeElement: null, addEventListener: (n, f) => events.set(n, f), removeEventListener: n => events.delete(n) }
const media = { matches: false, addEventListener: (_, f) => { reduceChanged = f }, removeEventListener: () => { reduceChanged = null } }
const react = { ...React,
  useState(value) { const i = si++; if (!(i in states)) states[i] = value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
  useRef(value) { const i = ri++; return refs[i] ??= { current: value } },
  useId: () => 'test-waterline', useEffect: f => effects.push(f), useLayoutEffect: f => layouts.push(f),
}
const Nav = load(react, { document, navigator: { userAgent: 'Chrome/130' }, window: { devicePixelRatio: 2, matchMedia: () => media },
  requestAnimationFrame: f => { const id = ++frameId; frames.set(id, f); return id }, cancelAnimationFrame: id => frames.delete(id),
  ResizeObserver: class { constructor(f) { resized = f } observe() {} disconnect() { observerCleanups.push('resize') } },
  IntersectionObserver: class { constructor(f) { observer = f } observe() {} disconnect() { observerCleanups.push('intersection') } },
})
const changes = [], props = { items, active: -1, onChange: index => changes.push(index) }
const render = () => { si = ri = 0; return Nav(props) }
const walk = t => !t || typeof t !== 'object' ? [] : Array.isArray(t) ? t.flatMap(walk) : [t, ...walk(t.props?.children)]
let tree = render()
const nav = { offsetWidth: 360, offsetHeight: 56 }
tree.props.ref.current = nav
walk(tree).find(n => n.type === 'canvas').props.ref.current = cv
walk(tree).find(n => n.props?.className === 'nimbus-drop').props.ref.current = { style: {} }
const elements = items.map((_, index) => ({ offsetLeft: 6 + index * 82, offsetTop: 6, offsetWidth: 82, offsetHeight: 44, focus() { document.activeElement = this } }))
walk(tree).filter(n => n.type === 'button').forEach((button, index) => button.props.ref(elements[index]))
const cleanup = effects[0]()
function pump(limit = 400) { let count = 0; while (frames.size && count++ < limit) { now += 1000/60; const batch = [...frames]; frames.clear(); batch.forEach(([, f]) => f(now)) } return count }
pump(); assert.equal(frames.size, 0, 'Idle glass stops scheduling animation frames');assert.ok(lastBlobs.every(v => v === 0), 'No panel means no active water lens')
props.active = 1; tree = render(); layouts.at(-1)(); pump(); assert.ok(lastBlobs[3] > 0, 'Active panel paints the lens')
const bible = walk(tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Bible')
bible.props.onClick(); bible.props.onClick(); assert.deepEqual(changes, [1, 1], 'Repeated active taps reach the parent so the panel can toggle')
let prevented = false; document.activeElement = elements[1]
tree.props.onKeyDown({ key: 'ArrowRight', preventDefault() { prevented = true }, stopPropagation() {} })
assert.ok(prevented);assert.equal(document.activeElement, elements[2]);assert.deepEqual(changes, [1, 1], 'Arrow keys move focus without changing the reading panel')
tree.props.onKeyDown({ key: 'Home', preventDefault() {}, stopPropagation() {} });assert.equal(document.activeElement, elements[0])
observer([{ isIntersecting: false }]);tree.props.onPointerDown({clientX:10,clientY:10,currentTarget:{getBoundingClientRect:()=>({left:0,top:0})}});assert.equal(frames.size,0,'Offscreen waves do not run')
observer([{ isIntersecting: true }]);pump();assert.ok(draws > 0)
media.matches = true;reduceChanged();props.active=2;tree=render();layouts.at(-1)();assert.equal(pump(),1,'Reduced motion settles in one frame')
canvasEvents.get('webglcontextlost')({preventDefault(){}});pump();assert.equal(disposed,4,'Lost context releases all GPU objects');assert.equal(states[1],false,'Context loss enables CSS fallback')
canvasEvents.get('webglcontextrestored')();pump();assert.equal(states[1],true)
nav.offsetWidth=320;resized();pump();assert.equal(cv.width,(320+28)*2)
document.hidden=true;events.get('visibilitychange')();assert.equal(frames.size,0)
cleanup();assert.equal(frames.size,0);assert.equal(events.size,0);assert.equal(canvasEvents.size,0);assert.equal(disposed,8);assert.equal(reduceChanged,null);assert.equal(observerCleanups.length,2)
console.log('LIQUID_NAVBAR_PASS: semantics, deselection, keyboard, unique filters, offscreen/reduced motion, GPU lifecycle')
