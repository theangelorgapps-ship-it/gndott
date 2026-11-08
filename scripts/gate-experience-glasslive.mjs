// Focused behavioral checks: execute the actual React components and geometry.
// API responses are isolated fixtures; this gate makes no network calls or writes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file, imports = {}, globals = {}) {
  const module = { exports: {} }
  const result = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
  assert.ok(!result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error), `Parse failed: ${file}`)
  vm.runInNewContext(result.outputText, { module, exports: module.exports, require: n => imports[n] ?? require(n), console, URL, crypto: webcrypto, setTimeout, clearTimeout, ...globals })
  return module.exports
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
const find = (tree, pred) => nodes(tree).find(pred)
const clickEvent = { currentTarget: { closest: () => ({ removeAttribute() {}, querySelector: () => ({ focus() {} }) }) } }
const messageButton = (tree, id, label) => button(find(tree, n => n.type === 'article' && n.key === String(id)), label)
const button = (tree, label) => find(tree, n => n.type === 'button' && n.props.children === label)
const flush = () => new Promise(resolve => setImmediate(resolve))
const fixture = (admin = false) => ({
  enabled: true, signedIn: true, canComment: true, isAdmin: admin, slowMode: 0, muted: false, commentReason: '', mutes: [], blocked: [],
  comments: [
    { id: 1, author_name: 'Ada Viewer', body: 'Watching live', created_at: '2026-11-08 12:00:00' },
    { id: 2, author_name: 'Admin', body: 'Welcome', official: 1, pinned: 1, created_at: '2026-11-08 12:01:00' },
    { id: 3, author_name: 'Reply Viewer', body: 'Amen', parent_id: 1, reply_body: 'Watching live', reply_author: 'Ada Viewer', created_at: '2026-11-08 12:02:00' },
  ],
  reports: [{ id: 6, comment_id: 1, status: 'open', reason: 'spam', body: 'Watching live', detail: 'Private report' }],
})
function discussion(data, moderation = false) {
  const states = [], refs = [], calls = []
  let si = 0, ri = 0, rejectSend = false
  const react = { ...React,
    useState(initial) { const i = si++; if (!(i in states)) states[i] = i === 0 ? data : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(initial) { const i = ri++; return refs[i] ??= { current: i === 0 ? true : initial } },
    useEffect() {}, useCallback: fn => fn, useId: () => 'test-chat',
  }
  const component = load('src/components/LiveDiscussion.tsx', { react, '../hooks/useTypingViewport': { useTypingViewport() {} }, './PlayerLoading': { PlayerLoading() {} }, '../player-chat-refinement.css': {}, '../lib/liveTv': {
    getLiveDiscussion: async () => data,
    sendLiveComment: async ({ data }) => { if (rejectSend) throw new Error('Please retry'); calls.push(['send', data]) },
    reportLiveComment: async ({ data }) => { calls.push(['report', data]) },
    moderateLive: async ({ data }) => { calls.push(['moderate', data]) },
    blockLiveViewer: async ({ data }) => { calls.push(['block', data]) },
    unblockLiveViewer: async ({ data }) => { calls.push(['unblock', data]) },
  } }, { document: { getElementById: () => ({ focus() {} }) } }).LiveDiscussion
  return { calls, reject: () => { rejectSend = true }, render() { si = ri = 0; return component({ channelId: 34, moderation }) } }
}
const publicChat = discussion(fixture())
let tree = publicChat.render()
assert.equal(nodes(tree).filter(n => n.props?.role === 'tablist').length, 0, 'Public chat must have no management tabs')
assert.equal(nodes(tree).filter(n => n.type === 'article').length, 3, 'Replies and official comments remain in one public feed')
assert.ok(!button(tree, 'Hide'), 'Moderation belongs in admin')
messageButton(tree, 1, 'Reply').props.onClick(clickEvent)
tree = publicChat.render()
assert.ok(find(tree, n => n.type === 'blockquote'), 'Parent context stays inline')
find(tree, n => n.type === 'textarea' && n.props.id).props.onChange({ target: { value: 'Thank you' } })
tree = publicChat.render()
find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} })
await flush()
assert.equal(publicChat.calls[0][1].parentId, 1)
assert.equal(publicChat.calls[0][1].announcement, false)
assert.equal(publicChat.calls[0][1].body, 'Thank you')
assert.equal(nodes(publicChat.render()).filter(n => n.props?.role === 'tab').length, 0)
messageButton(publicChat.render(), 1, 'Report').props.onClick(clickEvent)
tree = publicChat.render()
find(tree, n => n.type === 'form' && n.props['aria-label'] === 'Report comment').props.onSubmit({ preventDefault() {} })
await flush()
assert.equal(publicChat.calls[1][0], 'report')
assert.equal(publicChat.calls[1][1].commentId, 1)
assert.equal(nodes(publicChat.render()).filter(n => n.type === 'article').length, 3, 'Reporting returns to the same public feed')
assert.ok(!find(publicChat.render(), n => n.props?.role === 'tab'), 'Reporting never exposes private queue')
publicChat.reject()
find(publicChat.render(), n => n.type === 'textarea' && n.props.id).props.onChange({ target: { value: 'Keep this draft' } })
find(publicChat.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} })
await flush()
assert.equal(find(publicChat.render(), n => n.type === 'textarea' && n.props.id).props.value, 'Keep this draft', 'Failure preserves draft')
const adminPublic = discussion(fixture(true))
assert.ok(!find(adminPublic.render(), n => n.props?.role === 'tab'), 'Even administrators see one feed on public route')
assert.ok(!find(discussion(fixture(), true).render(), n => n.props?.role === 'tab'), 'Prop cannot grant administrator access')
const admin = discussion(fixture(true), true)
tree = admin.render()
assert.equal(nodes(tree).filter(n => n.props?.role === 'tab').length, 4)
button(tree, 'Reports').props.onClick()
button(admin.render(), 'Resolve').props.onClick()
await flush()
assert.equal(admin.calls[0][1].action, 'resolve')
assert.equal(admin.calls[0][1].targetId, 6)
const guest = discussion({ ...fixture(), canComment: false, signedIn: false })
assert.ok(find(guest.render(), n => n.type === 'a' && n.props.href === '/login'))
assert.ok(!find(guest.render(), n => n.type === 'textarea'), 'Guests cannot compose')


