import { createFileRoute } from '@tanstack/react-router'
import { getNotificationsFeed } from '../lib/api'

export const Route = createFileRoute('/notifications')({
  loader: async () => await getNotificationsFeed(),
  component: Notifications,
})

function Notifications() {
  const rows = Route.useLoaderData() as any
  const items = (rows ?? []).map((n: any) => {
    let title = n.type?.split('\\').pop() ?? 'Notification'
    let body = ''
    try {
      const d = typeof n.data === 'string' ? JSON.parse(n.data) : n.data
      title = d?.title ?? d?.subject ?? title
      body = d?.message ?? d?.body ?? ''
    } catch { /* keep defaults */ }
    return { id: n.id, title, body, created_at: n.created_at }
  })
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
          <div className="notif-list">
            {items.map((n: any) => (
              <div key={n.id} className="notif-item">
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="notif-body">{n.body}</div>}
                <div className="notif-date">{String(n.created_at ?? '').slice(0, 16)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
