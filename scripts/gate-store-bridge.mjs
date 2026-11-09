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
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require: name => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name] }, URL, Headers, Response, Request, Error, AbortSignal, TextEncoder, Uint8Array, crypto: webcrypto, atob, btoa, ...globals }, { filename: path })
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
let calls = [], cookies = [], responseHeaders = {}, payloads = [], checkoutUrl = 'https://uebertangel.org/?halobox_checkout=' + 'a'.repeat(64), failure = false
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
    if (path === '/checkout') return makeResponse({ checkout_url: checkoutUrl, expires_in: 300 })
    if (path === '/status') return makeResponse({ version: '1.0.0', store_url: 'https://uebertangel.org' })
    if (path === '/orders') return makeResponse({ orders: [{ id: 321, status: 'processing', total: '25.00', currency: 'GBP', date: '2026-11-08', edit_url: 'https://uebertangel.org/wp-admin/admin.php?page=wc-orders' }] })
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
const factory = { createServerFn() { let validate = value => value; return { validator(fn) { validate = fn; return this }, handler(fn) { return async (input = {}) => fn({ data: validate(input.data) }) } } } }
const imports = {
  '@tanstack/react-start': factory,
  '@tanstack/react-start/server': { getCookie: () => cookie, setCookie: (name, value, options) => { assert.equal(name, 'halobox_store_cart'); cookie = value; cookies.push(options) }, getRequestHeader: name => name === 'origin' ? requestOrigin : name === 'sec-fetch-site' ? fetchSite : undefined, getRequestUrl: () => origin + '/shop/checkout', setResponseHeader: (name, value) => { responseHeaders[name] = value } },
  'cloudflare:workers': { env: environment },
  './db': { first: async (sql, userId) => { assert.ok(sql.includes("user_type='admin'") && sql.includes('status=1') && sql.includes('deleted_at IS NULL')); return adminAllowed && userId === 42 ? { id: 42 } : null } },
  './viewer.server': { getActiveViewer: async () => viewer }, './storeTypes': types,
}
const api = load('src/lib/store.ts', imports, { fetch: mockedFetch })
const invoke = (name, data) => api[name]({ data })
const invalid = async (name, data) => { const before = calls.length; await assert.rejects(invoke(name, data)); assert.equal(calls.length, before, name + ' performed an outbound request before rejection') }
for (const id of [0, -1, 1.1, '1', NaN]) await invalid('getStoreProduct', id)
for (const quantity of [0, -1, 21, 1.5, '2']) await invalid('updateStoreCart', { action: 'add', id: 1, quantity })
await invalid('updateStoreCart', { action: 'remove', key: '../item' })
await invalid('updateStoreCart', { action: 'coupon', code: ' ' })
requestOrigin = 'https://evil.test'; await invalid('updateStoreCart', { action: 'add', id: 1, quantity: 1 }); await invalid('startStoreCheckout')
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
const handoff = await api.startStoreCheckout(); assert.equal(handoff.url, checkoutUrl)
assert.deepEqual(plain(payloads.at(-1).body), { items: [{ id: 6, quantity: 3 }], coupons: ['BOOKS'] }, 'Handoff must use server cart IDs/quantities and omit client prices/variant guesses')
await api.startStoreCheckout(); assert.notEqual(payloads.at(-1).nonce, payloads.at(-2).nonce)
for (const bad of ['https://evil.test/?halobox_checkout=x', 'https://uebertangel.org.evil.test/?halobox_checkout=x', 'http://uebertangel.org/?halobox_checkout=x', 'https://uebertangel.org/checkout/']) { checkoutUrl = bad; await assert.rejects(api.startStoreCheckout(), /destination/) }
checkoutUrl = handoff.url
const savedKey = environment.STORE_BRIDGE_PRIVATE_KEY; delete environment.STORE_BRIDGE_PRIVATE_KEY; const bridgeCount = payloads.length; await assert.rejects(api.startStoreCheckout(), /connected/); assert.equal(payloads.length, bridgeCount); environment.STORE_BRIDGE_PRIVATE_KEY = savedKey
await invoke('updateStoreCart', { action: 'remove-coupon', code: 'BOOKS' }); assert.equal(cart.coupons.length, 0)
await invoke('updateStoreCart', { action: 'remove', key }); await assert.rejects(api.startStoreCheckout(), /review/)
cookie = undefined; await invalid('startStoreCheckout')
for (const name of ['getStoreAdmin', 'getStoreOrders', 'refreshStoreAdmin']) await invalid(name)
viewer = { userId: 5, profileId: 51 }; for (const name of ['getStoreAdmin', 'getStoreOrders', 'refreshStoreAdmin']) await invalid(name)
viewer = { userId: 42, profileId: 421 }; adminAllowed = true
assert.equal((await api.getStoreAdmin()).connection.connected, true)
assert.equal((await api.getStoreOrders()).orders[0].id, 321)
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
// Checkout handoff locks cart edits until it succeeds or fails.
let checkoutSlots = [], checkoutIndex = 0, finishCheckout, checkoutUpdates = 0, checkoutRequests = 0
const checkoutReact = {
  useState(initial) { const index = checkoutIndex++; if (!(index in checkoutSlots)) checkoutSlots[index] = initial; return [checkoutSlots[index], value => { checkoutSlots[index] = value }] },
  useRef(initial) { const index = checkoutIndex++; if (!(index in checkoutSlots)) checkoutSlots[index] = { current: initial }; return checkoutSlots[index] },
}
const checkoutRoute = load('src/routes/shop.checkout.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, react: checkoutReact,
  '@tanstack/react-router': { createFileRoute: () => config => config, Link: 'a' },
  'lucide-react': { ArrowRight: 'svg', LockKeyhole: 'svg', ShoppingBag: 'svg', Trash2: 'svg' },
  '@/components/Poster': { img: value => value }, '../lib/storeTypes': types,
  '../components/StorePurchaseBar': { StorePurchaseBar: 'aside' },
  '../components/StoreCart': { useStoreCart: () => ({ cart: { ...provider.cart, coupons: [] }, busy: false, error: '', update: async () => { checkoutUpdates++; return true }, refresh() {} }) },
  '../lib/store': { startStoreCheckout: () => { checkoutRequests++; return new Promise(resolve => { finishCheckout = resolve }) } },
}, { window: { location: { assign() {} } } })
const renderCheckout = () => { checkoutIndex = 0; return checkoutRoute.Route.component() }
let checkoutTree = renderCheckout()
find(checkoutTree, node => node.type === 'input' && node.props['aria-label'] === 'Store coupon code').props.onChange({ target: { value: 'SAVE' } })
checkoutTree = renderCheckout()
const checkoutButton = find(checkoutTree, node => node.type === 'button' && node.props.className === 'btn btn-primary')
checkoutButton.props.onClick(); checkoutButton.props.onClick()
assert.equal(checkoutRequests, 1, 'Double clicks must only start one handoff')
checkoutTree = renderCheckout()
await find(checkoutTree, node => node.type === 'form').props.onSubmit({ preventDefault() {} })
find(checkoutTree, node => node.type === 'select').props.onChange({ target: { value: '3' } })
find(checkoutTree, node => node.type === 'button' && node.props.className === 'store-remove').props.onClick()
assert.equal(checkoutUpdates, 0, 'Cart edits must be locked while the checkout handoff is pending')
finishCheckout({ url: 'https://uebertangel.org/?halobox_checkout=fixture' })
console.log('STORE_BRIDGE_PASS')