// Collapsing keeps the channel player intact and reopening restores the feed.
find(publicChat.render(), n => n.props?.['aria-label'] === 'Close live chat').props.onClick()
assert.equal(nodes(publicChat.render()).filter(n => n.type === 'article').length, 0)
find(publicChat.render(), n => n.props?.['aria-label'] === 'Open live chat').props.onClick()
assert.equal(nodes(publicChat.render()).filter(n => n.type === 'article').length, 3)
const interactive = discussion(fixture())
find(interactive.render(), n => n.props?.['aria-label'] === 'Choose a reaction').props.onClick()
find(interactive.render(), n => n.props?.['aria-label'] === 'Send heart reaction').props.onClick()
await flush()
assert.equal(interactive.calls[0][0], 'send');assert.equal(interactive.calls[0][1].body, '❤️');assert.equal(interactive.calls[0][1].parentId, undefined)
find(interactive.render(), n => n.props?.['aria-label'] === 'Add emoji').props.onClick()
find(interactive.render(), n => n.props?.['aria-label'] === 'Add prayer').props.onClick()
assert.equal(find(interactive.render(), n => n.type === 'textarea' && n.props.id).props.value, '🙏')
messageButton(interactive.render(), 1, 'Block viewer').props.onClick(clickEvent)
tree = interactive.render()
assert.ok(find(tree, n => n.type === 'dialog'), 'Block action asks for a concrete confirmation')
button(tree, 'Block').props.onClick();await flush()
assert.equal(interactive.calls[1][0], 'block');assert.equal(interactive.calls[1][1].commentId, 1)
assert.ok(!find(interactive.render(), n => n.type === 'dialog'))
const blocked = discussion({ ...fixture(), blocked: [{ id: 8, author_name: 'Blocked Viewer' }] })
find(blocked.render(), n => n.props?.['aria-label'] === 'Blocked viewers').props.onClick()
button(blocked.render(), 'Unblock').props.onClick();await flush();assert.equal(blocked.calls[0][1].blockId, 8)

const glassFile = 'src/components/ui/apple-tahoe-liquid-glass-button.tsx'
const glass = load(glassFile)
for (const [width, height] of [[60, 60], [64, 64], [240, 64], [357, 64], [700, 80]]) {
  const outline = glass.squircleOutline(width, height, 999)
  assert.equal(outline.radius, Math.min(width, height) / 2)
  assert.ok(!/NaN|Infinity/.test(outline.polygon))
  assert.ok(outline.corners.every(corner => [...corner].every(Number.isFinite)))
  assert.equal(glass.squircleOutline(width, height, 999), outline, 'Stable layouts reuse measured geometry')
}
for (const [ua, expected] of [
  ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1', 'webkit'],
  ['Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36', 'chromium'],
  ['Mozilla/5.0 Firefox/130.0', 'gecko'],
]) assert.equal(load(glassFile, {}, { navigator: { userAgent: ua } }).detectEngine(), expected)
// asChild must preserve links/nav semantics, active page attributes and caller handlers.
const markup = renderToStaticMarkup(React.createElement(glass.LiquidGlass, { asChild: true, material: 'clear' }, React.createElement('nav', { 'aria-label': 'Quick navigation' }, React.createElement('a', { href: '/search', 'aria-current': 'page' }, 'Search'))))
assert.ok(markup.startsWith('<nav'), 'Glass cannot insert an extra layout wrapper')
assert.ok(markup.includes('aria-current="page"') && markup.includes('href="/search"'))
assert.ok(markup.includes('data-glass-lens=""'))
assert.ok(!markup.includes('demo.tsx'))
load('src/routes/channel.$id.tsx', {
  '@/lib/contentRoutes': { contentIdFromPath: () => 34 },
  '@tanstack/react-router': { createFileRoute: () => config => config },
  '../lib/liveTv': {}, '../components/Poster': {}, '../components/TitleDetail': {}, '../components/LiveDiscussion': {},
})
console.log('EXPERIENCE_GLASSLIVE_PASS')
