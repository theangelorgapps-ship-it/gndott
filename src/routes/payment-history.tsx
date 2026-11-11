import { createFileRoute } from '@tanstack/react-router'
import { getTransactionLedger } from '../lib/api'
import { AccountShell, NeedsAuth } from '../components/Account'
import '../alerts.css'

export const Route = createFileRoute('/payment-history')({
  loader: async () => await getTransactionLedger(),
  component: PaymentHistory,
})

const KIND_LABEL: Record<string, string> = { offering: 'Offering', tithe: 'Tithe', partner: 'Partnership', seed: 'Seed' }
const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const gbp = (minor: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)
const day = (v: unknown) => String(v ?? '').slice(0, 10)

function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status === 'paid' ? 'on' : status === 'failed' ? 'off' : 'warn'}`}>{status}</span>
}

function PaymentHistory() {
  const ledger = Route.useLoaderData() as any
  if (ledger === null) return <NeedsAuth />
  const { subscriptions = [], giving = [], purchases = [] } = ledger
  const empty = !subscriptions.length && !giving.length && !purchases.length

  return (
    <AccountShell title="Payment History">
      {empty ? (
        <div className="empty">No payments yet.</div>
      ) : (
        <div className="ledger">
          <section className="ledger-section">
            <h2>Subscriptions</h2>
            {subscriptions.length === 0 ? <p className="ledger-empty">No subscription payments yet.</p> : (
              <table className="admin-table">
                <thead><tr><th>Transaction ID</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {subscriptions.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.transaction_id ?? '—'}</td>
                      <td>${Number(r.amount ?? 0).toFixed(2)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{r.payment_type ?? '—'}</td>
                      <td><StatusPill status={r.payment_status ?? 'pending'} /></td>
                      <td>{day(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="ledger-section">
            <h2>Giving</h2>
            {giving.length === 0 ? <p className="ledger-empty">No gifts yet — the Giving tab lives in the player.</p> : (
              <table className="admin-table">
                <thead><tr><th>Campaign</th><th>Amount</th><th>Frequency</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {giving.map((r: any) => (
                    <tr key={r.id}>
                      <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td>{usd(Number(r.amount_cents ?? 0))}</td>
                      <td>{r.frequency === 'monthly' ? 'Monthly' : 'One-time'}</td>
                      <td><StatusPill status={r.status} /></td>
                      <td>{day(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="ledger-section">
            <h2>Purchases</h2>
            {purchases.length === 0 ? <p className="ledger-empty">No store purchases yet.</p> : (
              <table className="admin-table">
                <thead><tr><th>Order</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {purchases.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.order_id ? `#${r.order_id}` : '—'}</td>
                      <td>{gbp(Number(r.total_minor ?? 0), String(r.currency ?? 'GBP'))}</td>
                      <td><StatusPill status={r.status} /></td>
                      <td>{day(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </AccountShell>
  )
}
