import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { all, first, run } from './db'
import { getActiveViewer } from './viewer.server'

// Admin-managed streaming settings: the Bunny library id (already used for
// embed playback) and the library's pull-zone host, which unlocks native HLS
// URLs for the mobile app (/api/mobile/stream/*).

function writeOrigin() {
  const origin = getRequestHeader('origin')
  if (origin && origin !== new URL(getRequestUrl()).origin) throw new Error('This request is not allowed.')
  if (getRequestHeader('sec-fetch-site') === 'cross-site') throw new Error('This request is not allowed.')
}

async function admin() {
  setResponseHeader('Cache-Control', 'private, no-store')
  const viewer = await getActiveViewer()
  if (!viewer) throw new Error('Administrator access required.')
  const u = await first<any>('SELECT user_type FROM users WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0', viewer.userId)
  if (u?.user_type !== 'admin') throw new Error('Administrator access required.')
  return viewer
}

const PULL_ZONE = /^[a-z0-9-]+\.b-cdn\.net$/i
const LIBRARY_ID = /^\d{1,12}$/

const KEYS = ['bunny_library_id', 'bunny_pull_zone'] as const

export const getStreamSettings = createServerFn({ method: 'GET' }).handler(async () => {
  await admin()
  const rows = await all<any>(`SELECT name, val FROM settings WHERE name IN ('bunny_library_id','bunny_pull_zone') AND deleted_at IS NULL`)
  const map = Object.fromEntries(rows.map(r => [r.name, String(r.val ?? '')]))
  return { bunnyLibraryId: map.bunny_library_id ?? '', bunnyPullZone: map.bunny_pull_zone ?? '' }
})

async function upsert(name: string, val: string) {
  const updated = await run(`UPDATE settings SET val=?, deleted_at=NULL WHERE name=?`, val, name)
  if (!updated?.meta?.changes) await run(`INSERT INTO settings(name, val) VALUES(?, ?)`, name, val)
}

export const saveStreamSettings = createServerFn({ method: 'POST' })
  .validator((d: { bunnyLibraryId: string; bunnyPullZone: string }) => {
    const bunnyLibraryId = String(d?.bunnyLibraryId ?? '').trim()
    const bunnyPullZone = String(d?.bunnyPullZone ?? '').trim().toLowerCase()
    if (bunnyLibraryId && !LIBRARY_ID.test(bunnyLibraryId)) throw new Error('The Bunny library ID is a number, e.g. 347005.')
    if (bunnyPullZone && !PULL_ZONE.test(bunnyPullZone)) throw new Error('The pull zone looks like vz-abc123-456.b-cdn.net (Bunny dashboard → Stream → API).')
    return { bunnyLibraryId, bunnyPullZone }
  })
  .handler(async ({ data }) => {
    writeOrigin()
    await admin()
    await upsert(KEYS[0], data.bunnyLibraryId)
    await upsert(KEYS[1], data.bunnyPullZone)
    return { ok: true }
  })
