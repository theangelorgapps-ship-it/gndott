import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, getRequestHeader, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { first } from './db'
import { getActiveViewer } from './viewer.server'
import { STORE_ORIGIN, isPhysicalProduct, storeText, type StoreProduct } from './storeTypes'
const TOKEN = 'halobox_store_cart'
const API = `${STORE_ORIGIN}/wp-json/wc/store/v1`
const BRIDGE = `${STORE_ORIGIN}/wp-json/halobox-bridge/v1`
let catalogue: { until: number; products: StoreProduct[] } | undefined
function storeWriteOrigin() {
  if (getRequestHeader('origin') !== new URL(getRequestUrl()).origin || getRequestHeader('sec-fetch-site') === 'cross-site') throw new Error('Please retry from Halobox.')
  setResponseHeader('Cache-Control', 'private, no-store')
}
async function woo(path: string, body?: object, cart = false): Promise<any> {
  const headers = new Headers({ Accept: 'application/json' })
  let token = cart ? getCookie(TOKEN) : undefined
  if (cart && body && !token) {
    const initial = await fetch(`${API}/cart`, { signal: AbortSignal.timeout(15000), redirect: 'manual' })
    token = initial.headers.get('Cart-Token') || undefined
    if (!initial.ok || !token) throw new Error('Unable to start your cart. Please retry.')
  }
  if (cart && token) headers.set('Cart-Token', token)
  if (body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000), redirect: 'manual' })
  const result: any = await response.json()
  if (!response.ok) throw new Error(storeText(result?.message || 'The store is temporarily unavailable. Please try again.'))
  const nextToken = response.headers.get('Cart-Token')
  if (cart && (nextToken || token)) setCookie(TOKEN, (nextToken || token)!, { httpOnly: true, secure: new URL(getRequestUrl()).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 2 })
  return result
}
const CATALOGUE_TTL = 120000
// Never cache a server-function/HTML response: those can contain a viewer or cart.
// This key contains only a projection of the anonymous Woo public catalogue.
function catalogueCache() {
  return typeof caches === 'undefined' ? undefined : (caches as CacheStorage & { default?: Cache }).default
}
function catalogueProduct(p: StoreProduct): StoreProduct {
  return { id: p.id, name: p.name, slug: p.slug, type: p.type, is_purchasable: p.is_purchasable,
    is_in_stock: p.is_in_stock, has_options: p.has_options, prices: p.prices,
    images: p.images.map(({ id, src, alt }) => ({ id, src, alt })), categories: p.categories,
    extensions: { halobox_bridge: { physical: true } },
    description: '', short_description: '', permalink: '', attributes: [], variations: [] }
}
async function cataloguePage(page: number) {
  const fields = 'id,name,slug,type,is_purchasable,is_in_stock,has_options,images,prices,categories,extensions'
  const response = await fetch(`${API}/products?per_page=100&page=${page}&_fields=${fields}`, {
    headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Store catalogue connection unavailable.')
  const rows = await response.json() as StoreProduct[]
  if (!Array.isArray(rows) || rows.some(p => !p.extensions?.halobox_bridge)) throw new Error('Store catalogue connection unavailable.')
  const pages = Number(response.headers.get('X-WP-TotalPages'))
  return { rows, pages: Number.isSafeInteger(pages) && pages > 0 ? pages : undefined }
}
async function products(refresh = false) {
  if (!refresh && catalogue && catalogue.until > Date.now()) return catalogue.products
  const cache = catalogueCache()
  const key = new Request(new URL('/__halobox-store/public-catalogue-v3', getRequestUrl()).toString())
  if (!refresh && cache) {
    try {
      const cached = await cache.match(key)
      if (cached) {
        const value = await cached.json() as typeof catalogue
        if (value && value.until > Date.now() && Array.isArray(value.products) && value.products.every(isPhysicalProduct)) {
          catalogue = value
          return value.products
        }
      }
    } catch { /* A cache failure must not take the store offline. */ }
  }
  const firstPage = await cataloguePage(1)
  const rows = [...firstPage.rows]
  if (firstPage.pages) {
    if (firstPage.pages > 10) throw new Error('Store catalogue is too large. Please visit the original store.')
    // Fetch remaining pages in bounded batches instead of serial origin round trips.
    for (let page = 2; page <= firstPage.pages; page += 3) {
      const batch = await Promise.all(Array.from({ length: Math.min(3, firstPage.pages - page + 1) }, (_, index) => cataloguePage(page + index)))
      batch.forEach(part => rows.push(...part.rows))
    }
  } else {
    for (let page = 2, count = firstPage.rows.length; count === 100; page++) {
      if (page > 10) throw new Error('Store catalogue is too large. Please visit the original store.')
      const next = await cataloguePage(page)
      rows.push(...next.rows); count = next.rows.length
    }
  }
  catalogue = { until: Date.now() + CATALOGUE_TTL, products: rows.filter(isPhysicalProduct).map(catalogueProduct) }
  if (cache) {
    try { await cache.put(key, Response.json(catalogue, { headers: { 'Cache-Control': `public, max-age=${CATALOGUE_TTL / 1000}` } })) } catch { /* Optional acceleration only. */ }
  }
  return catalogue.products
}
const id = (v: unknown) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1) throw new Error('Invalid product.'); return v }
export const getStoreProducts = createServerFn({ method: 'GET' }).handler(async () => {
  try { return { products: await products(), error: null } } catch (error) { console.warn('Store catalogue:', error instanceof Error ? error.message : 'request failed'); return { products: [] as StoreProduct[], error: 'The shop is temporarily unavailable. Please try again.' } }
})
export const getStoreProduct = createServerFn({ method: 'GET' }).validator((value: number) => id(value)).handler(async ({ data }) => {
  const p = await woo(`/products/${data}`) as StoreProduct
  if (!isPhysicalProduct(p)) throw new Error('This product is not available in the Halobox shop.')
  return p
})
export const getStoreCart = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  if (!getCookie(TOKEN)) return { items: [], coupons: [], items_count: 0, totals: { total_items: '0', total_discount: '0', currency_code: 'GBP', currency_minor_unit: 2 } }
  return await woo('/cart', undefined, true)
})
export const updateStoreCart = createServerFn({ method: 'POST' }).validator((d: { action: 'add'|'update'|'remove'|'coupon'|'remove-coupon'; id?: number; key?: string; quantity?: number; variation?: { attribute: string; value: string }[]; code?: string }) => {
  if (!['add','update','remove','coupon','remove-coupon'].includes(d.action)) throw new Error('Invalid cart action.')
  if (['add','update'].includes(d.action) && (!Number.isInteger(d.quantity) || d.quantity! < 1 || d.quantity! > 20)) throw new Error('Choose a quantity from 1 to 20.')
  if (['update','remove'].includes(d.action) && (typeof d.key !== 'string' || !/^[a-f\d]{32}$/.test(d.key))) throw new Error('Invalid cart item.')
  if (d.action.includes('coupon') && (typeof d.code !== 'string' || !d.code.trim() || d.code.length > 100)) throw new Error('Enter a valid coupon.')
  return d
}).handler(async ({ data: d }) => {
  storeWriteOrigin()
  if (d.action === 'add') {
    const p = await woo(`/products/${id(d.id)}`) as StoreProduct
    if (!isPhysicalProduct(p) || !p.is_purchasable || !p.is_in_stock) throw new Error('This product is unavailable.')
    if (d.variation && (!Array.isArray(d.variation) || d.variation.length > 10 || d.variation.some(x => typeof x.attribute !== 'string' || typeof x.value !== 'string' || x.value.length > 100))) throw new Error('Choose valid product options.')
    return woo('/cart/add-item', { id: p.id, quantity: d.quantity, variation: d.variation || [] }, true)
  }
  if (d.action === 'update') return woo('/cart/update-item', { key: d.key, quantity: d.quantity }, true)
  if (d.action === 'remove') return woo('/cart/remove-item', { key: d.key }, true)
  return woo(`/cart/${d.action === 'coupon' ? 'apply-coupon' : 'remove-coupon'}`, { code: d.code?.trim() }, true)
})
async function bridge(path: string, payload: object) {
  const secret = (env as any).STORE_BRIDGE_PRIVATE_KEY
  if (typeof secret !== 'string' || !secret.includes('BEGIN PRIVATE KEY')) throw new Error('Store checkout is being connected. You can shop directly at uebertangel.org meanwhile.')
  const body = JSON.stringify(payload), timestamp = String(Math.floor(Date.now()/1000)), nonce = crypto.randomUUID()
  const der = Uint8Array.from(atob(secret.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${timestamp}\n${nonce}\n${path}\n${body}`))
  const signature = btoa(String.fromCharCode(...new Uint8Array(digest)))
  const r = await fetch(`${BRIDGE}${path}`, { method: 'POST', headers: { 'Content-Type':'application/json', 'X-Halobox-Time':timestamp, 'X-Halobox-Nonce':nonce, 'X-Halobox-Signature':signature }, body, redirect:'manual', signal:AbortSignal.timeout(15000) })
  const data:any = await r.json()
  if (!r.ok) throw new Error('The store connection is unavailable. Please try again shortly.')
  return data
}
export const startStoreCheckout = createServerFn({method:'POST'}).handler(async()=>{
  storeWriteOrigin()
  if (!getCookie(TOKEN)) throw new Error('Your cart is empty.')
  const cart = await woo('/cart', undefined, true)
  if (!cart.items?.length || cart.items.length > 40) throw new Error('Please review your cart.')
  const items = cart.items.map((x:any)=>({id:x.id,quantity:x.quantity}))
  const data = await bridge('/checkout', { items, coupons: (cart.coupons || []).map((x:any)=>x.code) })
  const target = new URL(data.checkout_url)
  if (target.origin !== STORE_ORIGIN || !target.searchParams.has('halobox_checkout')) throw new Error('Invalid checkout destination.')
  return { url:target.toString() }
})
async function admin() {
  setResponseHeader('Cache-Control','private, no-store')
  const a = await getActiveViewer()
  if (!a || !await first("SELECT id FROM users WHERE id=? AND user_type='admin' AND status=1 AND deleted_at IS NULL", a.userId)) throw new Error('Administrator access required.')
}
export const getStoreAdmin = createServerFn({method:'GET'}).handler(async()=>{
  await admin()
  let connection:any = {connected:false}, error=''
  try { connection = {connected:true,...await bridge('/status',{})} } catch(e) { error=e instanceof Error?e.message:'Connection unavailable.' }
  const list=await products().catch(()=>[])
  return { connection, error, productCount:list.length, origin:STORE_ORIGIN }
})
export const refreshStoreAdmin = createServerFn({method:'POST'}).handler(async()=>{ storeWriteOrigin();await admin(); return {count:(await products(true)).length} })
export const getStoreOrders = createServerFn({method:'GET'}).handler(async()=>{await admin();return await bridge('/orders',{}) as {orders:{id:number;status:string;total:string;currency:string;date:string;edit_url:string}[]} })
