import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { generateKeyPairSync, verify, webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, imports = {}, globals = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
  assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require: name => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name] }, URL, URLSearchParams, Headers, Response, Request, Error, AbortSignal, TextEncoder, Uint8Array, crypto: webcrypto, atob, btoa, ...globals }, { filename: path })
  return module.exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const types = load('src/lib/storeTypes.ts')
const product = (id, overrides = {}) => ({ id, name: 'Physical book', slug: 'physical-book', type: 'simple', description: '<p>Book</p>', short_description: '', permalink: `https://uebertangel.org/product/book-${id}/`, is_purchasable: true, is_in_stock: true, has_options: false, images: [{ id: 1, src: 'https://uebertangel.org/book.jpg', alt: 'Book' }], prices: { price: '2500', regular_price: '3000', currency_code: 'GBP', currency_minor_unit: 2 }, categories: [{ id: 1, name: 'Books', slug: 'books' }], attributes: [], variations: [], extensions: { halobox_bridge: { physical: true } }, ...overrides })
assert.equal(types.isPhysicalProduct(product(1)), true)
assert.equal(types.isPhysicalProduct(product(2, { extensions: { halobox_bridge: { physical: false } } })), false, 'Category membership cannot authorize digital goods')
assert.equal(types.isPhysicalProduct(product(3, { extensions: undefined })), false, 'Missing authoritative eligibility must fail closed')
assert.equal(types.isPhysicalProduct(product(4, { type: 'external' })), false)
assert.equal(types.storeText('<strong>Book &amp; Study</strong>'), 'Book & Study')
assert.equal(types.storeMoney('2500', 'GBP', 2), '£25.00')

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { format: 'pem', type: 'spki' }, privateKeyEncoding: { format: 'pem', type: 'pkcs8' } })
const origin = 'https://gndott.theangelorgapps.workers.dev'
const environment = { STORE_BRIDGE_PRIVATE_KEY: privateKey }
let requestOrigin = origin, fetchSite = 'same-origin', cookie, viewer = null, adminAllowed = false
let calls = [], cookies = [], responseHeaders = {}, payloads = [], quotePayloads = [], orderPayloads = [], failure = false
let shopProducts = [product(1), product(2, { extensions: { halobox_bridge: { physical: false } } }), product(5, { type: 'variable', has_options: true })]
let cart = { items: [], coupons: [], items_count: 0, totals: { total_items: '0', total_discount: '0', currency_code: 'GBP', currency_minor_unit: 2 } }
const key = 'a'.repeat(32)
const makeResponse = (data, status = 200, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => data })
async function mockedFetch(url, options = {}) {
  const u = new URL(url), headers = new Headers(options.headers)
  assert.equal(u.origin, 'https://uebertangel.org', 'Unexpected remote destination')
  assert.equal(options.redirect, 'manual', 'Cross-origin redirect must not forward authorization')
  assert.ok(options.signal, 'Remote fetch must be bounded')
  const body = options.body ? JSON.parse(options.body) : undefined
  calls.push({ path: u.pathname, method: options.method || 'GET', body, headers })
  if (failure) return makeResponse({ message: '<script>unsafe</script>Store unavailable' }, 503)
  if (u.pathname.startsWith('/wp-json/halobox-bridge/v1/')) {
    const path = u.pathname.replace('/wp-json/halobox-bridge/v1', '')
    const time = headers.get('X-Halobox-Time'), nonce = headers.get('X-Halobox-Nonce'), signature = headers.get('X-Halobox-Signature')
    assert.match(time, /^\d+$/); assert.match(nonce, /^[a-z0-9-]{36}$/i)
    assert.ok(Math.abs(Date.now() / 1000 - Number(time)) < 5)
    assert.equal(verify('RSA-SHA256', Buffer.from(`${time}\n${nonce}\n${path}\n${options.body}`), publicKey, Buffer.from(signature, 'base64')), true, 'Worker signature does not match the independent RSA verifier')
    assert.ok(!url.includes('PRIVATE') && !JSON.stringify(body).includes('PRIVATE KEY'), 'Private key leaked')
    payloads.push({ path, body, nonce })
    if (path === '/quote') {
      quotePayloads.push(body)
      const itemsTotal = body.items.reduce((sum, item) => sum + 2500 * item.quantity, 0) / 100
      const shipping = body.shipping_rate === 'express:2' ? 9.95 : 4.95
      return makeResponse({ quote_id: 'a'.repeat(64), currency: 'GBP', items_total: itemsTotal.toFixed(2), discount_total: '0.00', shipping_total: shipping.toFixed(2), tax_total: '0.00', total: (itemsTotal + shipping).toFixed(2), expires_in: 1800, shipping_rates: [
        { id: 'flat:1', label: 'Standard delivery', cost: '4.95', selected: body.shipping_rate !== 'express:2' },
        { id: 'express:2', label: 'Express delivery', cost: '9.95', selected: body.shipping_rate === 'express:2' },
      ] })
    }
    if (path === '/order') {
      assert.match(body.payment?.reference || '', /^(cs|pi)_[a-zA-Z0-9_]+$/, 'An order must reference a verified Stripe payment')
      orderPayloads.push(body)
      return makeResponse({ order: { id: 321, number: '321', status: 'processing', total: '84.95', currency: 'GBP' } })
    }
    if (path === '/checkout') assert.fail('The redirect handoff endpoint must not be used any more')
    if (path === '/status') return makeResponse({ version: '1.1.0', store_url: 'https://uebertangel.org' })
    if (path === '/orders') return makeResponse({ orders: [{ id: 321, number: '321', status: 'processing', total: '25.00', currency: 'GBP', date: '2026-11-08', edit_url: 'https://uebertangel.org/wp-admin/admin.php?page=wc-orders' }], summary: { count: 1, revenue: '25.00', revenue_30d: '25.00', currency: 'GBP' } })
    assert.fail('Unexpected bridge endpoint ' + path)
  }
  if (u.pathname === '/wp-json/wc/store/v1/products') {
    const page = Number(u.searchParams.get('page')); return makeResponse(shopProducts.slice((page - 1) * 100, page * 100), 200, { 'X-WP-TotalPages': String(Math.ceil(shopProducts.length / 100)) })
  }
  if (/\/products\/\d+$/.test(u.pathname)) return makeResponse(shopProducts.find(p => p.id === Number(u.pathname.split('/').pop())) || product(Number(u.pathname.split('/').pop())))
  if (u.pathname === '/wp-json/wc/store/v1/cart') return makeResponse(cart, 200, { 'Cart-Token': cookie || 'server-issued-token' })
  assert.equal(headers.get('Cart-Token'), cookie || 'server-issued-token', 'Guest cart token was not forwarded server-to-server')
  if (u.pathname.endsWith('/cart/add-item')) {
    assert.deepEqual(Object.keys(body).sort(), ['id', 'quantity', 'variation'], 'Client supplied price/total crossed the store boundary')
    const variation = body.id === 5
    cart = { items: [{ id: variation ? 6 : body.id, key, quantity: body.quantity, variation: body.variation, prices: { price: variation ? '3700' : '2500', currency_code: 'GBP', currency_minor_unit: 2 } }], coupons: [], items_count: body.quantity, totals: { total_items: String((variation ? 3700 : 2500) * body.quantity), total_discount: '0', currency_code: 'GBP', currency_minor_unit: 2 } }
  } else if (u.pathname.endsWith('/cart/update-item')) {
    assert.deepEqual(Object.keys(body).sort(), ['key', 'quantity']); assert.equal(body.key, key); cart.items[0].quantity = body.quantity
  } else if (u.pathname.endsWith('/cart/remove-item')) {
    assert.deepEqual(Object.keys(body), ['key']); cart.items = []; cart.items_count = 0
  } else if (u.pathname.endsWith('/cart/apply-coupon')) cart.coupons = [{ code: body.code }]
  else if (u.pathname.endsWith('/cart/remove-coupon')) cart.coupons = []
  else assert.fail('Unexpected Woo endpoint ' + u.pathname)
  return makeResponse(cart, 200, { 'Cart-Token': cookie || 'server-issued-token' })
}

