import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, XCircle, Bell } from 'lucide-react'
import { getNotificationsFeed } from '../lib/api'
import '../alerts.css'

export const Route = createFileRoute('/notifications')({
  loader: async () => await getNotificationsFeed(),
  component: Notifications,
})

function Notifications() {
  const rows = Route.useLoaderData() as any
  const items = (rows ?? []).map((n: any) => {
    let title = n.type?.split('\\').pop() ?? 'Notification'
    let body = ''
    let status: 'success' | 'failed' | null = null
    let amount: number | null = null
    let currency = 'USD'
    try {
      const d = typeof n.data === 'string' ? JSON.parse(n.data) : n.data
      title = d?.title ?? d?.subject ?? title
      body = d?.message ?? d?.body ?? ''
      if (d?.status === 'success' || d?.status === 'failed') status = d.status
      if (Number.isSafeInteger(d?.amount)) amount = d.amount
      if (typeof d?.currency === 'string') currency = d.currency
    } catch { /* keep defaults */ }
    return { id: n.id, title, body, status, amount, currency, created_at: n.created_at }
  })
  const money = (cents: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100)
  return (
    <div>
      <div className="page-head">
        <h1>Notifications</h1>
        <p>Latest updates and announcements</p>
      </div>
      <section className="section" style={{ paddingTop: 0 }}>
        {items.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>No Notifications</div>
            <div>You're all caught up.</div>
          </div>
        ) : (
          <div className="alert-list">
            {items.map((n: any) => (
              <div key={n.id} className={`alert-card${n.status ? ` alert-${n.status}` : ''}`} role={n.status === 'failed' ? 'alert' : 'status'}>
                <span className="alert-indicator" aria-hidden="true">
                  {n.status === 'success' ? <CheckCircle2 size={20} /> : n.status === 'failed' ? <XCircle size={20} /> : <Bell size={20} />}
                </span>
                <div className="alert-content">
                  <div className="alert-title">{n.title}</div>
                  {n.body && <div className="alert-description">{n.body}</div>}
                  <div className="alert-meta">
                    {n.amount != null && <span className="alert-amount">{money(n.amount, n.currency)}</span>}
                    <span>{String(n.created_at ?? '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
