// In-site store checkout: quote via the WooCommerce bridge (Woo stays the price,
// shipping and tax authority), pay through the shared Stripe configurator, then
// create the order on uebertangel.org only after a verified payment.
// The Stripe session/transport and webhook plumbing are the same ones
// subscriptionCheckout.server.ts uses — one Stripe integration, two purposes.
import { checkoutError, stripeConfiguration, stripeRequest, CheckoutError } from './subscriptionCheckout.server'
import { bridge } from './storeBridge.server'

export type StoreAddress = {
  first_name: string; last_name: string; address_1: string; address_2: string
  city: string; state: string; postcode: string; country: string; phone: string
}

export type StoreQuote = {
  quote_id: string; currency: string
  items_total: string; discount_total: string; shipping_total: string; tax_total: string; total: string
  shipping_rates: { id: string; label: string; cost: string; selected: boolean }[]
  expires_in: number
}

const validKey = (value: unknown) => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)
const ADDRESS_FIELDS = ['first_name', 'last_name', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'phone'] as const

export function cleanAddress(input: unknown): StoreAddress {
  if (!input || typeof input !== 'object') throw new CheckoutError('Enter your delivery address.')
  const source = input as Record<string, unknown>
  const address = {} as StoreAddress
  for (const field of ADDRESS_FIELDS) {
    const value = String(source[field] ?? '').replace(/<[^>]*>/g, '').trim().slice(0, field.startsWith('address_') ? 300 : 100)
    address[field] = value
  }
  if (!/^[A-Z]{2}$/.test(address.country)) throw new CheckoutError('Choose your delivery country.')
  if (!address.postcode) throw new CheckoutError('Enter your delivery postcode.')
  if (!address.first_name || !address.address_1 || !address.city) throw new CheckoutError('Enter your name, street address and city.')
  return address
}