// In-memory stand-in for the store_checkouts D1 table.
function fakeD1() {
  const rows = []
  return { rows, prepare(sql) { return { bind(...args) { return {
    async run() {
      if (sql.startsWith('INSERT INTO store_checkouts')) { rows.push({ id: args[0], user_id: args[1], email: args[2], quote_id: args[3], address: args[4], total_minor: args[5], currency: args[6], status: 'quoted', stripe_session_id: null, order_id: null }); return { meta: { changes: 1 } } }
      if (sql.includes('SET stripe_session_id')) { const row = rows.find(r => r.id === args[1] && r.stripe_session_id === null); if (row) { row.stripe_session_id = args[0]; row.status = 'pending' } return { meta: { changes: row ? 1 : 0 } } }
      if (sql.includes("SET status = 'paid'")) { const row = rows.find(r => r.id === args[1]); if (row) { row.status = 'paid'; row.order_id = args[0] } return { meta: { changes: row ? 1 : 0 } } }
      assert.fail('Unexpected SQL ' + sql)
    },
    async first() {
      if (sql.includes('WHERE id = ? AND user_id = ?')) return rows.find(r => r.id === args[0] && r.user_id === args[1]) ?? null
      if (sql.includes('WHERE stripe_session_id = ? AND user_id = ?')) return rows.find(r => r.stripe_session_id === args[0] && r.user_id === args[1]) ?? null
      if (sql.includes('WHERE stripe_session_id = ?')) return rows.find(r => r.stripe_session_id === args[0]) ?? null
      assert.fail('Unexpected SQL ' + sql)
    },
  } } } } }
}
const storeD1 = fakeD1()
let actor = null, stripeEnabled = true
const stripeCalls = []
let stripeSession = { id: 'cs_test_store1', url: 'https://checkout.stripe.com/pay/cs_test_store1', status: 'open', mode: 'payment' }
const subscriptionMock = {
  CheckoutError: class CheckoutError extends Error {},
  checkoutError: error => error instanceof Error ? error.message : 'Something went wrong. Please try again.',
  subscriptionActor: async () => actor,
  subscriptionWriteOrigin: () => { if (requestOrigin !== origin || fetchSite === 'cross-site') throw new Error('Please retry from Halobox.'); return origin },
  stripeConfiguration: async () => ({ db: storeD1, secret: 'sk_test_gate', enabled: stripeEnabled }),
  stripeRequest: async (path, secret, transport, body, idempotencyKey) => {
    assert.equal(secret, 'sk_test_gate')
    stripeCalls.push({ path, params: body ? Object.fromEntries(body) : undefined, key: idempotencyKey })
    if (path === '/checkout/sessions') return { id: stripeSession.id, url: stripeSession.url, status: 'open' }
    if (path === `/checkout/sessions/${stripeSession.id}`) return stripeSession
    assert.fail('Unexpected Stripe path ' + path)
  },
}
const storeBridge = load('src/lib/storeBridge.server.ts', { 'cloudflare:workers': { env: environment }, './storeTypes': types }, { fetch: mockedFetch })
const storeCheckout = load('src/lib/storeCheckout.server.ts', { './subscriptionCheckout.server': subscriptionMock, './storeBridge.server': storeBridge }, { fetch: () => { throw new Error('Store checkout must use the mocked Stripe transport') } })
const factory = { createServerFn() { let validate = value => value; return { validator(fn) { validate = fn; return this }, handler(fn) { return async (input = {}) => fn({ data: validate(input.data) }) } } } }
const imports = {
  '@tanstack/react-start': factory,
  '@tanstack/react-start/server': { getCookie: () => cookie, setCookie: (name, value, options) => { assert.equal(name, 'halobox_store_cart'); cookie = value; cookies.push(options) }, getRequestHeader: name => name === 'origin' ? requestOrigin : name === 'sec-fetch-site' ? fetchSite : undefined, getRequestUrl: () => origin + '/shop/checkout', setResponseHeader: (name, value) => { responseHeaders[name] = value } },
  './db': { first: async (sql, userId) => { assert.ok(sql.includes("user_type='admin'") && sql.includes('status=1') && sql.includes('deleted_at IS NULL')); return adminAllowed && userId === 42 ? { id: 42 } : null } },
  './viewer.server': { getActiveViewer: async () => viewer }, './storeTypes': types,
  './subscriptionCheckout.server': subscriptionMock,
  './storeCheckout.server': storeCheckout,
  './storeBridge.server': storeBridge,
}
const api = load('src/lib/store.ts', imports, { fetch: mockedFetch })
const invoke = (name, data) => api[name]({ data })
const invalid = async (name, data) => { const before = calls.length; await assert.rejects(invoke(name, data)); assert.equal(calls.length, before, name + ' performed an outbound request before rejection') }
for (const id of [0, -1, 1.1, '1', NaN]) await invalid('getStoreProduct', id)
for (const quantity of [0, -1, 21, 1.5, '2']) await invalid('updateStoreCart', { action: 'add', id: 1, quantity })
await invalid('updateStoreCart', { action: 'remove', key: '../item' })
await invalid('updateStoreCart', { action: 'coupon', code: ' ' })
requestOrigin = 'https://evil.test'; await invalid('updateStoreCart', { action: 'add', id: 1, quantity: 1 }); await invalid('startStoreCheckout', { checkoutId: 'x', requestKey: 'y', expectedTotalMinor: 1 }); await invalid('quoteStoreCheckout', { address: {} })
requestOrigin = undefined; await invalid('updateStoreCart', { action: 'coupon', code: 'BOOKS' })
requestOrigin = origin; fetchSite = 'cross-site'; await invalid('updateStoreCart', { action: 'add', id: 1, quantity: 1 }); fetchSite = 'same-origin'
const emptyCartCalls = calls.length
assert.equal((await api.getStoreCart()).items_count, 0)
assert.equal(calls.length, emptyCartCalls, 'A visitor without a cart cookie should see an empty cart without waiting for Woo')
assert.equal(cookie, undefined, 'Browsing must not create a remote shopping session')
const list = await api.getStoreProducts(); assert.equal(list.products.length, 2); assert.equal(list.error, null)
const cachedCalls = calls.length; await api.getStoreProducts(); assert.equal(calls.length, cachedCalls, 'Catalogue should use bounded cache')
// Cache only the anonymous catalogue; a new isolate can reuse it without sharing carts.
const sharedResponses = new Map()
const cacheBoundary = { match: async request => sharedResponses.get(request.url)?.clone(), put: async (request, response) => sharedResponses.set(request.url, response.clone()) }
const edgeGlobals = { fetch: mockedFetch, caches: { default: cacheBoundary } }
const firstIsolate = load('src/lib/store.ts', imports, edgeGlobals)
await firstIsolate.getStoreProducts()
assert.equal(sharedResponses.size, 1, 'Catalogue should survive isolate turnover using the public edge cache')
const afterFirstIsolate = calls.length
cookie = 'a-different-visitors-cart'
const nextIsolate = load('src/lib/store.ts', imports, edgeGlobals)
assert.equal((await nextIsolate.getStoreProducts()).products.length, 2)
assert.equal(calls.length, afterFirstIsolate, 'A fresh isolate must not download the same catalogue again')
assert.ok(calls.filter(c => c.path.endsWith('/products')).every(c => !c.headers.has('Cart-Token') && !c.headers.has('Cookie') && !c.headers.has('Authorization')))
for (const response of sharedResponses.values()) {
  assert.equal(response.headers.has('Set-Cookie'), false)
  assert.ok(!(await response.clone().text()).includes(cookie), 'Cart tokens must never enter shared cache values')
}
// A different customer still gets the live cart, and catalogue expiry refetches.
const [cachedKey, cachedResponse] = [...sharedResponses.entries()][0]
const expired = await cachedResponse.clone().json()
expired.until = 0
sharedResponses.set(cachedKey, Response.json(expired))
const expiredIsolate = load('src/lib/store.ts', imports, edgeGlobals)
const beforeExpiry = calls.length
await expiredIsolate.getStoreProducts()
assert.ok(calls.length > beforeExpiry, 'Expired public catalogue must be refreshed')
await nextIsolate.getStoreCart()
assert.equal(calls.at(-1).headers.get('Cart-Token'), cookie, 'Cached catalogue must not replace private cart reads')
assert.equal(sharedResponses.size, 1, 'Cart responses must not be cached')
cookie = undefined

