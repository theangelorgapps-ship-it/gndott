import { env } from 'cloudflare:workers'

// Transactional email (Cloudflare EMAIL binding) + in-app transaction
// notifications (the Laravel-style notifications table feeding /notifications).
// Every money event — giving or store — emails the payer and, for signed-in
// viewers, drops a success/failed card into their notifications.

type EmailBinding = { send(message: { from: string; to: string; subject: string; text: string }): Promise<unknown> }

export async function sendTransactional(to: string, subject: string, text: string) {
  const binding = (env as any).EMAIL as EmailBinding | undefined
  if (!binding) return // not bound in this environment (local dev)
  await binding.send({ from: 'noreply@halobox.tv', to, subject, text })
}

export type TransactionNotice = {
  kind: 'giving' | 'store'
  status: 'success' | 'failed'
  title: string
  message: string
  amountCents?: number
  currency?: string
}

export async function notifyUser(db: D1Database, userId: number | null | undefined, notice: TransactionNotice) {
  if (!userId) return
  await db.prepare(
    `INSERT INTO notifications(id, type, notifiable_type, notifiable_id, data, created_at, updated_at)
     VALUES(?,?,?,?,?,datetime('now'),datetime('now'))`,
  ).bind(
    crypto.randomUUID(),
    'App\\Notifications\\Transaction',
    'App\\Models\\User',
    userId,
    JSON.stringify({
      title: notice.title, message: notice.message, status: notice.status, kind: notice.kind,
      amount: notice.amountCents, currency: notice.currency,
    }),
  ).run().catch((error: unknown) => { console.warn('Transaction notification failed:', error instanceof Error ? error.message : 'insert failed') })
}
