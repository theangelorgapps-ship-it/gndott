import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { all, first, run } from './db'
import { getActiveViewer } from './viewer.server'
import { getStoreProducts } from './store'
import { productPath, storeText, type StoreProduct } from './storeTypes'

// The public Woo catalogue via the store's cached server fn.
async function catalogueList(): Promise<StoreProduct[]> {
  return (await getStoreProducts()).products
}

// Recommended Resources: shop products mapped onto catalogue content, shown in
// the player's Info panel. "Get Now" is a one-step checkout for viewers with
// saved delivery details; "Remind Me" re-prompts when playback ends or the
// player closes.

export const CONTENT_TYPES = ['movie', 'video', 'episode', 'tvshow', 'teaching', 'live'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

function writeOrigin() {
  if (getRequestHeader('origin') !== new URL(getRequestUrl()).origin || getRequestHeader('sec-fetch-site') === 'cross-site') throw new Error('Please retry from Halobox.')
  setResponseHeader('Cache-Control', 'private, no-store')
}

async function requireViewer() {
  setResponseHeader('Cache-Control', 'private, no-store')
  const viewer = await getActiveViewer()
  if (!viewer) throw new Error('Sign in to continue.')
  const user = await first<any>(`SELECT id, email, first_name, last_name FROM users WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0`, viewer.userId)
  if (!user) throw new Error('Sign in to continue.')
  return user
}

async function requireAdmin() {
  const user = await requireViewer()
  const row = await first<any>(`SELECT user_type FROM users WHERE id=?`, user.id)
  if (row?.user_type !== 'admin') throw new Error('Administrator access required.')
  return user
}

function validContent(contentType: unknown, contentId: unknown): { contentType: ContentType; contentId: number } {
  if (!CONTENT_TYPES.includes(contentType as ContentType)) throw new Error('Unknown content type.')
  if (typeof contentId !== 'number' || !Number.isSafeInteger(contentId) || contentId < 1) throw new Error('Unknown content.')
  return { contentType: contentType as ContentType, contentId }
}

export type RecommendedProduct = {
  id: number; name: string; slug: string; path: string; image: string;
  price: string; currency: string; minorUnit: number; inStock: boolean
}

function project(p: StoreProduct): RecommendedProduct {
  return {
    id: p.id, name: storeText(p.name), slug: p.slug, path: productPath(p),
    image: p.images[0]?.src ?? '', price: p.prices.price, currency: p.prices.currency_code,
    minorUnit: p.prices.currency_minor_unit, inStock: p.is_in_stock,
  }
}

async function mappedProducts(contentType: ContentType, contentId: number): Promise<RecommendedProduct[]> {
  const rows = await all<any>(`SELECT product_id FROM content_products WHERE content_type=? AND content_id=? ORDER BY sort, product_id LIMIT 12`, contentType, contentId)
  if (!rows.length) return []
  const ids = new Set(rows.map(r => Number(r.product_id)))
  const catalogue = await catalogueList()
  return catalogue.filter(p => ids.has(p.id)).map(project)
}

export const getContentProducts = createServerFn({ method: 'GET' })
  .validator((d: { contentType: ContentType; contentId: number }) => validContent(d?.contentType, d?.contentId))
  .handler(async ({ data }) => ({ products: await mappedProducts(data.contentType, data.contentId) }))

// ---------- admin mapping ----------

export const listContentProductMappings = createServerFn({ method: 'GET' })
  .validator((d: { contentType?: ContentType; contentId?: number }) => ({ contentType: d?.contentType, contentId: d?.contentId }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const where = data.contentType && data.contentId ? `WHERE content_type=? AND content_id=?` : ''
    const params = data.contentType && data.contentId ? [data.contentType, data.contentId] : []
    const rows = await all<any>(`SELECT * FROM content_products ${where} ORDER BY content_type, content_id, sort LIMIT 500`, ...params)
    const catalogue = await catalogueList()
    return {
      mappings: rows,
      products: catalogue.map(project),
    }
  })

export const attachContentProduct = createServerFn({ method: 'POST' })
  .validator((d: { contentType: ContentType; contentId: number; productId: number }) => {
    const c = validContent(d?.contentType, d?.contentId)
    if (typeof d?.productId !== 'number' || !Number.isSafeInteger(d.productId) || d.productId < 1) throw new Error('Unknown product.')
    return { ...c, productId: d.productId }
  })
  .handler(async ({ data }) => {
    writeOrigin()
    await requireAdmin()
    const catalogue = await catalogueList()
    if (!catalogue.some(p => p.id === data.productId)) throw new Error('That product is not in the Halobox shop catalogue.')
    await run(`INSERT INTO content_products(content_type, content_id, product_id, sort) VALUES(?,?,?, COALESCE((SELECT MAX(sort)+1 FROM content_products WHERE content_type=? AND content_id=?), 0)) ON CONFLICT DO NOTHING`,
      data.contentType, data.contentId, data.productId, data.contentType, data.contentId)
    return { ok: true }
  })

export const detachContentProduct = createServerFn({ method: 'POST' })
  .validator((d: { contentType: ContentType; contentId: number; productId: number }) => {
    const c = validContent(d?.contentType, d?.contentId)
    if (typeof d?.productId !== 'number' || !Number.isSafeInteger(d.productId) || d.productId < 1) throw new Error('Unknown product.')
    return { ...c, productId: d.productId }
  })
  .handler(async ({ data }) => {
    writeOrigin()
    await requireAdmin()
    await run(`DELETE FROM content_products WHERE content_type=? AND content_id=? AND product_id=?`, data.contentType, data.contentId, data.productId)
    return { ok: true }
  })

// ---------- saved delivery details ----------

// Same field shape as the store checkout address (storeCheckout.server.ts).
export type StoreAddress = { firstName: string; lastName: string; phone: string; address1: string; address2: string; city: string; state: string; postcode: string; country: string }

function validAddress(d: any): StoreAddress {
  const a: StoreAddress = {
    firstName: String(d?.firstName ?? '').trim(), lastName: String(d?.lastName ?? '').trim(),
    phone: String(d?.phone ?? '').trim(),
    address1: String(d?.address1 ?? '').trim(), address2: String(d?.address2 ?? '').trim(),
    city: String(d?.city ?? '').trim(), state: String(d?.state ?? '').trim(),
    postcode: String(d?.postcode ?? '').trim(), country: String(d?.country ?? '').trim().toUpperCase(),
  }
  if (a.firstName.length < 2 || a.firstName.length > 100) throw new Error('Enter the recipient first name.')
  if (a.lastName.length > 100) throw new Error('Enter a valid last name.')
  if (a.phone.length > 40) throw new Error('Enter a valid phone number.')
  if (!a.address1 || a.address1.length > 300 || !a.city || a.city.length > 100 || a.state.length > 100 || !a.postcode || a.postcode.length > 20) throw new Error('Enter a complete delivery address.')
  if (!/^[A-Z]{2}$/.test(a.country)) throw new Error('Choose a country.')
  return a
}

export const getStoreAddress = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireViewer()
  const row = await first<any>(`SELECT * FROM store_addresses WHERE user_id=?`, user.id)
  return {
    address: row ? { firstName: row.first_name, lastName: row.last_name, phone: row.phone, address1: row.address_1, address2: row.address_2, city: row.city, state: row.state, postcode: row.postcode, country: row.country } as StoreAddress : null,
  }
})