await assert.rejects(invoke('getStoreProduct', 2), /not available/)
await assert.rejects(invoke('updateStoreCart', { action: 'add', id: 2, quantity: 1 }), /unavailable/)
const added = await invoke('updateStoreCart', { action: 'add', id: 5, quantity: 2, variation: [{ attribute: 'pa_size', value: 'large' }], price: 1, total: 1 })
assert.equal(added.items[0].id, 6, 'Resolved variation ID must come from Woo')
assert.equal(added.totals.total_items, '7400'); assert.equal(cookie, 'server-issued-token')
assert.ok(cookies.every(c => c.httpOnly && c.secure && c.sameSite === 'lax' && c.maxAge <= 172800))
assert.equal(responseHeaders['Cache-Control'], 'private, no-store')
await invoke('updateStoreCart', { action: 'update', key, quantity: 3, price: 1 }); assert.equal(cart.items[0].quantity, 3)
await invoke('updateStoreCart', { action: 'coupon', code: ' BOOKS ' }); assert.equal(cart.coupons[0].code, 'BOOKS')

// In-site checkout: sign-in gate, bridge quote, Stripe session, Woo order.
const validAddress = { first_name: 'Ada', last_name: 'Lovelace', address_1: '1 Halo Way', address_2: '', city: 'London', state: '', postcode: 'N1 9GU', country: 'GB', phone: '' }
const anonymous = await invoke('quoteStoreCheckout', { address: validAddress })
assert.equal(anonymous.ok, false); assert.equal(anonymous.needsAuth, true)
assert.equal(quotePayloads.length, 0, 'Anonymous visitors must not reach the bridge quote')
const buyer = { id: 7, email: 'buyer@example.com' }
actor = buyer
const badCountry = await invoke('quoteStoreCheckout', { address: { ...validAddress, country: 'Atlantis' } })
assert.equal(badCountry.ok, false); assert.match(badCountry.error, /country/i)
const noPostcode = await invoke('quoteStoreCheckout', { address: { ...validAddress, postcode: ' ' } })
assert.equal(noPostcode.ok, false); assert.match(noPostcode.error, /postcode/i)
const quoted = await invoke('quoteStoreCheckout', { address: validAddress })
assert.equal(quoted.ok, true); assert.match(quoted.checkoutId, /^[a-f0-9-]{36}$/)
assert.deepEqual(plain(quotePayloads.at(-1)), { items: [{ id: 6, quantity: 3 }], coupons: ['BOOKS'], address: validAddress }, 'The quote must use server cart contents and the cleaned address, never client prices')
assert.equal(storeD1.rows.length, 1); assert.equal(storeD1.rows[0].status, 'quoted'); assert.equal(storeD1.rows[0].total_minor, 7995)
await invoke('quoteStoreCheckout', { address: validAddress }); assert.notEqual(payloads.at(-1).nonce, payloads.at(-2).nonce, 'Every bridge call must carry a fresh nonce')
const express = await invoke('quoteStoreCheckout', { address: validAddress, shippingRate: 'express:2' })
assert.equal(express.quote.shipping_total, '9.95'); assert.equal(quotePayloads.at(-1).shipping_rate, 'express:2')
const expressMinor = 8495
// The pay step refuses tampered totals, keys and other people's checkouts before touching Stripe.
let stripeCount = stripeCalls.length
const badTotal = await invoke('startStoreCheckout', { checkoutId: express.checkoutId, requestKey: webcrypto.randomUUID(), expectedTotalMinor: expressMinor + 1 })
assert.equal(badTotal.ok, false); assert.match(badTotal.error, /total has changed/i); assert.equal(stripeCalls.length, stripeCount)
const badKey = await invoke('startStoreCheckout', { checkoutId: express.checkoutId, requestKey: 'not-a-uuid', expectedTotalMinor: expressMinor })
assert.equal(badKey.ok, false); assert.equal(stripeCalls.length, stripeCount)
actor = { id: 8, email: 'intruder@example.com' }
const stolen = await invoke('startStoreCheckout', { checkoutId: express.checkoutId, requestKey: webcrypto.randomUUID(), expectedTotalMinor: expressMinor })
assert.equal(stolen.ok, false); assert.match(stolen.error, /expired/i); assert.equal(stripeCalls.length, stripeCount)
actor = buyer
stripeEnabled = false
const disabled = await invoke('startStoreCheckout', { checkoutId: express.checkoutId, requestKey: webcrypto.randomUUID(), expectedTotalMinor: expressMinor })
assert.equal(disabled.ok, false); assert.match(disabled.error, /unavailable/i); assert.equal(stripeCalls.length, stripeCount)
stripeEnabled = true
const pay = await invoke('startStoreCheckout', { checkoutId: express.checkoutId, requestKey: webcrypto.randomUUID(), expectedTotalMinor: expressMinor })
assert.equal(pay.ok, true); assert.equal(pay.checkoutUrl, 'https://checkout.stripe.com/pay/cs_test_store1')
const create = stripeCalls.at(-1)
assert.equal(create.path, '/checkout/sessions')
assert.equal(create.key, `halobox-store-${express.checkoutId}`, 'Stripe session creation must be idempotent per checkout')
assert.equal(create.params['metadata[purpose]'], 'halobox_store_order')
assert.equal(create.params['metadata[checkout_id]'], express.checkoutId)
assert.equal(create.params['metadata[user_id]'], '7')
assert.equal(create.params['metadata[quote_id]'], 'a'.repeat(64))
assert.equal(create.params['line_items[0][price_data][unit_amount]'], '8495')
assert.equal(create.params['line_items[0][price_data][currency]'], 'gbp')
assert.equal(create.params.success_url, origin + '/payment-success?session_id={CHECKOUT_SESSION_ID}')
assert.equal(create.params.cancel_url, origin + '/shop/checkout?cancelled=1')
assert.equal(create.params.customer_email, 'buyer@example.com')
assert.equal(storeD1.rows.find(r => r.id === express.checkoutId).status, 'pending')
const resumed = await invoke('startStoreCheckout', { checkoutId: express.checkoutId, requestKey: webcrypto.randomUUID(), expectedTotalMinor: expressMinor })
assert.equal(resumed.checkoutUrl, 'https://checkout.stripe.com/pay/cs_test_store1')
assert.equal(stripeCalls.filter(c => c.path === '/checkout/sessions' && c.params).length, 1, 'An open Stripe session must be resumed, not recreated')
// Fulfilment: only a verified, fully matching paid session creates the Woo order — once.
stripeSession = { id: 'cs_test_store1', status: 'complete', mode: 'payment', payment_status: 'paid', amount_total: expressMinor, currency: 'gbp', client_reference_id: '7', payment_intent: 'pi_store1', metadata: { purpose: 'halobox_store_order', checkout_id: express.checkoutId, user_id: '7', quote_id: 'a'.repeat(64) } }
await assert.rejects(storeCheckout.fulfillStoreOrder(storeD1, { ...stripeSession, amount_total: expressMinor + 100 }), /amount/i)
await assert.rejects(storeCheckout.fulfillStoreOrder(storeD1, { ...stripeSession, metadata: { ...stripeSession.metadata, purpose: 'halobox_subscription' } }), /match/i)
await assert.rejects(storeCheckout.fulfillStoreOrder(storeD1, { ...stripeSession, payment_status: 'unpaid' }), /not completed/i)
await assert.rejects(storeCheckout.fulfillStoreOrder(storeD1, { ...stripeSession, id: 'cs_test_other' }), /could not be found/i)
assert.equal(orderPayloads.length, 0, 'No order may be filed before payment verification passes')
const fulfilled = await storeCheckout.fulfillStoreOrder(storeD1, stripeSession)
assert.equal(fulfilled.orderId, 321); assert.equal(fulfilled.orderNumber, '321')
const orderCall = orderPayloads.at(-1)
assert.equal(orderCall.quote_id, 'a'.repeat(64))
assert.deepEqual(plain(orderCall.payment), { gateway: 'stripe', reference: 'pi_store1', amount: '84.95', currency: 'GBP' })
assert.equal(orderCall.customer.email, 'buyer@example.com')
assert.equal(orderCall.billing.postcode, 'N1 9GU')
assert.equal(storeD1.rows.find(r => r.id === express.checkoutId).status, 'paid')
const again = await storeCheckout.fulfillStoreOrder(storeD1, stripeSession)
assert.equal(again.already, true); assert.equal(orderPayloads.length, 1, 'A repeated Stripe webhook must not create a second order')
const repaid = await invoke('startStoreCheckout', { checkoutId: express.checkoutId, requestKey: webcrypto.randomUUID(), expectedTotalMinor: expressMinor })
assert.equal(repaid.already, true); assert.equal(repaid.orderId, 321)
// The Stripe webhook and the success page both route store sessions to store fulfilment.
const seam = readFileSync(new URL('../src/lib/subscriptionCheckout.server.ts', import.meta.url), 'utf8')
assert.ok(seam.includes('halobox_store_order') && seam.includes('fulfillStoreOrder'), 'The webhook must route store sessions to store fulfilment')
assert.ok(readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8').includes('confirmStoreCheckout'), 'The success page must confirm store checkouts')
assert.ok(readFileSync(new URL('../migrations/20261110_store_checkout.sql', import.meta.url), 'utf8').includes('store_checkouts'), 'The checkout snapshot migration must ship with the feature')
// Without the bridge key every checkout step fails closed before any outbound call.
const savedKey = environment.STORE_BRIDGE_PRIVATE_KEY; delete environment.STORE_BRIDGE_PRIVATE_KEY
const bridgeCount = payloads.length
const noKey = await invoke('quoteStoreCheckout', { address: validAddress })
assert.equal(noKey.ok, false); assert.match(noKey.error, /connected/); assert.equal(payloads.length, bridgeCount)
environment.STORE_BRIDGE_PRIVATE_KEY = savedKey
await invoke('updateStoreCart', { action: 'remove-coupon', code: 'BOOKS' }); assert.equal(cart.coupons.length, 0)
await invoke('updateStoreCart', { action: 'remove', key })
const emptyQuote = await invoke('quoteStoreCheckout', { address: validAddress })
assert.equal(emptyQuote.ok, false); assert.match(emptyQuote.error, /empty/i)
actor = null
for (const name of ['getStoreAdmin', 'getStoreOrders', 'refreshStoreAdmin']) await invalid(name)
viewer = { userId: 5, profileId: 51 }; for (const name of ['getStoreAdmin', 'getStoreOrders', 'refreshStoreAdmin']) await invalid(name)
viewer = { userId: 42, profileId: 421 }; adminAllowed = true
assert.equal((await api.getStoreAdmin()).connection.connected, true)
const adminOrders = await api.getStoreOrders()
assert.equal(adminOrders.orders[0].id, 321); assert.equal(adminOrders.summary.revenue, '25.00', 'The dashboard must show bridge revenue metrics')
requestOrigin = 'https://evil.test'; await invalid('refreshStoreAdmin'); requestOrigin = origin
shopProducts = Array.from({ length: 101 }, (_, i) => product(i + 100)); assert.equal((await api.refreshStoreAdmin()).count, 101, 'Pagination lost products beyond page one')
shopProducts = [product(1, { extensions: undefined })]; await assert.rejects(api.refreshStoreAdmin(), /connection/)
const unavailableApi = load('src/lib/store.ts', imports, { fetch: mockedFetch }); const unavailable = await unavailableApi.getStoreProducts(); assert.equal(unavailable.products.length, 0); assert.ok(unavailable.error)
failure = true; const failureApi = load('src/lib/store.ts', imports, { fetch: mockedFetch }); assert.ok((await failureApi.getStoreProducts()).error); cookie = 'existing-cart-token'; await assert.rejects(failureApi.getStoreCart(), error => !error.message.includes('<script>')); failure = false
const php = spawnSync('php', [fileURLToPath(new URL('../plugins/halobox-store-bridge/test-bridge.php', import.meta.url))], { encoding: 'utf8', timeout: 20000 })
assert.equal(php.status, 0, php.stderr + php.stdout); assert.match(php.stdout, /STORE_PHP_BRIDGE_PASS/)
// Placement regression: a provider mounted only under /shop cannot leak a floating cart onto video pages.
const layout = readFileSync(new URL('../src/routes/shop.tsx', import.meta.url), 'utf8')
assert.ok(layout.includes('<StoreCartProvider>'))
assert.ok(!readFileSync(new URL('../src/routes/__root.tsx', import.meta.url), 'utf8').includes('<StoreCartProvider>'))
// Execute the real product form handlers: global attributes use slugs; custom ones preserve case.
let states = [], stateIndex = 0, submitted, updateOk = true
const jsx = (type, props, key) => ({ type, props, key })
const react = { useState(initial) { const slot = stateIndex++; if (!(slot in states)) states[slot] = initial; return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }] } }
const formProduct = product(5, { type: 'variable', has_options: true, attributes: [
  { name: 'Size', taxonomy: 'pa_size', has_variations: true, terms: [{ name: 'Large', slug: 'large' }] },
  { name: 'Logo', taxonomy: null, has_variations: true, terms: [{ name: 'Yes', slug: 'yes' }] },
] })
const productRoute = load('src/routes/shop.$slug.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, react,
  '@tanstack/react-router': { createFileRoute: () => config => ({ ...config, useLoaderData: () => formProduct }), Link: 'a' },
  'lucide-react': { Check: 'svg', ShoppingBag: 'svg', Truck: 'svg', ShieldCheck: 'svg' },
  '../lib/store': { getStoreProduct() {} }, '../lib/storeTypes': types,
  '@/components/Poster': { img: value => value },
  '../components/StorePurchaseBar': { StorePurchaseBar: 'aside', StoreLoading: 'section' },
  '../components/StoreCart': { StoreCartActions: 'div', useStoreCart: () => ({ update: async data => { submitted = data; return updateOk }, busy: false, error: '' }) },
})
const content = productRoute.Route.component(); assert.equal(content.key, formProduct.id, 'Product navigation must reset selected variant/image state')
const renderForm = () => { stateIndex = 0; return content.type(content.props) }
const find = (tree, predicate) => !tree || typeof tree !== 'object' ? undefined : Array.isArray(tree) ? tree.map(child => find(child, predicate)).find(Boolean) : predicate(tree) ? tree : find(tree.props?.children, predicate)
const findAll = (tree, predicate, out = []) => { if (!tree || typeof tree !== 'object') return out; if (Array.isArray(tree)) { tree.forEach(child => findAll(child, predicate, out)); return out } if (predicate(tree)) out.push(tree); findAll(tree.props?.children, predicate, out); return out }
let tree = renderForm(); assert.equal(find(tree, node => node.type === 'button' && node.props.className === 'btn btn-primary').props.disabled, true)
find(tree, node => node.type === 'button' && node.props.children === 'Large').props.onClick(); tree = renderForm()
find(tree, node => node.type === 'button' && node.props.children === 'Yes').props.onClick(); tree = renderForm()
assert.equal(find(tree, node => node.type === 'button' && node.props.className === 'btn btn-primary').props.disabled, false)
await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
assert.deepEqual(plain(submitted.variation), [{ attribute: 'pa_size', value: 'large' }, { attribute: 'Logo', value: 'Yes' }], 'Custom product attribute values must retain their exact Woo option text')
tree = renderForm()
assert.ok(find(tree, node => node.type === 'button' && node.props.className === 'btn btn-primary').props.children.includes('Added to cart'))
find(tree, node => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value: '0' } })
tree = renderForm()
assert.equal(find(tree, node => node.type === 'button' && node.props.className === 'btn btn-primary').props.disabled, true, 'Invalid quantities cannot be submitted from the purchase bar')
submitted = undefined
await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
assert.equal(submitted, undefined, 'Submit handler must also guard invalid quantities')
find(tree, node => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value: '2' } })
tree = renderForm()
assert.ok(!find(tree, node => node.type === 'button' && node.props.className === 'btn btn-primary').props.children.includes('Added to cart'), 'Quantity edits must clear the previous success state')
updateOk = false
await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
tree = renderForm()
assert.ok(!find(tree, node => node.type === 'button' && node.props.className === 'btn btn-primary').props.children.includes('Added to cart'), 'Rejected cart updates must not claim success')
formProduct.is_in_stock = false
submitted = undefined
tree = renderForm()
await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
assert.equal(submitted, undefined, 'Sold-out products cannot be submitted')

