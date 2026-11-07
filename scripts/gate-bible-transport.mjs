import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const timers = new Map()
let nextTimer = 0, fixture, connects = 0, cases = 0
function load(path, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, require: name => imports[name],
    URL, Response, Headers, TextDecoder, TextEncoder, Uint8Array, AbortSignal, fetch,
    setTimeout: (fn, ms) => { assert.equal(ms, 12000); const id = ++nextTimer; timers.set(id, fn); return id },
    clearTimeout: id => timers.delete(id),
  })
  return module.exports
}
const { bibleTransport } = load('src/lib/bibleTransport.server.ts', { 'cloudflare:sockets': { connect(address, options) {
  assert.equal(address.hostname, 'api.prayerpulse.io'); assert.equal(address.port, 443)
  assert.equal(options.secureTransport, 'on'); assert.equal(options.allowHalfOpen, false); assert.equal(Object.keys(options).length, 2)
  connects++; return fixture.socket
} } })
const provider = load('src/lib/bibleProvider.ts')
const url = 'https://api.prayerpulse.io/bible/get-books/KJV/'
const encoder = new TextEncoder()
function wire(body = '[]', extra = '', status = '200 OK') {
  return encoder.encode(`HTTP/1.1 ${status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${encoder.encode(body).length}\r\n${extra}\r\n${body}`)
}
function setup(bytes = wire(), mode = '') {
  let controller, ended = false
  const state = { closed: 0, writes: [] }
  const readable = new ReadableStream({ start(c) {
    controller = c
    if (mode === 'read-error') { c.error(new Error('read failed')); ended = true }
    else if (mode !== 'stall') {
      // Split CRLF and UTF-8 sequences across chunks to exercise real stream boundaries.
      for (let i = 0; i < bytes.length; i += 17) c.enqueue(bytes.subarray(i, i + 17))
      c.close(); ended = true
    }
  } })
  state.socket = {
    opened: mode === 'open-error' ? Promise.reject(new Error('TLS verification failed')) : mode === 'open-stall' ? new Promise(() => {}) : Promise.resolve({}),
    closed: Promise.resolve(), readable,
    writable: new WritableStream({ write(bytes) { if (mode === 'write-error') throw new Error('write failed'); state.writes.push(new TextDecoder().decode(bytes)) } }),
    async close() { state.closed++; if (!ended) { controller.error(new Error('socket closed')); ended = true } },
  }
  fixture = state
  return state
}
async function check(name, fn) { await fn(); assert.equal(timers.size, 0); cases++; console.log(`PASS ${name}`) }
async function rejects(bytes, pattern = /response|JSON|Unexpected/, mode = '') {
  const state = setup(bytes, mode)
  await assert.rejects(bibleTransport(url), pattern)
  assert.equal(state.closed, 1)
}
await check('All translations and chapter bounds preserve provider payloads', async () => {
  for (const version of provider.BIBLE_VERSIONS) {
    let state = setup(wire(JSON.stringify([{ id: 'JHN', name: 'John', chapters: 21, bookid: 43 }])))
    assert.equal((await provider.fetchBibleBooks(version.id, bibleTransport))[0].chapters, 21)
    assert.equal(state.closed, 1); assert.match(state.writes[0], /HTTP\/1\.0\r\nHost: api\.prayerpulse\.io\r\n/)
    assert.match(state.writes[0], /Accept-Encoding: identity\r\nConnection: close\r\n\r\n$/)
    for (const chapter of [1, 150]) {
      state = setup(wire(JSON.stringify([{ verse: 1, text: 'Grâce &amp; truth' }])))
      const result = await provider.fetchBibleChapter({ version: version.id, book: 'PSA', chapter }, bibleTransport)
      assert.equal(result.verses[0].text, 'Grâce & truth'); assert.equal(state.closed, 1)
    }
  }
})
await check('Reject foreign origins, path injection and invalid book/chapter before connecting', async () => {
  const before = connects
  for (const input of [url.replace('https:', 'http:'), url.replace('api.prayerpulse.io', 'evil.test'), url + '#fragment', url + '?extra=1', url + '\n', url.replace('KJV', 'BAD'), 'https://api.prayerpulse.io/bible/get-text/KJV/../1/?clean=true', ...['0', '151', '01'].map(n => `https://api.prayerpulse.io/bible/get-text/KJV/JHN/${n}/?clean=true`)]) await assert.rejects(bibleTransport(input), /Invalid Bible request/)
  await assert.rejects(bibleTransport(url, { method: 'POST' }), /Invalid Bible request/)
  await assert.rejects(bibleTransport(url, { body: 'data' }), /Invalid Bible request/)
  assert.equal(connects, before)
})
await check('Reject upstream errors and redirects', async () => { for (const status of ['525 SSL handshake failed', '302 Found']) await rejects(wire('[]', '', status), /unsuccessful/) })
await check('Reject chunked and compressed responses', async () => { for (const header of ['Transfer-Encoding: chunked', 'Content-Encoding: gzip', 'Content-Encoding: br']) await rejects(wire('[]', `${header}\r\n`), /Unsupported/) })
await check('Reject missing, duplicate and inaccurate lengths', async () => {
  for (const bytes of [encoder.encode('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n[]'), wire('[]', 'Content-Length: 2\r\n'), wire('[]').slice(0, -1), encoder.encode(new TextDecoder().decode(wire()) + 'x')]) await rejects(bytes, /incomplete/)
})
await check('Reject non-JSON content and malformed JSON', async () => {
  await rejects(encoder.encode(new TextDecoder().decode(wire()).replace('application/json', 'text/html')), /Unsupported/)
  await rejects(wire('{'), /JSON|Unexpected|property/)
  const invalidUtf8 = wire('[]'); invalidUtf8[invalidUtf8.length - 1] = 255
  await rejects(invalidUtf8, /encoded data|encoding/)
})
await check('Reject missing and oversized headers', async () => {
  await rejects(encoder.encode('HTTP/1.1 200 OK\r\n'), /headers/)
  await rejects(wire('[]', `X-Large: ${'x'.repeat(16384)}\r\n`), /headers/)
})
await check('Reject oversized response', async () => { await rejects(new Uint8Array(1024 * 1024 + 1), /too large/) })
await check('TLS, write and read failures always close socket', async () => {
  for (const mode of ['open-error', 'write-error', 'read-error']) await rejects(wire(), /TLS verification|write failed|read failed/, mode)
})
await check('Already-aborted requests never connect', async () => {
  const before = connects, controller = new AbortController(); controller.abort(new Error('cancelled'))
  await assert.rejects(bibleTransport(url, { signal: controller.signal }), /cancelled/)
  assert.equal(connects, before)
})
await check('Abort during a stalled read closes socket', async () => {
  const state = setup(wire(), 'stall'), controller = new AbortController()
  const request = bibleTransport(url, { signal: controller.signal })
  for (let i = 0; i < 5; i++) await Promise.resolve()
  controller.abort(new Error('cancelled'))
  await assert.rejects(request, /cancelled/); assert.equal(state.closed, 1)
})
await check('Hard deadline closes stalled handshake and body reads', async () => {
  for (const mode of ['open-stall', 'stall']) {
    const state = setup(wire(), mode), request = bibleTransport(url)
    for (let i = 0; i < 5; i++) await Promise.resolve()
    for (const fire of timers.values()) fire()
    await assert.rejects(request, /timed out/); assert.equal(state.closed, 1)
  }
})
console.log(`BIBLE_TRANSPORT_OK (${cases} focused cases; native TLS required; edge verification separate)`)
