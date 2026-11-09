import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { all, first, run } from './db'
import { getActiveViewer } from './viewer.server'
import { liveUrl, liveEmbedUrl, resolveLiveSource } from './liveSources'
import { subscriptionPlaybackAccess, entitlementDatabase } from './entitlement.server'
import { resolveEntitlement } from './entitlement-core'

const id = (n: unknown) => { if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1) throw new Error('Choose a valid channel or message.'); return n }
function writeOrigin() {
 const origin = getRequestHeader('origin')
 if (origin && origin !== new URL(getRequestUrl()).origin) throw new Error('This request is not allowed.')
 if (getRequestHeader('sec-fetch-site') === 'cross-site') throw new Error('This request is not allowed.')
}
async function actor() {
 setResponseHeader('Cache-Control','private, no-store')
 const viewer = await getActiveViewer()
 if (!viewer) return null
 const u = await first<any>('SELECT user_type,first_name,last_name FROM users WHERE id=? AND status=1 AND deleted_at IS NULL AND COALESCE(is_banned,0)=0', viewer.userId)
 if (!u) return null
 return { ...viewer, admin: u.user_type === 'admin', name: viewer.profileName || [u.first_name,u.last_name].filter(Boolean).join(' ') || 'Viewer' }
}
async function admin() { const a = await actor(); if (!a?.admin) throw new Error('Administrator access required.'); return a }
async function channelFor(channelId: number, a: Awaited<ReturnType<typeof actor>>) {
 const c = await first<any>('SELECT id,name,slug,poster_url,description,access,plan_id,category_id FROM live_tv_channel WHERE id=? AND status=1 AND deleted_at IS NULL',id(channelId))
 if (!c) throw new Error('Channel not available.')
 if (!a?.admin && c.access !== 'free') {
  if (!a) throw new Error('Sign in to watch this channel.')
  const entitlement = await resolveEntitlement(entitlementDatabase(),a.userId)
  const mappings=await all<{plan_id:number}>('SELECT plan_id FROM live_tv_channel_plan_mapping WHERE tv_channel_id=? AND deleted_at IS NULL',c.id)
  const plans=[Number(c.plan_id),...mappings.map(row=>Number(row.plan_id))].filter(Boolean)
  const access=entitlement&&(!plans.length||plans.includes(entitlement.plan_id))&&await subscriptionPlaybackAccess()
  if (!access) throw new Error('An active channel subscription and an available shared device are required. Manage devices in your account.')
 }
 return c
}
async function settingsFor(channelId: number) {
 return await first<any>('SELECT * FROM live_channel_settings WHERE channel_id=?',channelId) || { channel_id: channelId, comments_enabled: 1, slow_mode: 5, source_kind: 'hls', hls_url: '', ingest_url: '' }
}
async function chatActor(channelId: number) {
 const a=await actor(); await channelFor(channelId,a)
 if (!a) throw new Error('Sign in to join the conversation.')
 if (!a.admin) {
  if (!a.profileId) throw new Error('Choose a profile to join the conversation.')
  const profile=await first<any>('SELECT is_child_profile FROM user_multi_profiles WHERE id=? AND user_id=? AND deleted_at IS NULL',a.profileId,a.userId)
  if (!profile || profile.is_child_profile) throw new Error('Comments are unavailable for this profile.')
  if (await first('SELECT 1 FROM live_chat_mutes WHERE channel_id=? AND user_id=?',channelId,a.userId)) throw new Error('Your commenting access is paused for this channel.')
 }
 return a
}
export const getLiveChannel = createServerFn({method:'GET'}).validator(id).handler(async({data:channelId})=>{
 const a=await actor(), channel=await channelFor(channelId,a), settings=await settingsFor(channelId)
 const mappings=await all<any>('SELECT stream_type,server_url,server_url1 FROM live_tv_stream_content_mapping WHERE tv_channel_id=? AND deleted_at IS NULL ORDER BY id DESC',channelId)
 const streamUrl=resolveLiveSource(settings,mappings)
 const related=await all<any>('SELECT id,name,slug,poster_url FROM live_tv_channel WHERE id<>? AND status=1 AND deleted_at IS NULL ORDER BY name LIMIT 12',channelId)
 return {channel,related,streamUrl,viewerId:a?.userId??null,isAdmin:a?.admin??false,commentsEnabled:!!settings.comments_enabled,
  unavailable:streamUrl?null:'This channel is not broadcasting yet. Please try again shortly.'}
})
export const getLiveDiscussion = createServerFn({method:'GET'}).validator((d:{channelId:number})=>({channelId:id(d.channelId)})).handler(async({data})=>{
 const a=await actor(); await channelFor(data.channelId,a);const settings=await settingsFor(data.channelId)
 const comments=await all<any>(`SELECT c.id,c.body,c.parent_id,c.kind,c.official,c.pinned,c.author_name,c.created_at,c.user_id,
  p.body AS reply_body,p.author_name AS reply_author FROM live_comments c LEFT JOIN live_comments p ON p.id=c.parent_id AND p.hidden=0
   AND (?=1 OR NOT EXISTS(SELECT 1 FROM live_chat_blocks b WHERE (b.user_id=? AND b.blocked_user_id=p.user_id) OR (b.user_id=p.user_id AND b.blocked_user_id=?)))
  WHERE c.channel_id=? AND c.hidden=0
   AND (?=1 OR NOT EXISTS(SELECT 1 FROM live_chat_blocks b WHERE (b.user_id=? AND b.blocked_user_id=c.user_id) OR (b.user_id=c.user_id AND b.blocked_user_id=?)))
  ORDER BY c.pinned DESC,c.id DESC LIMIT 80`,a?.admin?1:0,a?.userId??0,a?.userId??0,data.channelId,a?.admin?1:0,a?.userId??0,a?.userId??0)
 const blocked=a?await all<{id:number;author_name:string}>('SELECT id,author_name FROM live_chat_blocks WHERE user_id=? ORDER BY id DESC LIMIT 200',a.userId):[]
 const reports=a?await all<any>(`SELECT r.id,r.comment_id,r.reason,r.detail,r.status,r.created_at,c.body,c.author_name FROM live_comment_reports r JOIN live_comments c ON c.id=r.comment_id WHERE r.channel_id=?${a.admin?'':' AND r.user_id=?'} ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END,r.id DESC LIMIT 80`,data.channelId,...(a.admin?[]:[a.userId])):[]
 const mutes=a?.admin?await all<any>('SELECT m.user_id,c.id AS comment_id,c.author_name FROM live_chat_mutes m JOIN live_comments c ON c.id=(SELECT MAX(id) FROM live_comments WHERE channel_id=m.channel_id AND user_id=m.user_id) WHERE m.channel_id=?',data.channelId):[]
 const profile=a?.profileId?await first<any>('SELECT is_child_profile FROM user_multi_profiles WHERE id=? AND user_id=? AND deleted_at IS NULL',a.profileId,a.userId):null
 const muted=a?!!await first('SELECT 1 FROM live_chat_mutes WHERE channel_id=? AND user_id=?',data.channelId,a.userId):false
 return {blocked,mutes,canComment:!!a && (a.admin || (!!profile && !profile.is_child_profile && !muted && !!settings.comments_enabled)),commentReason:!a?'Sign in to join the conversation.':!a.admin&&!profile?'Choose a profile to comment.':!a.admin&&profile?.is_child_profile?'Comments are unavailable for this profile.':muted?'Your commenting access is paused.':!settings.comments_enabled?'Live comments are turned off.':'',comments:comments.map(({user_id,...c})=>({...c,mine:user_id===a?.userId})),reports,enabled:!!settings.comments_enabled,slowMode:settings.slow_mode,signedIn:!!a,isAdmin:a?.admin??false,muted}
})
export const sendLiveComment = createServerFn({method:'POST'}).validator((d:{channelId:number;body:string;parentId?:number;announcement?:boolean;requestId:string})=>{
 id(d.channelId);if(d.parentId)id(d.parentId)
 if(typeof d.body!=='string'||!d.body.trim()||d.body.trim().length>1000||typeof d.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(d.requestId))throw new Error('Write a message of 1–1,000 characters.')
 return {...d,body:d.body.trim()}
}).handler(async({data:d})=>{
 writeOrigin();const a=await chatActor(d.channelId)
 if(d.announcement&&!a.admin)throw new Error('Only administrators can post announcements.')
 const existing=await first('SELECT id FROM live_comments WHERE channel_id=? AND user_id=? AND request_id=?',d.channelId,a.userId,d.requestId);if(existing)return{ok:true}
 if(d.parentId&&!await first(`SELECT c.id FROM live_comments c WHERE c.id=? AND c.channel_id=? AND c.hidden=0
  AND (?=1 OR NOT EXISTS(SELECT 1 FROM live_chat_blocks b WHERE (b.user_id=? AND b.blocked_user_id=c.user_id) OR (b.user_id=c.user_id AND b.blocked_user_id=?)))`,d.parentId,d.channelId,a.admin?1:0,a.userId,a.userId))throw new Error('That comment is no longer available.')
 const result=await run(`INSERT INTO live_comments(channel_id,user_id,profile_id,author_name,body,parent_id,kind,official,request_id)
  SELECT ?,?,?,?,?,?,?,?,? WHERE (?=1 OR (COALESCE((SELECT comments_enabled FROM live_channel_settings WHERE channel_id=?),1)=1
   AND NOT EXISTS(SELECT 1 FROM live_chat_mutes WHERE channel_id=? AND user_id=?)))
  AND NOT EXISTS(SELECT 1 FROM live_comments WHERE user_id=? AND channel_id=? AND created_at>datetime('now','-' || MAX(1,COALESCE((SELECT slow_mode FROM live_channel_settings WHERE channel_id=?),5)) || ' seconds'))
  AND (? IS NULL OR EXISTS(SELECT 1 FROM live_comments c WHERE c.id=? AND c.channel_id=? AND c.hidden=0
    AND (?=1 OR NOT EXISTS(SELECT 1 FROM live_chat_blocks b WHERE (b.user_id=? AND b.blocked_user_id=c.user_id) OR (b.user_id=c.user_id AND b.blocked_user_id=?)))))`,
 d.channelId,a.userId,a.profileId,a.name,d.body,d.parentId??null,d.announcement?'announcement':'comment',a.admin?1:0,d.requestId,a.admin?1:0,d.channelId,d.channelId,a.userId,a.userId,d.channelId,d.channelId,d.parentId??null,d.parentId??null,d.channelId,a.admin?1:0,a.userId,a.userId)
 if(!(result.meta?.changes??result.changes))throw new Error('Comments are paused, or you are posting too quickly. Please try again shortly.')
 return{ok:true}
})
export const reportLiveComment=createServerFn({method:'POST'}).validator((d:{channelId:number;commentId:number;reason:string;detail:string})=>{
 id(d.channelId);id(d.commentId);if(!['spam','abuse','inappropriate','other'].includes(d.reason)||typeof d.detail!=='string'||d.detail.length>500)throw new Error('Choose a reason and use at most 500 characters.');return d
}).handler(async({data:d})=>{
 writeOrigin();const a=await actor();await channelFor(d.channelId,a);if(!a)throw new Error('Sign in to report a comment.')
 if(!await first('SELECT id FROM live_comments WHERE id=? AND channel_id=? AND hidden=0',d.commentId,d.channelId))throw new Error('Comment not available.')
 if(await first('SELECT id FROM live_comment_reports WHERE comment_id=? AND user_id=?',d.commentId,a.userId))return{ok:true}
 const result=await run(`INSERT INTO live_comment_reports(channel_id,comment_id,user_id,reason,detail) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM live_comment_reports WHERE user_id=? AND created_at>datetime('now','-1 minute'))<5 ON CONFLICT(comment_id,user_id) DO NOTHING`,d.channelId,d.commentId,a.userId,d.reason,d.detail.trim(),a.userId)
 if(!(result.meta?.changes??result.changes))throw new Error('Please wait before sending another report.');return{ok:true}
})
export const getLiveAdmin=createServerFn({method:'GET'}).handler(async()=>{
 await admin();return{channels:await all<any>(`SELECT c.id,c.name,c.status,c.access,s.hls_url,s.ingest_url,s.embed_url,s.source_kind,COALESCE(s.comments_enabled,1) AS comments_enabled,COALESCE(s.slow_mode,5) AS slow_mode FROM live_tv_channel c LEFT JOIN live_channel_settings s ON s.channel_id=c.id WHERE c.deleted_at IS NULL ORDER BY c.name`)}
})
export const saveLiveSettings=createServerFn({method:'POST'}).validator((d:{channelId:number;sourceKind:'hls'|'rtmp'|'embed';hlsUrl:string;ingestUrl:string;embedUrl?:string;commentsEnabled:boolean;slowMode:number})=>{
 id(d.channelId);if(!['hls','rtmp','embed'].includes(d.sourceKind)||typeof d.commentsEnabled!=='boolean'||!Number.isInteger(d.slowMode)||d.slowMode<0||d.slowMode>120)throw new Error('Invalid channel settings.')
 // Source fields can remain in UI state after switching modes. Only the selected
 // source is validated or persisted; hidden obsolete addresses must not block saving.
 const hls=d.sourceKind==='embed'?'':typeof d.hlsUrl==='string'?d.hlsUrl.trim():null
 const ingest=d.sourceKind==='rtmp'&&typeof d.ingestUrl==='string'?liveUrl(d.ingestUrl,'rtmp'):null
 const embed=d.sourceKind==='embed'?liveEmbedUrl(d.embedUrl):null
 if(hls===null||(hls&&!liveUrl(hls)))throw new Error('Use a public HTTPS HLS playback URL.')
 if(d.sourceKind==='embed'&&!embed)throw new Error('Use a supported Viewmedia, YouTube or Vimeo player URL.')
 if(d.sourceKind==='rtmp'&&(!hls||!ingest))throw new Error('Add the existing service’s RTMP ingest and its HLS playback URL.')
 return {...d,hlsUrl:hls?liveUrl(hls)!:'',ingestUrl:ingest??'',embedUrl:embed??''}
}).handler(async({data:d})=>{
 writeOrigin();const a=await admin();if(!await first('SELECT id FROM live_tv_channel WHERE id=? AND deleted_at IS NULL',d.channelId))throw new Error('Channel not found.')
 await run(`INSERT INTO live_channel_settings(channel_id,source_kind,hls_url,ingest_url,embed_url,comments_enabled,slow_mode,updated_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(channel_id) DO UPDATE SET source_kind=excluded.source_kind,hls_url=excluded.hls_url,ingest_url=excluded.ingest_url,embed_url=excluded.embed_url,comments_enabled=excluded.comments_enabled,slow_mode=excluded.slow_mode,updated_by=excluded.updated_by,updated_at=datetime('now')`,d.channelId,d.sourceKind,d.sourceKind==='embed'?null:d.hlsUrl.trim()||null,d.sourceKind==='rtmp'?d.ingestUrl.trim():null,d.sourceKind==='embed'?liveEmbedUrl(d.embedUrl):null,d.commentsEnabled?1:0,d.slowMode,a.userId)
 await run('INSERT INTO live_moderation_log(channel_id,admin_id,action) VALUES(?,?,?)',d.channelId,a.userId,'settings');return{ok:true}
})
export const moderateLive=createServerFn({method:'POST'}).validator((d:{channelId:number;targetId:number;action:string})=>{
 id(d.channelId);id(d.targetId);if(!['hide','pin','unpin','mute','unmute','resolve','dismiss'].includes(d.action))throw new Error('Invalid moderation action.');return d
}).handler(async({data:d})=>{
 writeOrigin();const a=await admin();await channelFor(d.channelId,a)
 if(['resolve','dismiss'].includes(d.action)) {
  if(!await first('SELECT id FROM live_comment_reports WHERE id=? AND channel_id=?',d.targetId,d.channelId))throw new Error('Report not found.')
  await run('UPDATE live_comment_reports SET status=?,resolved_by=? WHERE id=? AND channel_id=?',d.action==='resolve'?'resolved':'dismissed',a.userId,d.targetId,d.channelId)
 } else {
  const c=await first<any>('SELECT user_id FROM live_comments WHERE id=? AND channel_id=?',d.targetId,d.channelId);if(!c)throw new Error('Comment not found.')
  if(d.action==='hide')await run('UPDATE live_comments SET hidden=1,pinned=0 WHERE id=? AND channel_id=?',d.targetId,d.channelId)
  else if(d.action==='pin'||d.action==='unpin')await run('UPDATE live_comments SET pinned=? WHERE id=? AND channel_id=?',d.action==='pin'?1:0,d.targetId,d.channelId)
  else if(d.action==='mute')await run('INSERT INTO live_chat_mutes(channel_id,user_id,moderator_id) VALUES(?,?,?) ON CONFLICT(channel_id,user_id) DO NOTHING',d.channelId,c.user_id,a.userId)
  else await run('DELETE FROM live_chat_mutes WHERE channel_id=? AND user_id=?',d.channelId,c.user_id)
 }
 await run('INSERT INTO live_moderation_log(channel_id,admin_id,action,target_id) VALUES(?,?,?,?)',d.channelId,a.userId,d.action,d.targetId);return{ok:true}
})

