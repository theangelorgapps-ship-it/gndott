import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getLiveAdmin, saveLiveSettings } from '../lib/liveTv'
import { LiveDiscussion } from '../components/LiveDiscussion'

export const Route = createFileRoute('/admin/live-tv')({
  loader: () => getLiveAdmin(),
  component: LiveAdmin,
  errorComponent: ({ error, reset }) => <main className="live-admin"><h1>Live TV administration</h1><p role="alert">{error instanceof Error ? error.message : 'Unable to load Live TV.'}</p><a className="btn btn-primary" href="/login">Sign in as administrator</a> <a href="/">Back to Halobox</a><button onClick={reset}>Try again</button></main>,
})
function LiveAdmin() {
  const { channels } = Route.useLoaderData()
  const [selected, setSelected] = useState<number>(channels[0]?.id)
  const channel = channels.find(c => c.id === selected)
  return <main className="live-admin">
    <header><a href="/">GoodNews Halobox</a><a href="/admin/shop">Shop administration</a><a href="/admin/settings">Stream settings</a><a href="/live-tv">View Live TV ↗</a></header>
    <h1>Live TV administration</h1><p>Manage streams, conversation settings and moderation.</p>
    <label className="live-channel-select">Channel<select aria-label="Channel" value={selected || ''} onChange={e => setSelected(Number(e.target.value))}>{channels.map(c => <option key={c.id} value={c.id}>{c.name}{c.status !== 1 ? ' (unpublished)' : ''}</option>)}</select></label>
    {channel ? <div className="live-admin-grid"><ChannelSettings key={`settings-${channel.id}`} channel={channel} /><LiveDiscussion key={`discussion-${channel.id}`} channelId={channel.id} /></div> : <p>No channels have been created yet.</p>}
  </main>
}
function ChannelSettings({ channel }: { channel: Awaited<ReturnType<typeof getLiveAdmin>>['channels'][number] }) {
  const router = useRouter()
  const [sourceKind, setKind] = useState<'hls'|'rtmp'|'embed'>(channel.source_kind || 'hls')
  const [hlsUrl, setHls] = useState(channel.hls_url || '')
  const [embedUrl, setEmbed] = useState(channel.embed_url || '')
  const [ingestUrl, setIngest] = useState(channel.ingest_url || '')
  const [commentsEnabled, setComments] = useState(!!channel.comments_enabled)
  const [slowMode, setSlow] = useState(channel.slow_mode)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  return <form className="live-settings" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); setStatus('')
    try { await saveLiveSettings({ data: { channelId: channel.id, sourceKind, embedUrl, hlsUrl: hlsUrl.trim(), ingestUrl: ingestUrl.trim(), commentsEnabled, slowMode } }); setStatus('Channel settings saved.'); await router.invalidate() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save settings.') }
    finally { setBusy(false) }
  }}>
    <h2>Stream settings</h2>
    <label>Source<select value={sourceKind} onChange={e => setKind(e.target.value as 'hls'|'rtmp'|'embed')}><option value="hls">HLS playback</option><option value="rtmp">RTMP broadcast via existing service</option><option value="embed">Embedded player</option></select></label>
    {sourceKind === 'rtmp' && <label>Private RTMP / RTMPS ingest URL<input type="password" autoComplete="off" spellCheck={false} value={ingestUrl} onChange={e => setIngest(e.target.value)} required /><small>Use your current streaming service. This address is visible only to administrators.</small></label>}
    {sourceKind === 'embed' ? <label>Player URL<input type="url" placeholder="https://iframe.viewmedia.tv?channel=030" value={embedUrl} onChange={e => setEmbed(e.target.value)} required/><small>Viewmedia, YouTube embed or Vimeo player URL.</small></label> : <label>HLS playback URL<input type="url" placeholder="https://…/playlist.m3u8" value={hlsUrl} onChange={e => setHls(e.target.value)} required={sourceKind === 'rtmp'} /><small>{sourceKind === 'hls' ? 'Leave empty to use the channel’s existing migrated stream.' : 'Paste the HLS output provided by the same streaming service. RTMP itself cannot play in the browser.'}</small></label>}
    <h2>Conversation</h2>
    <label className="live-switch"><input type="checkbox" role="switch" checked={commentsEnabled} onChange={e => setComments(e.target.checked)} /> Enable live comments</label>
    <p>Turning comments off blocks new viewer comments and replies. Existing messages and reporting remain available.</p>
    <label>Seconds between comments<input type="number" min={0} max={120} value={slowMode} onChange={e => setSlow(Number(e.target.value))} /><small>0 disables the extra delay; a basic spam limit still applies.</small></label>
    <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save channel settings'}</button>
    {error && <p role="alert" className="live-error">{error}</p>}{status && <p role="status">{status}</p>}
  </form>
}
