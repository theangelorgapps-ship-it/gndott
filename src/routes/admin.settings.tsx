import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getStreamSettings, saveGivingSettings, saveStreamSettings } from '../lib/streamSettings'

export const Route = createFileRoute('/admin/settings')({
  loader: () => getStreamSettings(),
  component: StreamSettingsAdmin,
  errorComponent: ({ error, reset }) => <main className="live-admin"><h1>Stream settings</h1><p role="alert">{error instanceof Error ? error.message : 'Unable to load settings.'}</p><a className="btn btn-primary" href="/login">Sign in as administrator</a> <a href="/">Back to Halobox</a><button onClick={reset}>Try again</button></main>,
})

function StreamSettingsAdmin() {
  const initial = Route.useLoaderData()
  const router = useRouter()
  const [libraryId, setLibraryId] = useState(initial.bunnyLibraryId)
  const [pullZone, setPullZone] = useState(initial.bunnyPullZone)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [givingEnabled, setGivingEnabled] = useState(initial.givingStripeEnabled)
  const [givingKey, setGivingKey] = useState('')
  const [givingWebhook, setGivingWebhook] = useState('')
  const [givingBusy, setGivingBusy] = useState(false)
  const [givingStatus, setGivingStatus] = useState('')
  const [givingError, setGivingError] = useState('')

  return <main className="live-admin">
    <header><a href="/">GoodNews Halobox</a><a href="/admin/live-tv">Live TV administration</a><a href="/admin/shop">Shop administration</a></header>
    <h1>Stream settings</h1>
    <p>Bunny Stream delivery for the web player and the native apps. The pull zone unlocks direct HLS playback (<code>/api/mobile/stream/*</code>) for the mobile app; find it in the Bunny dashboard under <strong>Stream → API</strong> (it looks like <code>vz-abc123-456.b-cdn.net</code>).</p>
    <form className="live-settings" onSubmit={async e => {
      e.preventDefault()
      setBusy(true); setStatus(''); setError('')
      try {
        await saveStreamSettings({ data: { bunnyLibraryId: libraryId, bunnyPullZone: pullZone } })
        setStatus('Stream settings saved.')
        await router.invalidate()
      } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save settings.') }
      finally { setBusy(false) }
    }}>
      <label>Bunny library ID
        <input value={libraryId} onChange={e => setLibraryId(e.target.value)} inputMode="numeric" placeholder="347005" autoComplete="off" />
      </label>
      <label>Bunny pull zone hostname
        <input value={pullZone} onChange={e => setPullZone(e.target.value)} placeholder="vz-abc123-456.b-cdn.net" autoComplete="off" spellCheck={false} />
      </label>
      <div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        {status && <span role="status"> {status}</span>}
        {error && <span role="alert"> {error}</span>}
      </div>
    </form>

    <h1 style={{ marginTop: 48 }}>Giving (Stripe)</h1>
    <p>Donations from the player’s Giving tab. By default giving uses the same Stripe account as subscriptions. To run giving on its own account — for example the <strong>SpiritEmbassy</strong> account in <strong>test mode</strong> — paste its keys here. Test keys start with <code>sk_test_</code>; keep the account’s dashboard in test mode while testing. The webhook endpoint is <code>/api/stripe-webhook</code> (add it under Developers → Webhooks with the <code>checkout.session.completed</code> event, then paste its signing secret).</p>
    <form className="live-settings" onSubmit={async e => {
      e.preventDefault()
      setGivingBusy(true); setGivingStatus(''); setGivingError('')
      try {
        await saveGivingSettings({ data: { enabled: givingEnabled, secretKey: givingKey, webhookSecret: givingWebhook } })
        setGivingStatus('Giving settings saved.')
        setGivingKey(''); setGivingWebhook('')
        await router.invalidate()
      } catch (err) { setGivingError(err instanceof Error ? err.message : 'Unable to save giving settings.') }
      finally { setGivingBusy(false) }
    }}>
      <label className="live-switch">
        <input type="checkbox" checked={givingEnabled} onChange={e => setGivingEnabled(e.target.checked)} />
        Use these keys for Giving (otherwise the shared Stripe account is used)
      </label>
      <label>Secret key {initial.givingSecretKeySet && <small>(currently {initial.givingSecretKeySet} — leave blank to keep)</small>}
        <input value={givingKey} onChange={e => setGivingKey(e.target.value)} placeholder="sk_test_…" autoComplete="off" spellCheck={false} type="password" />
      </label>
      <label>Webhook signing secret {initial.givingWebhookSecretSet && <small>(currently {initial.givingWebhookSecretSet} — leave blank to keep)</small>}
        <input value={givingWebhook} onChange={e => setGivingWebhook(e.target.value)} placeholder="whsec_…" autoComplete="off" spellCheck={false} type="password" />
      </label>
      <div>
        <button className="btn btn-primary" type="submit" disabled={givingBusy}>{givingBusy ? 'Saving…' : 'Save giving settings'}</button>
        {givingStatus && <span role="status"> {givingStatus}</span>}
        {givingError && <span role="alert"> {givingError}</span>}
      </div>
    </form>
  </main>
}