/** Quote the current cart through the bridge and snapshot it for the pay step. */
export async function createStoreQuote(db: D1Database, user: { id: number; email: string }, cart: any, address: StoreAddress, shippingRate?: string) {
  const items = (cart?.items ?? []).map((item: any) => ({ id: item.id, quantity: item.quantity }))
  if (!items.length || items.length > 40) throw new CheckoutError('Your cart is empty.')
  const coupons = (cart?.coupons ?? []).map((entry: any) => String(entry.code ?? '')).filter(Boolean)
  const quote = await bridge('/quote', {
    items, coupons, address,
    ...(shippingRate ? { shipping_rate: shippingRate } : {}),
  }) as StoreQuote
  if (typeof quote.quote_id !== 'string' || !/^[a-f0-9]{64}$/.test(quote.quote_id)) throw new CheckoutError('The store did not return a valid quote. Please try again.')
  const totalMinor = Math.round(Number(quote.total) * 100)
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0 || totalMinor > 99999999) throw new CheckoutError('The quoted total is invalid. Please try again.')
  const id = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO store_checkouts (id, user_id, email, quote_id, address, total_minor, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'quoted')`,
  ).bind(id, user.id, user.email, quote.quote_id, JSON.stringify(address), totalMinor, String(quote.currency || 'GBP').toUpperCase()).run()
  return { checkoutId: id, quote }
}

type StoreSnapshot = {
  id: string; user_id: number; email: string; quote_id: string; address: string;
  total_minor: number; currency: string; stripe_session_id: string | null;
  status: string; order_id: number | null
}

/** Start (or resume) the Stripe session for a quoted cart. */
export async function createStoreCheckout(db: D1Database, user: { id: number; email: string }, data: { checkoutId: string; requestKey: string; expectedTotalMinor: number }, origin: string, secret: string, transport: typeof fetch = fetch) {
  if (!validKey(data.checkoutId) || !validKey(data.requestKey)) throw new CheckoutError('Refresh checkout and try again.')
  if (!Number.isSafeInteger(data.expectedTotalMinor) || data.expectedTotalMinor <= 0) throw new CheckoutError('Review the current total before paying.')
  const snapshot = await db.prepare(`SELECT * FROM store_checkouts WHERE id = ? AND user_id = ?`).bind(data.checkoutId, user.id).first<StoreSnapshot>()
  if (!snapshot || snapshot.status === 'failed') throw new CheckoutError('This checkout has expired. Review your cart and try again.')
  if (snapshot.total_minor !== data.expectedTotalMinor) throw new CheckoutError('The total has changed. Review the updated total before paying.')
  if (snapshot.status === 'paid') return { ok: true as const, already: true, orderId: snapshot.order_id }
  if (snapshot.stripe_session_id) {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(snapshot.stripe_session_id)}`, secret, transport)
    if (session.status === 'open' && session.url) return { ok: true as const, checkoutUrl: session.url as string }
    throw new CheckoutError('This checkout has expired. Review your cart and try again.')
  }
  const body = new URLSearchParams({
    mode: 'payment', 'payment_method_types[0]': 'card',
    'line_items[0][price_data][currency]': snapshot.currency.toLowerCase(),
    'line_items[0][price_data][product_data][name]': 'Halobox store order',
    'line_items[0][price_data][unit_amount]': String(snapshot.total_minor),
    'line_items[0][quantity]': '1',
    success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shop/checkout?cancelled=1`,
    customer_email: snapshot.email, client_reference_id: String(snapshot.user_id),
    'metadata[purpose]': 'halobox_store_order',
    'metadata[checkout_id]': snapshot.id,
    'metadata[user_id]': String(snapshot.user_id),
    'metadata[quote_id]': snapshot.quote_id,
  })
  const session = await stripeRequest('/checkout/sessions', secret, transport, body, `halobox-store-${snapshot.id}`)
  let safeUrl: URL
  try { safeUrl = new URL(session.url) } catch { throw new CheckoutError('Stripe did not return a checkout link. Please try again.') }
  if (!/^cs_(?:test_|live_)?[a-zA-Z0-9]+$/.test(session.id || '') || safeUrl.protocol !== 'https:' || safeUrl.hostname !== 'checkout.stripe.com' || safeUrl.username || safeUrl.password) throw new CheckoutError('Stripe did not return a valid checkout. Please try again.')
  await db.prepare(`UPDATE store_checkouts SET stripe_session_id = ?, status = 'pending', updated_at = datetime('now') WHERE id = ? AND stripe_session_id IS NULL`).bind(session.id, snapshot.id).run()
  return { ok: true as const, checkoutUrl: safeUrl.href }
}

function verifyStorePayment(session: any, snapshot: StoreSnapshot, userId?: number) {
  if (!session || session.id !== snapshot.stripe_session_id || session.mode !== 'payment' || session.status !== 'complete' ||
    session.metadata?.purpose !== 'halobox_store_order' || session.metadata?.checkout_id !== snapshot.id ||
    String(session.metadata?.user_id) !== String(snapshot.user_id) || String(session.client_reference_id) !== String(snapshot.user_id) ||
    String(session.metadata?.quote_id) !== String(snapshot.quote_id) || (userId !== undefined && userId !== snapshot.user_id)) throw new CheckoutError('This payment does not match your checkout.')
  if (session.amount_total !== snapshot.total_minor || String(session.currency).toUpperCase() !== snapshot.currency) throw new CheckoutError('The paid amount does not match this checkout. Please contact support.')
  if (session.payment_status !== 'paid') throw new CheckoutError('Payment is not completed yet. Try checking again in a moment.')
}

/** Create the WooCommerce order for a verified payment. Idempotent per Stripe session. */
export async function fulfillStoreOrder(db: D1Database, session: any, userId?: number) {
  const snapshot = await db.prepare(`SELECT * FROM store_checkouts WHERE stripe_session_id = ?`).bind(session?.id || '').first<StoreSnapshot>()
  if (!snapshot) throw new CheckoutError('This checkout could not be found. Please contact support with your payment reference.')
  verifyStorePayment(session, snapshot, userId)
  if (snapshot.status === 'paid') return { ok: true as const, already: true, orderId: snapshot.order_id }
  const address = JSON.parse(snapshot.address) as StoreAddress
  const reference = typeof session.payment_intent === 'string' && session.payment_intent ? session.payment_intent : session.id
  const result = await bridge('/order', {
    quote_id: snapshot.quote_id,
    payment: { gateway: 'stripe', reference, amount: (snapshot.total_minor / 100).toFixed(2), currency: snapshot.currency },
    customer: { email: snapshot.email },
    billing: address,
    shipping: address,
  })
  const orderId = Number(result?.order?.id)
  if (!result?.order || !Number.isSafeInteger(orderId)) throw new CheckoutError('Your payment is received but the order could not be filed yet. Please contact support with your payment reference.')
  await db.prepare(`UPDATE store_checkouts SET status = 'paid', order_id = ?, updated_at = datetime('now') WHERE id = ?`).bind(orderId, snapshot.id).run()
  return { ok: true as const, orderId: result.order.id, orderNumber: result.order.number, orderStatus: result.order.status }
}

/** Success-page confirmation for a signed-in viewer; null when the session is not a store checkout. */
export async function confirmStoreCheckout(sessionId: string, userId: number) {
  if (!/^cs_(?:test_|live_)?[a-zA-Z0-9]+$/.test(sessionId) || sessionId.length > 255) throw new CheckoutError('This payment reference is invalid.')
  const { db, secret } = await stripeConfiguration()
  const owned = await db.prepare(`SELECT id FROM store_checkouts WHERE stripe_session_id = ? AND user_id = ?`).bind(sessionId, userId).first()
  if (!owned) return null
  if (!secret) throw new CheckoutError('Payment verification is temporarily unavailable. Please try again.')
  return fulfillStoreOrder(db, await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, secret, fetch), userId)
}

export { checkoutError }
