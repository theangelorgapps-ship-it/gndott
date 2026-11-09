#!/usr/bin/env node
// Executes the real viewer functions, signed-cookie helper and D1 adapter against
// an isolated in-memory SQLite fixture. No application process or remote DB.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const db = new DatabaseSync(':memory:')
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, status INTEGER, is_banned INTEGER, deleted_at TEXT);
  CREATE TABLE user_multi_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, avatar TEXT, is_child_profile INTEGER, deleted_at TEXT);
  INSERT INTO users VALUES (1,1,0,NULL),(2,1,0,NULL),(3,1,0,'2026-01-01'),(4,1,1,NULL),(5,0,0,NULL),(6,1,0,NULL);
  INSERT INTO user_multi_profiles VALUES
    (12,1,'Sam',NULL,0,NULL),(11,1,'Alex',NULL,0,NULL),(13,1,'Deleted',NULL,0,'2026-01-01'),
    (21,2,'Other account',NULL,0,NULL),(31,3,'Deleted account',NULL,0,NULL),
    (41,4,'Banned account',NULL,0,NULL),(51,5,'Inactive account',NULL,0,NULL);
`)
const cookies = new Map()
let writes = []
let failDatabase = false
const d1 = { prepare(sql) {
  assert.match(sql.trim(), /^SELECT\b/i, 'Profile selection must not mutate database records')
  return { bind(...params) {
    const statement = () => { if (failDatabase) throw new Error('Fixture unavailable'); return db.prepare(sql) }
    return { first: async () => statement().get(...params) ?? null, all: async () => ({ results: statement().all(...params) }) }
  } }
} }
function compile(path, imports) {
  const file = resolve(root, path)
  const result = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true })
  assert.deepEqual((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [])
  const exports = {}
  vm.runInNewContext(result.outputText, { exports, require: (name) => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] }, crypto: webcrypto, URL, TextEncoder, TextDecoder, btoa, atob, console }, { filename: path })
  return exports
}
const sessionApi = compile('src/lib/session.server.ts', { 'cloudflare:workers': { env: { SESSION_SECRET: 'isolated-test-secret-never-use-in-production' } }, '@tanstack/react-start/server': {
  getRequestUrl: () => 'https://example.test',
  getCookie: (name) => cookies.get(name),
  setCookie: (name, value, options) => { cookies.set(name, value); writes.push({ name, value, options }) },
  deleteCookie: (name) => cookies.delete(name),
} })
const adapter = compile('src/lib/db.ts', { 'cloudflare:workers': { env: { DB: d1 } } })
const viewer = compile('src/lib/viewer.server.ts', { './db': adapter, './session.server': sessionApi })
const methods = []
const boundary = compile('src/lib/viewer.ts', { './viewer.server': viewer, '@tanstack/react-start': { createServerFn({ method }) {
  methods.push(method)
  let validate = (value) => value
  return { validator(fn) { validate = fn; return this }, handler(fn) { return (input = {}) => fn({ data: validate(input.data) }) } }
} } })
const plain = (value) => JSON.parse(JSON.stringify(value))
async function signed(payload) { await sessionApi.setSessionCookie(payload); writes = [] }
function noWrite() { assert.equal(writes.length, 0, 'Rejected selection must leave the existing signed cookie untouched') }
let cases = 0
async function test(name, fn) { await fn(); cases++; console.log(`PASS ${name}`) }
try {
  await test('anonymous selection is denied', async () => {
    assert.equal(await viewer.getActiveViewer(), null)
    assert.equal(await boundary.getViewerState(), null)
    assert.equal((await boundary.selectViewerProfile({ data: { profileId: 11 } })).needsAuth, true)
    noWrite()
  })
  await test('tampered cookie cannot select a profile', async () => {
    await signed({ uid: 1, pid: 11 })
    const [body, signature] = cookies.get(sessionApi.SESSION_COOKIE).split('.')
    cookies.set(sessionApi.SESSION_COOKIE, `${btoa(JSON.stringify({ uid: 2, pid: 21 }))}.${signature}`)
    assert.equal(await viewer.getActiveViewer(), null)
    assert.equal((await boundary.selectViewerProfile({ data: { profileId: 21 } })).ok, false)
    noWrite()
  })
  await test('absent profile has no silent fallback', async () => {
    await signed({ uid: 1 })
    assert.deepEqual(plain(await viewer.getActiveViewer()), { userId: 1, profileId: null, profileName: null, avatar: null })
    const state = await boundary.getViewerState()
    assert.deepEqual(state.profiles.map(profile => profile.id), [11, 12])
    assert.ok(state.profiles.every(profile => !('user_id' in profile)))
    noWrite()
  })
  await test('owned profile resolves and returns only the viewer contract', async () => {
    await signed({ uid: 1, pid: 11 })
    assert.deepEqual(plain(await boundary.getViewer()), { userId: 1, profileId: 11, profileName: 'Alex', avatar: null })
    noWrite()
  })
  await test('foreign and deleted signed pid never resolve another profile', async () => {
    for (const pid of [21, 13, 9999]) {
      await signed({ uid: 1, pid })
      assert.deepEqual(plain(await viewer.getActiveViewer()), { userId: 1, profileId: null, profileName: null, avatar: null })
      assert.equal((await boundary.selectViewerProfile({ data: { profileId: pid } })).ok, false)
      noWrite()
    }
  })
  await test('invalid profile input does not coerce to an owned ID', async () => {
    await signed({ uid: 1, pid: 11 })
    for (const profileId of [null, undefined, '12', true, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, {}, []]) {
      assert.equal((await boundary.selectViewerProfile({ data: { profileId } })).ok, false)
      noWrite()
    }
    assert.equal((await boundary.selectViewerProfile({ data: null })).ok, false)
  })
  await test('selection writes pid into the existing signed session', async () => {
    const claims = { uid: 1, pid: 11, email: 'fixture@example.test', name: 'Fixture', custom: 'preserved' }
    await signed(claims)
    const result = await boundary.selectViewerProfile({ data: { profileId: 12 } })
    assert.equal(result.ok, true)
    assert.deepEqual(plain(result.viewer), { userId: 1, profileId: 12, profileName: 'Sam' })
    const { exp, ...savedClaims } = plain(await sessionApi.getSession()); assert.ok(exp > Date.now() / 1000); assert.deepEqual(savedClaims, { ...claims, pid: 12 }); assert.equal(writes[0].options.secure, true)
    assert.equal(writes.length, 1)
    assert.equal(writes[0].options.httpOnly, true)
    assert.equal(writes[0].options.sameSite, 'lax')
    assert.equal(writes[0].options.path, '/')
    assert.equal((await viewer.getActiveViewer()).profileId, 12)
  })
  await test('account isolation holds in both directions', async () => {
    await signed({ uid: 2, pid: 21 })
    assert.deepEqual((await boundary.getViewerState()).profiles.map(profile => profile.id), [21])
    assert.equal((await boundary.selectViewerProfile({ data: { profileId: 11 } })).ok, false)
    noWrite()
    assert.equal((await viewer.getActiveViewer()).profileName, 'Other account')
  })
  await test('deleted selected profile requires choosing again', async () => {
    await signed({ uid: 1, pid: 12 })
    db.prepare('UPDATE user_multi_profiles SET deleted_at = ? WHERE id = ?').run('2026-11-07', 12)
    assert.deepEqual(plain(await viewer.getActiveViewer()), { userId: 1, profileId: null, profileName: null, avatar: null })
    assert.deepEqual((await boundary.getViewerState()).profiles.map(profile => profile.id), [11])
    assert.equal((await boundary.selectViewerProfile({ data: { profileId: 12 } })).ok, false)
    noWrite()
  })
  await test('deleted banned inactive and nonexistent accounts are rejected', async () => {
    for (const uid of [3, 4, 5, 999, '1', -1, null]) {
      await signed({ uid, pid: 11 })
      assert.equal(await viewer.getActiveViewer(), null)
      assert.equal((await boundary.selectViewerProfile({ data: { profileId: 11 } })).ok, false)
      noWrite()
    }
  })
  await test('account without profiles remains valid and unselected', async () => {
    await signed({ uid: 6 })
    assert.deepEqual(plain(await boundary.getViewerState()), { viewer: { userId: 6, profileId: null, profileName: null, avatar: null }, profiles: [] })
  })
  await test('database errors propagate without signing a false success', async () => {
    await signed({ uid: 1, pid: 11 }); failDatabase = true
    await assert.rejects(() => boundary.getViewerState(), /Fixture unavailable/)
    await assert.rejects(() => boundary.selectViewerProfile({ data: { profileId: 11 } }), /Fixture unavailable/)
    noWrite(); failDatabase = false
  })
  await test('server boundary preserves GET reads and POST profile mutation', async () => {
    assert.deepEqual(methods, ['GET', 'GET', 'POST'])
  })
  console.log(`VIEWER_OWNERSHIP_OK ${cases} cases; real signed session and SQL; no remote writes`)
} finally { db.close() }
