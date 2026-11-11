import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getAppMetrics } from '../lib/appMetrics'

// Admin → App metrics (ticket 11): cards fed by real mobile app events.
// Admin-only; empty state is honest before any events exist.
export const Route = createFileRoute('/admin/metrics')({
  component: AppMetricsPage,
})

function AppMetricsPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAppMetrics()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load metrics.'))
  }, [])

  if (error) return <main className="section"><h1>App metrics</h1><p>{error}</p></main>
  if (!data) return <main className="section"><h1>App metrics</h1><p>Loading…</p></main>

  const maxDaily = Math.max(1, ...(data.daily ?? []).map((d: any) => Number(d.events)))

  return (
    <main className="section" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>App metrics</h1>
      <p style={{ opacity: 0.65, marginBottom: 24 }}>Live events from the HaloBox mobile app. Anonymous install IDs only.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 32 }}>
        {(data.totals ?? []).map((t: any) => (
          <div key={t.name} style={{ background: '#131c24', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{t.events}</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>{t.name} · 7 days</div>
            <div style={{ opacity: 0.5, fontSize: 12, marginTop: 2 }}>{t.installs} installs</div>
          </div>
        ))}
        {!(data.totals ?? []).length && <p>No app events yet. Cards fill automatically as viewers use the app.</p>}
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Events per day (14 days)</h2>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginBottom: 32 }}>
        {(data.daily ?? []).map((d: any) => (
          <div key={d.day} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ background: '#3cbbff', borderRadius: 4, height: Math.max(4, (Number(d.events) / maxDaily) * 100) }} />
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6 }}>{String(d.day).slice(5)}</div>
          </div>
        ))}
        {!(data.daily ?? []).length && <p>No daily activity yet.</p>}
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Most played titles (30 days)</h2>
      {(data.titles ?? []).map((t: any) => (
        <div key={`${t.type}-${t.name}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ffffff14' }}>
          <span>{t.name}</span>
          <span style={{ opacity: 0.65 }}>{t.plays} plays</span>
        </div>
      ))}
      {!(data.titles ?? []).length && <p>No playback events yet.</p>}
    </main>
  )
}
