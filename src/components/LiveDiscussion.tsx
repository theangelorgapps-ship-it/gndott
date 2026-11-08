import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { getLiveDiscussion, moderateLive, reportLiveComment, sendLiveComment } from '../lib/liveTv'

type Discussion = Awaited<ReturnType<typeof getLiveDiscussion>>
const tabs = ['Live comments', 'Responses', 'Admin comments', 'Reports'] as const
export function LiveDiscussion({ channelId }: { channelId: number }) {
  const [data, setData] = useState<Discussion | null>(null)
  const [tab, setTab] = useState<typeof tabs[number]>('Live comments')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState<{ id: number; author_name: string } | null>(null)
  const [report, setReport] = useState<number | null>(null)
  const [reason, setReason] = useState('spam')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [connection, setConnection] = useState('')
  const alive = useRef(false)
  const failures = useRef(0)
  const inFlight = useRef<Promise<void> | null>(null)
  const submission = useRef<{ text: string; id: string } | null>(null)
  const prefix = useId()
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current
    inFlight.current = getLiveDiscussion({ data: { channelId } }).then(next => {
      failures.current = 0
      if (alive.current) { setData(next); setConnection('') }
    }).catch(() => {
      failures.current++
      if (alive.current) setConnection('Conversation disconnected. Reconnecting…')
    }).finally(() => { inFlight.current = null })
    return inFlight.current
  }, [channelId])
  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (!document.hidden) await refresh()
      if (alive.current) timer = setTimeout(poll, Math.min(30000, 5000 * (failures.current + 1)))
    }
    void poll()
    const visible = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { alive.current = false; clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }, [refresh])
  async function mutate(action: () => Promise<unknown>, success: () => void) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); if (alive.current) success(); await inFlight.current; await refresh() }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Unable to save. Please try again.') }
    finally { if (alive.current) setBusy(false) }
  }
  const comments = data?.comments.filter(c => tab === 'Responses' ? !!c.parent_id : tab === 'Admin comments' ? !!c.official : true) ?? []
  const moderate = (targetId: number, action: string) => mutate(() => moderateLive({ data: { channelId, targetId, action } }), () => setNotice('Moderation saved.'))
  return <div className="live-discussion" data-lenis-prevent>
    <h2>Live discussion</h2>
    <div className="live-tabs" role="tablist" aria-label="Live discussion sections">
      {tabs.map(name => <button key={name} id={`${prefix}-${name}`} role="tab" aria-selected={tab === name} aria-controls={`${prefix}-feed`} tabIndex={tab === name ? 0 : -1} onKeyDown={e => {
        const offset = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (offset || e.key === 'Home' || e.key === 'End') { e.preventDefault(); const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (tabs.indexOf(name) + offset + 4) % 4]; setTab(next); document.getElementById(`${prefix}-${next}`)?.focus() }
      }} onClick={() => { setTab(name); setReply(null) }}>{name}</button>)}
    </div>
    {connection && <p role="status">{connection} <button type="button" onClick={() => void refresh()}>Retry</button></p>}
    {!data && !connection && <p role="status">Loading conversation…</p>}
    {data && <>
      {!data.enabled && <p className="live-notice">Live comments are turned off by the administrator.</p>}
      <div className="live-feed" role="tabpanel" id={`${prefix}-feed`} aria-labelledby={`${prefix}-${tab}`} tabIndex={0}>
        {tab === 'Reports' ? <>
          <p>{data.isAdmin ? 'Review reports and moderate the conversation.' : 'Your reports are private. Use Report on a comment to flag it for review.'}</p>
          {!data.signedIn && <a href="/login">Sign in to report a comment</a>}
          {data.reports.map(r => <article key={r.id} className="live-comment"><header><strong>{r.reason}</strong><span>{r.status}</span></header><p>{r.body}</p>{r.detail && <p>{r.detail}</p>}
            {data.isAdmin && r.status === 'open' && <div className="live-comment-actions"><button disabled={busy} onClick={() => void moderate(r.comment_id, 'hide')}>Hide comment</button><button disabled={busy} onClick={() => void moderate(r.id, 'resolve')}>Resolve</button><button disabled={busy} onClick={() => void moderate(r.id, 'dismiss')}>Dismiss</button></div>}
          </article>)}
          {!data.reports.length && <p>No reports yet.</p>}
          {data.isAdmin && data.mutes.length > 0 && <section aria-label="Muted viewers"><h3>Muted viewers</h3>{data.mutes.map(m => <p key={m.user_id}>{m.author_name} <button disabled={busy} onClick={() => void moderate(m.comment_id, 'unmute')}>Allow comments again</button></p>)}</section>}
        </> : <>
          {!comments.length && <p>{tab === 'Responses' ? 'Replies will appear here.' : tab === 'Admin comments' ? 'Official messages will appear here.' : 'Start the conversation.'}</p>}
          {comments.map(c => <article key={c.id} className="live-comment">
            <header><strong>{c.author_name}{c.mine ? ' (you)' : ''}</strong>{!!c.official && <span className="live-official">Admin</span>}{!!c.pinned && <span>Pinned</span>}<time dateTime={`${c.created_at.replace(' ', 'T')}Z`}>{c.created_at.slice(11, 16)} UTC</time></header>
            {!!c.parent_id && <blockquote>{c.reply_body ? `${c.reply_author}: ${c.reply_body}` : 'Original comment removed'}</blockquote>}<p>{c.body}</p>
            <div className="live-comment-actions">
              {data.canComment && <button onClick={() => { setReply(c); setTab('Responses'); document.getElementById(`${prefix}-message`)?.focus() }}>Reply</button>}
              {data.signedIn && <button onClick={() => { setReport(c.id); setError(''); setDetail('') }}>Report</button>}
              {data.isAdmin && <><button disabled={busy} onClick={() => void moderate(c.id, 'hide')}>Hide</button><button disabled={busy} onClick={() => void moderate(c.id, c.pinned ? 'unpin' : 'pin')}>{c.pinned ? 'Unpin' : 'Pin'}</button>{!c.official && <button disabled={busy} onClick={() => void moderate(c.id, 'mute')}>Mute viewer</button>}</>}
            </div>
          </article>)}
        </>}
      </div>
      {report !== null && <form className="live-composer" aria-label="Report comment" onSubmit={e => { e.preventDefault(); void mutate(() => reportLiveComment({ data: { channelId, commentId: report, reason, detail } }), () => { setReport(null); setTab('Reports'); setNotice('Report submitted for review.') }) }}>
        <label>Reason<select value={reason} onChange={e => setReason(e.target.value)}>{['spam','abuse','inappropriate','other'].map(r => <option key={r}>{r}</option>)}</select></label>
        <label>Details (optional)<textarea maxLength={500} value={detail} onChange={e => setDetail(e.target.value)} /></label>
        <div><button className="btn btn-primary" disabled={busy}>Submit report</button><button type="button" onClick={() => setReport(null)}>Cancel</button></div>
      </form>}
      {tab !== 'Reports' && (tab !== 'Admin comments' || data.isAdmin) && (data.canComment ? <form className="live-composer" onSubmit={e => {
        e.preventDefault()
        const text = JSON.stringify([body, reply?.id, tab === 'Admin comments'])
        if (submission.current?.text !== text) submission.current = { text, id: crypto.randomUUID() }
        void mutate(() => sendLiveComment({ data: { channelId, body, parentId: reply?.id, announcement: data.isAdmin && tab === 'Admin comments', requestId: submission.current!.id } }), () => { setBody(''); setReply(null); submission.current = null; setNotice('Comment sent.') })
      }}>
        {reply && <p>Replying to {reply.author_name} <button type="button" onClick={() => setReply(null)}>Cancel reply</button></p>}
        <label htmlFor={`${prefix}-message`}>{data.isAdmin && tab === 'Admin comments' ? 'Official announcement' : 'Your comment'}</label>
        <textarea id={`${prefix}-message`} rows={2} maxLength={1000} value={body} disabled={busy} onChange={e => setBody(e.target.value)} placeholder="Join the conversation…" required />
        <div><span>{body.length}/1,000{data.slowMode ? ` · ${data.slowMode}s between comments` : ''}</span><button className="btn btn-primary" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send'}</button></div>
      </form> : <p>{data.commentReason} {!data.signedIn ? <a href="/login">Sign in</a> : !data.muted && data.enabled ? <a href="/manage-profile">Profiles</a> : null}</p>)}
    </>}
    {error && <p role="alert" className="live-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </div>
}
