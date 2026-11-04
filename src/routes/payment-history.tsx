import { createFileRoute } from '@tanstack/react-router'
import { getPaymentHistory } from '../lib/api'
import { AccountShell, NeedsAuth } from '../components/Account'

export const Route = createFileRoute('/payment-history')({
  loader: async () => await getPaymentHistory(),
  component: PaymentHistory,
})

function PaymentHistory() {
  const rows = Route.useLoaderData() as any
  if (rows === null) return <NeedsAuth />
  return (
    <AccountShell title="Payment History">
      {rows.length === 0 ? (
        <div className="empty">No payments yet.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Transaction ID</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.transaction_id ?? '—'}</td>
                <td>${Number(r.amount ?? 0).toFixed(2)}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.payment_type ?? '—'}</td>
                <td><span className={`pill ${r.payment_status === 'paid' ? 'on' : 'warn'}`}>{r.payment_status ?? 'pending'}</span></td>
                <td>{String(r.created_at ?? '').slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AccountShell>
  )
}
