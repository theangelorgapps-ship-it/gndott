import { createFileRoute } from '@tanstack/react-router'
import { getRentHistory } from '../lib/api'
import { AccountShell, NeedsAuth } from '../components/Account'
import { img } from '../components/Poster'

export const Route = createFileRoute('/pay-per-view-history')({
  loader: async () => await getRentHistory(),
  component: RentHistory,
})

function RentHistory() {
  const rows = Route.useLoaderData() as any
  if (rows === null) return <NeedsAuth />
  return (
    <AccountShell title="Pay Per View History">
      {rows.length === 0 ? (
        <div className="empty">No rentals yet.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Content</th><th>Type</th><th>Price</th><th>Expiry</th><th>Rented On</th></tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <div className="cell-main">
                    <img src={img(r.poster_url)} alt="" />
                    <span className="cell-title">{r.title ?? 'Untitled'}</span>
                  </div>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                <td>${Number(r.price ?? 0).toFixed(2)}</td>
                <td>{r.view_expiry_date ? String(r.view_expiry_date).slice(0, 10) : '—'}</td>
                <td>{String(r.created_at ?? '').slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AccountShell>
  )
}