// Real cart provider handlers at the server-function transport seam: no remote cart is mutated.
let slots = [], slotIndex = 0, effects = [], firstRender = true, finishRead, finishWrite, writeCount = 0, writeFails = false
const providerReact = {
  createContext: () => ({ Provider: 'provider' }), useContext: () => {}, useCallback: fn => fn,
  useState(initial) { const index = slotIndex++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
  useRef(initial) { const index = slotIndex++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
  useEffect(effect) { if (firstRender) effects.push(effect) },
}
const providerModule = load('src/components/StoreCart.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, react: providerReact,
  '@tanstack/react-router': { Link: 'a', useRouterState: ({ select }) => select({ location: { pathname: '/shop' } }) },
  'lucide-react': { X: 'svg', ShoppingBag: 'svg', ArrowRight: 'svg' },
  '@/lib/imageUrls': { img: value => value }, '../lib/storeTypes': types,
  './StorePurchaseBar': { StorePurchaseBar: 'aside' },
  '../lib/store': {
    getStoreCart: () => new Promise(resolve => { finishRead = resolve }),
    updateStoreCart: async () => { writeCount++; if (writeFails) throw Error('Stock changed. Please retry.'); return new Promise(resolve => { finishWrite = resolve }) },
  },
})
const renderProvider = () => { slotIndex = 0; const tree = providerModule.StoreCartProvider({ children: null }); firstRender = false; return tree.props.value }
let provider = renderProvider()
effects.forEach(effect => effect())
const firstWrite = provider.update({ action: 'add', id: 1, quantity: 2 })
assert.equal(await provider.update({ action: 'add', id: 1, quantity: 2 }), false, 'A second click during the same update must be ignored')
assert.equal(writeCount, 1)
finishWrite({ items: [{ key, name: 'Book', quantity: 2, prices: { price: '2500', currency_code: 'GBP', currency_minor_unit: 2 }, totals: { line_total: '5000' } }], items_count: 2, totals: { total_items: '5000', currency_code: 'GBP', currency_minor_unit: 2 } })
assert.equal(await firstWrite, true)
finishRead({ items: [], items_count: 0 }); await new Promise(resolve => setTimeout(resolve, 0))
provider = renderProvider()
assert.equal(provider.cart.items_count, 2, 'A late initial cart response must not overwrite a successful add')
assert.equal(provider.open, true)
writeFails = true
assert.equal(await provider.update({ action: 'add', id: 1, quantity: 2 }), false)
provider = renderProvider()
assert.equal(provider.cart.items_count, 2, 'A failed add must retain the last authoritative cart')
assert.match(provider.error, /Stock changed/)

// Checkout page: sign-in gate, address → bridge quote, shipping choice, locked Stripe redirect.
let checkoutSlots = [], checkoutIndex = 0, checkoutViewer = null, checkoutQuoteResult, finishPay, quoteRequests = [], payRequests = [], checkoutUpdates = 0, assigned = []
const checkoutCart = { items: [{ key, id: 6, name: 'Book', quantity: 2, variation: [], images: [{ src: 'https://uebertangel.org/book.jpg' }], prices: { price: '2500', currency_code: 'GBP', currency_minor_unit: 2 }, totals: { line_total: '5000' } }], coupons: [], items_count: 2, totals: { total_items: '5000', total_discount: '0', currency_code: 'GBP', currency_minor_unit: 2 } }
const checkoutReact = {
  useState(initial) { const index = checkoutIndex++; if (!(index in checkoutSlots)) checkoutSlots[index] = typeof initial === 'function' ? initial() : initial; return [checkoutSlots[index], value => { checkoutSlots[index] = typeof value === 'function' ? value(checkoutSlots[index]) : value }] },
  useRef(initial) { const index = checkoutIndex++; if (!(index in checkoutSlots)) checkoutSlots[index] = { current: initial }; return checkoutSlots[index] },
  useEffect() {},
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const checkoutRoute = load('src/routes/shop.checkout.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, react: checkoutReact,
  '@tanstack/react-router': { createFileRoute: () => config => Object.assign(config, { useLoaderData: () => ({ viewer: checkoutViewer }), useSearch: () => ({}) }), Link: 'a' },
  'lucide-react': { ArrowRight: 'svg', LockKeyhole: 'svg', ShoppingBag: 'svg', Trash2: 'svg' },
  '@/components/Poster': { img: value => value }, '../lib/storeTypes': types,
  '../components/StorePurchaseBar': { StorePurchaseBar: 'aside' },
  '../components/StoreCart': { useStoreCart: () => ({ cart: checkoutCart, busy: false, error: '', update: async () => { checkoutUpdates++; return true }, refresh() {} }) },
  '../lib/store': {
    quoteStoreCheckout: async request => { quoteRequests.push(request.data); return checkoutQuoteResult },
    startStoreCheckout: request => { payRequests.push(request.data); return new Promise(resolve => { finishPay = resolve }) },
  },
  '../lib/api': { getSessionUser: async () => null },
}, { window: { location: { assign: url => assigned.push(url) } } })
const renderCheckout = () => { checkoutIndex = 0; return checkoutRoute.Route.component() }
let checkoutTree = renderCheckout()
assert.equal(find(checkoutTree, node => node.type === 'h1').props.children, 'Sign in to check out.', 'Checkout must require a Halobox account')
assert.equal(quoteRequests.length, 0)
checkoutViewer = { id: 7, email: 'buyer@example.com', first_name: 'Ada', last_name: 'Lovelace' }
checkoutQuoteResult = { ok: false, needsAuth: true, error: 'Sign in to check out.' }
const setField = (autoComplete, value) => find(checkoutTree, node => node.type === 'input' && node.props.autoComplete === autoComplete).props.onChange({ target: { value } })
checkoutTree = renderCheckout()
setField('address-1', '1 Halo Way'); setField('city', 'London'); setField('postcode', 'N1 9GU')
checkoutTree = renderCheckout()
find(checkoutTree, node => node.type === 'form' && node.props.className === 'store-address').props.onSubmit({ preventDefault() {} })
await flush()
assert.equal(quoteRequests.length, 1)
assert.equal(quoteRequests[0].address.address_1, '1 Halo Way')
assert.equal(quoteRequests[0].address.country, 'GB')
checkoutTree = renderCheckout()
assert.equal(find(checkoutTree, node => node.props?.role === 'alert')?.props.children, 'Sign in to check out.')
checkoutQuoteResult = { ok: true, checkoutId: '11111111-2222-4333-8444-555555555555', quote: { quote_id: 'a'.repeat(64), currency: 'GBP', items_total: '50.00', discount_total: '0.00', shipping_total: '4.95', tax_total: '0.00', total: '54.95', shipping_rates: [{ id: 'flat:1', label: 'Standard', cost: '4.95', selected: true }, { id: 'express:2', label: 'Express', cost: '9.95', selected: false }] } }
find(checkoutTree, node => node.type === 'form' && node.props.className === 'store-address').props.onSubmit({ preventDefault() {} })
await flush()
checkoutTree = renderCheckout()
const rates = findAll(checkoutTree, node => node.type === 'input' && node.props.name === 'shipping-rate')
assert.equal(rates.length, 2, 'Quoted shipping rates must be offered for selection')
rates[1].props.onChange(); await flush()
assert.equal(quoteRequests[2].shippingRate, 'express:2', 'Choosing a rate must re-quote through the store')
checkoutTree = renderCheckout()
const payButton = find(checkoutTree, node => node.type === 'button' && node.props.className === 'btn btn-primary' && String(node.props.children).includes('Pay securely'))
payButton.props.onClick(); payButton.props.onClick()
assert.equal(payRequests.length, 1, 'Double clicks must only start one payment')
assert.equal(payRequests[0].checkoutId, '11111111-2222-4333-8444-555555555555')
assert.equal(payRequests[0].expectedTotalMinor, 5495)
assert.match(payRequests[0].requestKey, /^[a-f0-9-]{36}$/)
checkoutTree = renderCheckout()
find(checkoutTree, node => node.type === 'select' && Array.isArray(node.props.children) && node.props.children.length === 20).props.onChange({ target: { value: '3' } })
find(checkoutTree, node => node.type === 'button' && node.props.className === 'store-remove').props.onClick()
assert.equal(checkoutUpdates, 0, 'Cart edits must be locked while the payment is being prepared')
finishPay({ ok: true, checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_store1' })
await flush()
assert.deepEqual(assigned, ['https://checkout.stripe.com/pay/cs_test_store1'], 'A paid quote must hand off to the hosted Stripe page')
checkoutQuoteResult = { ok: false, error: 'The total has changed. Review the updated total before paying.' }
console.log('STORE_BRIDGE_PASS')
