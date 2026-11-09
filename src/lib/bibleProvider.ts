// Migrated from livestream-backend/src/services/prayerPulseApi.js on the
// original AWS instance. Version IDs and upstream paths match that adapter.
export const BIBLE_VERSIONS = [
  { id: '1', code: 'KJV', name: 'King James Version' },
  { id: '59', code: 'ESV', name: 'English Standard Version' },
  { id: '8', code: 'AMP', name: 'Amplified Bible' },
  { id: '111', code: 'NIV', name: 'New International Version' },
] as const
export type BibleBook = { id: string; name: string; chapters: number; testament: 'Old Testament' | 'New Testament' | 'Additional books' }
export type BibleChapter = { version: string; book: string; chapter: number; verses: { number: number; text: string }[] }
type Fetch = typeof fetch
const ORIGIN = 'https://api.prayerpulse.io'

export function bibleVersion(id: unknown) {
  const version = BIBLE_VERSIONS.find(item => item.id === String(id))
  if (!version) throw new Error('Choose a supported Bible translation.')
  return version
}
export function chapterInput(input: { version: unknown; book: unknown; chapter: unknown }) {
  const version = bibleVersion(input.version)
  if (typeof input.book !== 'string' || !/^(?:[1-3]?[A-Z]{2,3}|B\d{2})$/.test(input.book)) throw new Error('Choose a Bible book.')
  if (typeof input.chapter !== 'number' || !Number.isInteger(input.chapter) || input.chapter < 1 || input.chapter > 150) throw new Error('Choose a valid chapter.')
  return { version: version.id, book: input.book, chapter: input.chapter }
}
function text(value: unknown) {
  if (typeof value !== 'string') throw new Error('The Bible service returned an unreadable verse.')
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' }
  return value.replace(/<br\s*\/?>|<\/(?:p|div)>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, key: string) => {
    if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? match
    const code = key.startsWith('#x') ? parseInt(key.slice(2), 16) : Number(key.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  }).replace(/\s+/g, ' ').trim()
}
async function request(path: string, transport: Fetch) {
  const response = await transport(`${ORIGIN}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error('The Bible service is temporarily unavailable. Please try again.')
  const rows: unknown = await response.json()
  if (!Array.isArray(rows) || !rows.length) throw new Error('This passage is not available in the selected translation.')
  return rows
}
export async function fetchBibleBooks(versionId: string, transport: Fetch = fetch): Promise<BibleBook[]> {
  const version = bibleVersion(versionId)
  const rows = await request(`/bible/get-books/${version.code}/`, transport)
  return rows.map(row => {
    if (!row || !/^(?:[1-3]?[A-Z]{2,3}|B\d{2})$/.test(row.id) || typeof row.name !== 'string' || !Number.isInteger(row.chapters) || row.chapters < 1 || row.chapters > 150 || !Number.isInteger(row.bookid)) throw new Error('The Bible book list could not be read. Please retry.')
    return { id: row.id, name: row.name, chapters: row.chapters, testament: row.bookid <= 39 ? 'Old Testament' : row.bookid <= 66 ? 'New Testament' : 'Additional books' }
  })
}
export async function fetchBibleChapter(input: { version: string; book: string; chapter: number }, transport: Fetch = fetch): Promise<BibleChapter> {
  const valid = chapterInput(input)
  const version = bibleVersion(valid.version)
  const rows = await request(`/bible/get-text/${version.code}/${valid.book}/${valid.chapter}/?clean=true`, transport)
  const verses = rows.map(row => {
    if (!row || !Number.isInteger(row.verse) || row.verse < 1) throw new Error('The Bible chapter could not be read. Please retry.')
    return { number: row.verse, text: text(row.text) }
  })
  if (new Set(verses.map(verse => verse.number)).size !== verses.length) throw new Error('The Bible chapter could not be read. Please retry.')
  return { version: valid.version, book: valid.book, chapter: valid.chapter, verses: verses.sort((a,b) => a.number-b.number) }
}
