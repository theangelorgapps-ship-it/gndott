import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Heart, MessageCircle, MoreHorizontal, Send, ShieldCheck, Smile, UsersRound, X } from 'lucide-react'
import { blockLiveViewer, getLiveDiscussion, moderateLive, reportLiveComment, sendLiveComment, unblockLiveViewer } from '../lib/liveTv'
import '../player-chat-refinement.css'

type Discussion = Awaited<ReturnType<typeof getLiveDiscussion>>
const tabs = ['Live comments', 'Responses', 'Admin comments', 'Reports'] as const
const reactions = [{ emoji: '❤️', label: 'heart' }, { emoji: '🙌', label: 'praise' }, { emoji: '🙏', label: 'prayer' }, { emoji: '😊', label: 'smile' }, { emoji: '💯', label: 'one hundred' }]
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase()
/** Viewer presentation and moderation share the existing authenticated chat API. */
export function LiveDiscussion({ channelId, moderation = false }: { channelId: number; moderation?: boolean }) {
  const [data, setData] = useState<Discussion | null>(null)
  const [tab, setTab] = useState<typeof tabs[number]>('Live comments')
  const [body, setBody] = useState(''), [reply, setReply] = useState<{ id: number; author_name: string } | null>(null)
  const [report, setReport] = useState<number | null>(null), [reason, setReason] = useState('spam'), [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [connection, setConnection] = useState('')
  const [collapsed, setCollapsed] = useState(false), [emojiOpen, setEmojiOpen] = useState(false), [reactionsOpen, setReactionsOpen] = useState(false), [blockedOpen, setBlockedOpen] = useState(false)
  const [blockTarget, setBlockTarget] = useState<{id:number;author_name:string} | null>(null)
  const alive = useRef(false), failures = useRef(0), channel = useRef(channelId)
  const inFlight = useRef<Promise<void> | null>(null), submission = useRef<{ text: string; id: string } | null>(null)
  const feed = useRef<HTMLDivElement>(null), follow = useRef(true), blockDialog = useRef<HTMLDialogElement>(null)
  const reportForm = useRef<HTMLFormElement>(null)
  const blockTrigger = useRef<HTMLElement | null>(null), composer = useRef<HTMLTextAreaElement>(null), busyRef = useRef(false)
  channel.current = channelId
  const prefix = useId()
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current
    const job = getLiveDiscussion({ data: { channelId } }).then(next => {
      failures.current = 0
      if (alive.current && channel.current === channelId) { setData(next); setConnection('') }
    }).catch(() => {
      failures.current++
      if (alive.current && channel.current === channelId) setConnection('Conversation disconnected. Reconnecting…')
    }).finally(() => { if (inFlight.current === job) inFlight.current = null })
    inFlight.current = job
    return job
  }, [channelId])
  useEffect(() => {
    alive.current = true; inFlight.current = null; failures.current = 0; follow.current = true
    setData(null); setError(''); setNotice(''); setConnection(''); setReply(null); setReport(null); setBlockTarget(null); setBody(''); submission.current = null
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (!document.hidden) await refresh()
      if (alive.current && channel.current === channelId) timer = setTimeout(poll, Math.min(30000, 5000 * (failures.current + 1)))
    }
    void poll()
    const visible = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { alive.current = false; clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }, [refresh, channelId])
  useEffect(() => {
    if (!blockTarget || !blockDialog.current) return
    const dialog = blockDialog.current
    dialog.showModal()
    return () => { dialog.close(); blockTrigger.current?.focus({ preventScroll: true }) }
  }, [blockTarget])
  useEffect(() => { if (report !== null) reportForm.current?.querySelector('select')?.focus({ preventScroll: true }) }, [report])
  const canModerate = moderation && !!data?.isAdmin
  const activeTab = canModerate ? tab : 'Live comments'
  const filtered = data?.comments.filter(c => activeTab === 'Responses' ? !!c.parent_id : activeTab === 'Admin comments' ? !!c.official : true) ?? []
  const pinned = canModerate ? [] : filtered.filter(c => c.pinned)
  const comments = canModerate ? filtered : filtered.filter(c => !c.pinned).slice().reverse()
  const latestId = comments.at(-1)?.id
  useEffect(() => { if (follow.current && feed.current && !canModerate) feed.current.scrollTop = feed.current.scrollHeight }, [latestId, collapsed, canModerate])
  async function mutate(action: () => Promise<unknown>, success: () => void) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setNotice('')
    const targetChannel = channelId
    try { await action(); if (alive.current && channel.current === targetChannel) success(); await inFlight.current; await refresh() }
    catch (e) { if (alive.current && channel.current === targetChannel) setError(e instanceof Error ? e.message : 'Unable to save. Please try again.') }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  const moderate = (targetId: number, action: string) => mutate(() => moderateLive({ data: { channelId, targetId, action } }), () => setNotice('Moderation saved.'))
  function send(text = body, reaction = false) {
    if (!text.trim() || !data?.canComment) return
    const parentId = reaction ? undefined : reply?.id, announcement = canModerate && activeTab === 'Admin comments'
    const key = JSON.stringify([text, parentId, announcement])
    if (submission.current?.text !== key) submission.current = { text: key, id: crypto.randomUUID() }
    const requestId = submission.current.id
    void mutate(() => sendLiveComment({ data: { channelId, body: text, parentId, announcement, requestId } }), () => {
      if (!reaction) { setBody(''); setReply(null) }
      setReactionsOpen(false); setEmojiOpen(false); submission.current = null; follow.current = true
      setNotice(reaction ? 'Reaction sent to live chat.' : 'Comment sent.')
    })
  }
  function comment(c: Discussion['comments'][number]) {
    return <article key={c.id} className={`live-comment chat-message${c.pinned ? ' is-pinned' : ''}`}>
      <span className="live-comment-avatar" aria-hidden="true">{initials(String(c.author_name || 'Viewer'))}</span>
      <div className="chat-message-content">
        <p><strong className="chat-author">{c.author_name}{c.mine ? ' (you)' : ''}</strong>{!!c.official && <span className="live-official"><ShieldCheck size={12} aria-hidden="true" />Admin</span>}{!!c.pinned && <span className="chat-pinned-label">Pinned</span>}<span className="chat-message-body">{c.body}</span></p>
        {!!c.parent_id && <blockquote>{c.reply_body ? `${c.reply_author}: ${c.reply_body}` : 'Original comment unavailable'}</blockquote>}
      </div>
      {(data?.signedIn || canModerate) && <details className="chat-message-menu"><summary aria-label={`Options for ${c.author_name}’s message`}><MoreHorizontal size={19}/></summary><div>
        {data?.canComment && <button type="button" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setReply(c); composer.current?.focus() }}>Reply</button>}
        {data?.signedIn && <button type="button" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setReport(c.id); setError(''); setDetail('') }}>Report</button>}
        {data?.signedIn && !c.mine && !c.official && <button type="button" onClick={e => { blockTrigger.current=e.currentTarget.closest('details')?.querySelector('summary')??null; e.currentTarget.closest('details')?.removeAttribute('open'); setBlockTarget(c) }}>Block viewer</button>}
        {canModerate && <><button type="button" disabled={busy} onClick={() => void moderate(c.id, 'hide')}>Hide</button><button type="button" disabled={busy} onClick={() => void moderate(c.id, c.pinned ? 'unpin' : 'pin')}>{c.pinned ? 'Unpin' : 'Pin'}</button>{!c.official && <button type="button" disabled={busy} onClick={() => void moderate(c.id, 'mute')}>Mute viewer</button>}</>}
      </div></details>}
    </article>
  }
  return <div className={`live-discussion chat-sheet${collapsed ? ' is-collapsed' : ''}`} data-lenis-prevent>
    <span className="chat-sheet-handle" aria-hidden="true" />
    <header className="live-discussion-heading"><div><h2 id={`${prefix}-heading`}>Live chat</h2><p className="chat-heading-caption">{connection ? 'Reconnecting…' : !data ? 'Connecting…' : data.enabled ? 'Latest messages' : 'Comments paused'}</p></div><div className="chat-heading-actions">
      {data?.signedIn && !collapsed && <button type="button" aria-label="Blocked viewers" aria-expanded={blockedOpen} onClick={() => setBlockedOpen(value => !value)}><UsersRound size={21}/></button>}
      <button type="button" aria-label={collapsed ? 'Open live chat' : 'Close live chat'} aria-expanded={!collapsed} aria-controls={`${prefix}-chat`} onClick={() => setCollapsed(value => !value)}>{collapsed ? <MessageCircle size={22}/> : <X size={23}/>}</button>
    </div></header>
    {!collapsed && <div id={`${prefix}-chat`} className="chat-sheet-content">
      {canModerate && <div className="live-tabs" role="tablist" aria-label="Live moderation sections">{tabs.map(name => <button key={name} id={`${prefix}-${name}`} role="tab" aria-selected={activeTab === name} aria-controls={`${prefix}-feed`} tabIndex={activeTab === name ? 0 : -1} onKeyDown={e => {
        const offset=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0
        if(offset || e.key==='Home' || e.key==='End'){e.preventDefault();const next=tabs[e.key==='Home'?0:e.key==='End'?3:(tabs.indexOf(name)+offset+4)%4];setTab(next);document.getElementById(`${prefix}-${next}`)?.focus()}
      }} onClick={() => {setTab(name);setReply(null)}}>{name}</button>)}</div>}
      {connection && <p role="status" className="chat-notice">{connection} <button type="button" onClick={() => void refresh()}>Retry</button></p>}
      {!data && !connection && <p role="status" className="chat-notice">Loading conversation…</p>}
      {data && <>
        {blockedOpen && <section className="chat-blocked" aria-label="Blocked viewers"><h3>Blocked viewers</h3>{!data.blocked?.length ? <p>No viewers blocked.</p> : data.blocked.map(viewer => <p key={viewer.id}><span>{viewer.author_name}</span><button type="button" disabled={busy} onClick={() => void mutate(() => unblockLiveViewer({data:{blockId:viewer.id}}), () => setNotice('Viewer unblocked.'))}>Unblock</button></p>)}</section>}
        {!data.enabled && <p className="live-notice">Live comments are turned off by the administrator.</p>}
        {!!pinned.length && <div className="chat-pinned" aria-label="Pinned messages">{pinned.map(comment)}</div>}
        <div ref={feed} className="live-feed" role={canModerate ? 'tabpanel' : 'region'} id={`${prefix}-feed`} aria-labelledby={canModerate ? `${prefix}-${activeTab}` : `${prefix}-heading`} tabIndex={0} onScroll={e => {const el=e.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<64}}>
          {canModerate && activeTab === 'Reports' ? <>
            {data.reports.map(r => <article key={r.id} className="live-comment chat-report"><header><strong>{r.reason}</strong><span>{r.status}</span></header><p>{r.body}</p>{r.detail&&<p>{r.detail}</p>}{r.status==='open'&&<div className="live-comment-actions"><button disabled={busy} onClick={()=>void moderate(r.comment_id,'hide')}>Hide comment</button><button disabled={busy} onClick={()=>void moderate(r.id,'resolve')}>Resolve</button><button disabled={busy} onClick={()=>void moderate(r.id,'dismiss')}>Dismiss</button></div>}</article>)}
            {!data.reports.length&&<p className="chat-notice">No reports yet.</p>}
            {data.mutes.length>0&&<section className="chat-blocked" aria-label="Muted viewers"><h3>Muted viewers</h3>{data.mutes.map(m=><p key={m.user_id}>{m.author_name}<button disabled={busy} onClick={()=>void moderate(m.comment_id,'unmute')}>Allow comments</button></p>)}</section>}
          </> : <>{!comments.length&&!pinned.length&&<p className="chat-notice">{activeTab==='Responses'?'Replies will appear here.':activeTab==='Admin comments'?'Official messages will appear here.':'Be the first to join the conversation.'}</p>}{comments.map(comment)}</>}
        </div>
        <div className="chat-welcome"><ShieldCheck size={20} aria-hidden="true"/><p>Welcome to live chat. Keep personal details private and treat others with kindness.</p>
          {data.canComment&&activeTab!=='Reports'&&<div className="chat-reactions"><button type="button" aria-label="Choose a reaction" aria-expanded={reactionsOpen} onClick={()=>setReactionsOpen(value=>!value)}><Heart size={23}/></button>{reactionsOpen&&<div className="chat-reaction-options" role="group" aria-label="Send a reaction">{reactions.map(r=><button type="button" key={r.label} disabled={busy} aria-label={`Send ${r.label} reaction`} onClick={()=>send(r.emoji,true)}>{r.emoji}</button>)}<button type="button" aria-label="Close reactions" onClick={()=>setReactionsOpen(false)}><ChevronDown size={18}/></button></div>}</div>}
        </div>
        {report!==null&&<form ref={reportForm} className="live-composer chat-report-form" aria-label="Report comment" onSubmit={e=>{e.preventDefault();void mutate(()=>reportLiveComment({data:{channelId,commentId:report,reason,detail}}),()=>{setReport(null);setNotice('Report submitted for review.')})}}>
          <label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}>{['spam','abuse','inappropriate','other'].map(r=><option key={r}>{r}</option>)}</select></label><label>Details (optional)<textarea maxLength={500} value={detail} onChange={e=>setDetail(e.target.value)}/></label><div><button className="btn btn-primary" disabled={busy}>Submit report</button><button type="button" onClick={()=>setReport(null)}>Cancel</button></div>
        </form>}
        {activeTab!=='Reports'&&(data.canComment?<form className="live-composer chat-composer" onSubmit={e=>{e.preventDefault();send()}}>
          {reply&&<p className="chat-replying">Replying to {reply.author_name}<button type="button" aria-label="Cancel reply" onClick={()=>setReply(null)}><X size={16}/></button></p>}
          <label className="chat-sr-only" htmlFor={`${prefix}-message`}>{canModerate&&activeTab==='Admin comments'?'Official announcement':'Your comment'}</label>
          <div className="chat-input-row"><div className="chat-input-pill"><textarea ref={composer} id={`${prefix}-message`} rows={1} maxLength={1000} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder="Chat…" required onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/><button type="button" aria-label="Add emoji" aria-expanded={emojiOpen} disabled={busy} onClick={()=>setEmojiOpen(value=>!value)}><Smile size={22}/></button></div><button type="submit" className="chat-send" disabled={busy||!body.trim()} aria-label={busy?'Sending comment':'Send comment'}><Send size={23}/></button></div>
          {emojiOpen&&<div className="chat-emoji-options" role="group" aria-label="Add emoji to comment">{[...reactions,{emoji:'✨',label:'sparkles'},{emoji:'👏',label:'applause'},{emoji:'🔥',label:'fire'}].map(r=><button key={r.label} type="button" aria-label={`Add ${r.label}`} onClick={()=>{setBody(value=>(value+r.emoji).slice(0,1000));setEmojiOpen(false);composer.current?.focus()}}>{r.emoji}</button>)}</div>}
          <p className="chat-composer-hint">{body.length>800?`${body.length}/1,000 · `:''}{data.slowMode?`${data.slowMode}s between messages`:'Share a thought with the community'}</p>
        </form>:<p className="live-sign-in">{!data.signedIn?<>Join the conversation. <a href="/login">Sign in</a></>:data.commentReason}{data.signedIn&&!data.muted&&data.enabled?<a href="/manage-profile"> Choose profile</a>:null}</p>)}
      </>}
      {error&&<p role="alert" className="live-error chat-notice">{error}</p>}{notice&&<p role="status" className="chat-notice chat-status">{notice}</p>}
    </div>}
    {blockTarget&&<dialog ref={blockDialog} className="chat-block-dialog" aria-labelledby={`${prefix}-block-title`} onCancel={e=>{e.preventDefault();setBlockTarget(null)}} onKeyDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setBlockTarget(null)}}><h2 id={`${prefix}-block-title`}>Block {blockTarget.author_name}?</h2><p>You won’t see each other’s live chat messages while signed in. Moderators can still see messages. You can undo this from Blocked viewers.</p><div><button type="button" autoFocus onClick={()=>setBlockTarget(null)}>Cancel</button><button type="button" disabled={busy} onClick={()=>void mutate(()=>blockLiveViewer({data:{channelId,commentId:blockTarget.id}}),()=>{setBlockTarget(null);setReply(null);setNotice('Viewer blocked.')} )}>Block</button></div>{error&&<p role="alert">{error}</p>}</dialog>}
  </div>
}
