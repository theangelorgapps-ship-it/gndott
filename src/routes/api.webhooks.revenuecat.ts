import { createFileRoute } from '@tanstack/react-router'
import { all, first, run } from '../lib/db'

// RevenueCat → D1 subscriptions (Phase 2 §3.4). Verified with the shared
// webhook secret (admin setting `revenuecat_webhook_secret`, never in the app
// bundle), bounded body, idempotent on the RevenueCat event id. Maps
// app_user_id → HaloBox user so mobile IAP subscribers appear on the website,
// payment history and admin exactly like Stripe subscribers.
async function handleRevenuecat(ctx: { request: Request }): Promise<Response> {
  const { env } = await import('cloudflare:workers')
  const configured = await first<any>(`SELECT val FROM settings WHERE name = 'revenuecat_webhook_secret' AND deleted_at IS NULL`).catch(() => null)
  const secret = String(configured?.val ?? (env as any).REVENUECAT_WEBHOOK_SECRET ?? '')
  if (!secret) return Response.json({ ok: false, error: 'RevenueCat webhook is not configured.' }, { status: 503 })
  const auth = ctx.request.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })

  const raw = await ctx.request.text()
  if (raw.length > 65536) return Response.json({ ok: false, error: 'Payload too large.' }, { status: 413 })
  let event: any
  try {
    event = JSON.parse(raw)?.event
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 })
  }
  const eventId = String(event?.id ?? '')
  const type = String(event?.type ?? '')
  const appUserId = String(event?.app_user_id ?? '')
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(eventId)) return Response.json({ ok: false, error: 'Invalid event id.' }, { status: 400 })
  if (!['INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'EXPIRATION'].includes(type)) {
    return Response.json({ ok: true, ignored: type })
  }
  const userId = Number(appUserId)
  if (!Number.isSafeInteger(userId) || userId <= 0) return Response.json({ ok: false, error: 'Unknown app_user_id.' }, { status: 422 })

  // Idempotency: each RevenueCat event id is processed exactly once.
  await run(`CREATE TABLE IF NOT EXISTS revenuecat_events (id TEXT PRIMARY KEY, processed_at TEXT NOT NULL DEFAULT (datetime('now')))`).catch(() => null)
  const existing = await first<any>(`SELECT id FROM revenuecat_events WHERE id = ?`, eventId).catch(() => null)
  if (existing) return Response.json({ ok: true, already: true })

  const user = await first<any>(`SELECT id, email FROM users WHERE id = ? AND status = 1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0`, userId)
  if (!user) return Response.json({ ok: false, error: 'User not found.' }, { status: 422 })

  if (type === 'CANCELLATION' || type === 'EXPIRATION') {
    await run(`UPDATE subscriptions SET status = 'inactive', updated_at = datetime('now') WHERE user_id = ? AND plan_type = 'revenuecat' AND status = 'active' AND deleted_at IS NULL`, userId)
    const stillActive = await first<any>(`SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL`, userId)
    if (!stillActive) await run(`UPDATE users SET is_subscribe = 0, updated_at = datetime('now') WHERE id = ?`, userId)
  } else {
    const productId = String(event?.product_id ?? '')
    const transactionId = String(event?.transaction_id ?? event?.original_transaction_id ?? eventId)
    const expiryMs = Number(event?.expiration_at_ms ?? 0)
    const end = expiryMs > 0 ? new Date(expiryMs).toISOString().slice(0, 10) : null
    const start = new Date(Number(event?.purchased_at_ms ?? Date.now())).toISOString().slice(0, 10)
    const plan = await first<any>(`SELECT id, name, identifier, duration, duration_value, level FROM plans WHERE (identifier = ? OR name = ?) AND deleted_at IS NULL LIMIT 1`, productId, productId).catch(() => null)
    const amount = Number(event?.price_in_purchased_currency ?? event?.price ?? 0)

    await run(`UPDATE subscriptions SET status = 'inactive', updated_at = datetime('now') WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL`, userId)
    await run(
      `INSERT INTO subscriptions(plan_id,user_id,start_date,end_date,status,is_manual,amount,discount_percentage,tax_amount,coupon_discount,total_amount,name,identifier,type,duration,level,plan_type,payment_id,created_at,updated_at)
       VALUES(?,?,?,?,'active',0,?,0,0,0,?,?,?,?,?,?, 'revenuecat',?,datetime('now'),datetime('now'))`,
      plan?.id ?? null, userId, start, end, amount, amount, plan?.name ?? productId, plan?.identifier ?? productId, 'subscription', plan?.duration ?? 'month', plan?.level ?? 0, transactionId,
    )
    await run(
      `INSERT INTO subscriptions_transactions(subscriptions_id,user_id,amount,payment_type,payment_status,transaction_id,created_at,updated_at)
       SELECT id, user_id, ?, 'revenuecat', 'paid', ?, datetime('now'), datetime('now') FROM subscriptions WHERE user_id = ? AND plan_type = 'revenuecat' AND status = 'active' ORDER BY id DESC LIMIT 1`,
      amount, transactionId, userId,
    )
    await run(`UPDATE users SET is_subscribe = 1, updated_at = datetime('now') WHERE id = ?`, userId)
  }

  await run(`INSERT INTO revenuecat_events (id) VALUES (?)`, eventId).catch(() => null)
  return Response.json({ ok: true })
}

export const Route = createFileRoute('/api/webhooks/revenuecat')({
  server: {
    handlers: {
      POST: handleRevenuecat,
    },
  },
})
