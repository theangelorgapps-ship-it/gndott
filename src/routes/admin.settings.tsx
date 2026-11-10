import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getStreamSettings, saveStreamSettings } from '../lib/streamSettings'

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
  </main>
}
