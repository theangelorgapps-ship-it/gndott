import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { all, first, run } from './db'
import { getActiveViewer } from './viewer.server'

// Admin-managed streaming settings: the Bunny library id (already used for
// embed playback) and the library's pull-zone host, which unlocks native HLS
// URLs for the mobile app (/api/mobile/stream/*). Plus the Giving Stripe
// account: its own keys let giving run in test mode (or on a separate
// account) without touching subscription checkout.

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
const STRIPE_KEY = /^(sk|rk)_(test|live)_[a-zA-Z0-9]+$/
const STRIPE_WHSEC = /^whsec_[a-zA-Z0-9]+$/

const GIVING_KEYS = ['giving_stripe_enabled', 'giving_stripe_secretkey', 'giving_stripe_webhook_secret'] as const

export const getStreamSettings = createServerFn({ method: 'GET' }).handler(async () => {
  await admin()
  const rows = await all<any>(`SELECT name, val FROM settings WHERE name IN ('bunny_library_id','bunny_pull_zone','giving_stripe_enabled','giving_stripe_secretkey','giving_stripe_webhook_secret') AND deleted_at IS NULL`)
  const map = Object.fromEntries(rows.map(r => [r.name, String(r.val ?? '')]))
  const mask = (v: string) => v ? `••••${v.slice(-4)}` : ''
  return {
    bunnyLibraryId: map.bunny_library_id ?? '',
    bunnyPullZone: map.bunny_pull_zone ?? '',
    givingStripeEnabled: map.giving_stripe_enabled === '1',
    // Secrets never leave the server; the form only reports whether one is set.
    givingSecretKeySet: mask(map.giving_stripe_secretkey ?? ''),
    givingWebhookSecretSet: mask(map.giving_stripe_webhook_secret ?? ''),
  }
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
    await upsert('bunny_library_id', data.bunnyLibraryId)
    await upsert('bunny_pull_zone', data.bunnyPullZone)
    return { ok: true }
  })

export const saveGivingSettings = createServerFn({ method: 'POST' })
  .validator((d: { enabled: boolean; secretKey: string; webhookSecret: string }) => {
    const secretKey = String(d?.secretKey ?? '').trim()
    const webhookSecret = String(d?.webhookSecret ?? '').trim()
    if (secretKey && !STRIPE_KEY.test(secretKey)) throw new Error('The Stripe secret key looks like sk_test_... or sk_live_... (Stripe dashboard → Developers → API keys).')
    if (webhookSecret && !STRIPE_WHSEC.test(webhookSecret)) throw new Error('The webhook signing secret looks like whsec_... (Stripe dashboard → Developers → Webhooks).')
    return { enabled: !!d?.enabled, secretKey, webhookSecret }
  })
  .handler(async ({ data }) => {
    writeOrigin()
    await admin()
    await upsert(GIVING_KEYS[0], data.enabled ? '1' : '0')
    // Blank secret fields keep the stored value; only overwrite when filled in.
    if (data.secretKey) await upsert(GIVING_KEYS[1], data.secretKey)
    if (data.webhookSecret) await upsert(GIVING_KEYS[2], data.webhookSecret)
    return { ok: true }
  })