/** Resolve the target from a visible comment; never accept a client-supplied account ID. */
export const blockLiveViewer=createServerFn({method:'POST'}).validator((d:{channelId:number;commentId:number})=>({channelId:id(d.channelId),commentId:id(d.commentId)})).handler(async({data:d})=>{
 writeOrigin();const a=await actor();await channelFor(d.channelId,a);if(!a)throw new Error('Sign in to block a viewer.')
 const c=await first<any>(`SELECT c.user_id,c.author_name,u.user_type FROM live_comments c JOIN users u ON u.id=c.user_id WHERE c.id=? AND c.channel_id=? AND c.hidden=0`,d.commentId,d.channelId)
 if(!c||c.user_id===a.userId||c.user_type==='admin')throw new Error('This viewer cannot be blocked.')
 const result=await run(`INSERT INTO live_chat_blocks(user_id,blocked_user_id,author_name) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM live_chat_blocks WHERE user_id=?)<200 ON CONFLICT(user_id,blocked_user_id) DO NOTHING`,a.userId,c.user_id,c.author_name,a.userId)
 if(!(result.meta?.changes??result.changes)&&!await first('SELECT id FROM live_chat_blocks WHERE user_id=? AND blocked_user_id=?',a.userId,c.user_id))throw new Error('Your blocked list is full. Unblock someone before adding another viewer.')
 return{ok:true}
})
export const unblockLiveViewer=createServerFn({method:'POST'}).validator((d:{blockId:number})=>({blockId:id(d.blockId)})).handler(async({data:d})=>{
 writeOrigin();const a=await actor();if(!a)throw new Error('Sign in to manage blocked viewers.')
 await run('DELETE FROM live_chat_blocks WHERE id=? AND user_id=?',d.blockId,a.userId)
 return{ok:true}
})