export const saveStoreAddress = createServerFn({ method: 'POST' })
  .validator(validAddress)
  .handler(async ({ data }) => {
    writeOrigin()
    const user = await requireViewer()
    await run(`INSERT INTO store_addresses(user_id, first_name, last_name, phone, address_1, address_2, city, state, postcode, country, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, phone=excluded.phone, address_1=excluded.address_1, address_2=excluded.address_2, city=excluded.city, state=excluded.state, postcode=excluded.postcode, country=excluded.country, updated_at=datetime('now')`,
      user.id, data.firstName, data.lastName, data.phone, data.address1, data.address2, data.city, data.state, data.postcode, data.country)
    return { ok: true }
  })

// ---------- Get Now / Remind Me ----------

// Get Now: one-step in-site checkout for a single product, quoted through the
// store bridge with the viewer's saved delivery details, paid via Stripe.
export const buyNowProduct = createServerFn({ method: 'POST' })
  .validator((d: { productId: number }) => {
    if (typeof d?.productId !== 'number' || !Number.isSafeInteger(d.productId) || d.productId < 1) throw new Error('Unknown product.')
    return { productId: d.productId }
  })
  .handler(async ({ data }) => {
    writeOrigin()
    const user = await requireViewer()
    const row = await first<any>(`SELECT * FROM store_addresses WHERE user_id=?`, user.id)
    if (!row) return { ok: false as const, needsDetails: true as const }
    const { subscriptionWriteOrigin, stripeConfiguration, checkoutError } = await import('./subscriptionCheckout.server')
    const origin = subscriptionWriteOrigin()
    const { db, secret, enabled } = await stripeConfiguration()
    if (!enabled || !secret) return { ok: false as const, error: 'Online checkout is temporarily unavailable. Please try again later.' }
    const address = {
      first_name: row.first_name, last_name: row.last_name, address_1: row.address_1, address_2: row.address_2,
      city: row.city, state: row.state, postcode: row.postcode, country: row.country, phone: row.phone,
    }
    try {
      const mod = await import('./storeCheckout.server')
      const { checkoutId, quote } = await mod.createStoreQuote(db, user, { items: [{ id: data.productId, quantity: 1 }], coupons: [] }, mod.cleanAddress(address))
      const totalMinor = Math.round(Number(quote.total) * 100)
      return await mod.createStoreCheckout(db, user, { checkoutId, requestKey: crypto.randomUUID(), expectedTotalMinor: totalMinor }, origin, secret)
    } catch (error) {
      return { ok: false as const, error: checkoutError(error) }
    }
  })

