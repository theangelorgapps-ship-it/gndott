import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { toJSONAsync, fromCrossJSON } from 'seroval'

const base = new URL(process.argv[2] || 'https://gndott.theangelorgapps.workers.dev').origin
assert.match(base, /^https:\/\/[a-z0-9-]+\.theangelorgapps\.workers\.dev$/)
const files = await fs.readdir('dist/server/assets')
const bundle = await fs.readFile('dist/server/assets/' + files.find(file => /^bible-[^.]+\.js$/.test(file)), 'utf8')
const ids = Object.fromEntries([...bundle.matchAll(/id: "([a-f0-9]+)",\s*name: "(getBibleBooks|getBibleChapter)"/g)].map(([, id, name]) => [name, id]))
assert.equal(Object.keys(ids).length, 2)
async function rpc(name, data) {
  const payload = encodeURIComponent(JSON.stringify(await toJSONAsync({ data })))
  const response = await fetch(`${base}/_serverFn/${ids[name]}?payload=${payload}`, {
    headers: { 'x-tsr-serverFn': 'true', 'sec-fetch-site': 'same-origin', origin: base },
    signal: AbortSignal.timeout(20000),
  })
  assert.equal(response.status, 200, `${name} HTTP status`)
  const decoded = fromCrossJSON(await response.json(), { refs: new Map() })
  assert.ok(decoded.result, `${name} result missing`)
  assert.equal(decoded.result.error, null, `${name}: ${decoded.result.error}`)
  return decoded.result
}
for (const [version, code, count] of [['1', 'KJV', 81], ['59', 'ESV', 66], ['8', 'AMP', 66], ['111', 'NIV', 66]]) {
  const { books } = await rpc('getBibleBooks', { version })
  assert.equal(books.length, count)
  assert.equal(books.find(book => book.id === 'JHN').chapters, 21)
  const { passage } = await rpc('getBibleChapter', { version, book: 'JHN', chapter: 3 })
  assert.equal(passage.version, version)
  assert.equal(passage.verses.length, 36)
  assert.ok(passage.verses.find(verse => verse.number === 16).text.length > 50)
  console.log(`${code}: ${count} books; John 3: 36 verses`)
}
const next = await rpc('getBibleChapter', { version: '1', book: 'JHN', chapter: 4 })
assert.equal(next.passage.verses.length, 54)
console.log(`BIBLE_LIVE_OK: 9 real RPC reads at ${base}`)