export const saveStoreReminder = createServerFn({ method: 'POST' })
  .validator((d: { productId: number; contentType: ContentType; contentId: number }) => {
    const c = validContent(d?.contentType, d?.contentId)
    if (typeof d?.productId !== 'number' || !Number.isSafeInteger(d.productId) || d.productId < 1) throw new Error('Unknown product.')
    return { ...c, productId: d.productId }
  })
  .handler(async ({ data }) => {
    writeOrigin()
    const user = await requireViewer()
    const mapped = await first<any>(`SELECT 1 AS yes FROM content_products WHERE content_type=? AND content_id=? AND product_id=?`, data.contentType, data.contentId, data.productId)
    if (!mapped) throw new Error('That product is not linked to this title.')
    await run(`INSERT INTO store_reminders(user_id, product_id, content_type, content_id) VALUES(?,?,?,?) ON CONFLICT(user_id, product_id, content_type, content_id) DO UPDATE SET status='pending', reminded_at=NULL`,
      user.id, data.productId, data.contentType, data.contentId)
    return { ok: true }
  })

export const getDueReminders = createServerFn({ method: 'GET' })
  .validator((d: { contentType: ContentType; contentId: number }) => validContent(d?.contentType, d?.contentId))
  .handler(async ({ data }) => {
    const viewer = await getActiveViewer()
    if (!viewer) return { reminders: [] as RecommendedProduct[] }
    const rows = await all<any>(`SELECT product_id FROM store_reminders WHERE user_id=? AND content_type=? AND content_id=? AND status='pending' ORDER BY id LIMIT 6`, viewer.userId, data.contentType, data.contentId)
    if (!rows.length) return { reminders: [] as RecommendedProduct[] }
    const ids = new Set(rows.map(r => Number(r.product_id)))
    const catalogue = await catalogueList()
    return { reminders: catalogue.filter(p => ids.has(p.id)).map(project) }
  })

export const dismissStoreReminders = createServerFn({ method: 'POST' })
  .validator((d: { contentType: ContentType; contentId: number; productIds: number[] }) => {
    const c = validContent(d?.contentType, d?.contentId)
    const productIds = Array.isArray(d?.productIds) ? d.productIds.filter(x => Number.isSafeInteger(x) && x > 0).slice(0, 12) : []
    if (!productIds.length) throw new Error('Nothing to dismiss.')
    return { ...c, productIds }
  })
  .handler(async ({ data }) => {
    writeOrigin()
    const user = await requireViewer()
    for (const productId of data.productIds) {
      await run(`UPDATE store_reminders SET status='dismissed', reminded_at=datetime('now') WHERE user_id=? AND content_type=? AND content_id=? AND product_id=?`, user.id, data.contentType, data.contentId, productId)
    }
    return { ok: true }
  })
