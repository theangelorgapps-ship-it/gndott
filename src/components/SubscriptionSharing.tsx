import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { createMemberInvite, removeMember, revokeMemberDevice } from '../lib/membership'
import '../subscription-sharing.css'
type Sharing = {entitlement:{role:'owner'|'member';user_limit:number;device_limit:number}|null;ownMembershipId:string|null;members:any[];devices:any[]}
export function SubscriptionSharing({sharing}:{sharing:Sharing}){
 const router=useRouter(),[email,setEmail]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [pending,setPending]=useState<{type:'member'|'device';id:string}|null>(null)
 async function act(action:()=>Promise<unknown>){setBusy(true);setMessage('');try{await action();await router.invalidate()}catch(error){setMessage(error instanceof Error?error.message:'Could not update shared access. Please try again.')}finally{setBusy(false)}}
 const plan=sharing.entitlement
 return <section className="acct-card subscription-sharing" aria-labelledby="sharing-title">
  <h2 id="sharing-title">Shared subscription</h2>
  <p>Monthly includes 2 separate email logins and 5 devices. Annual includes 4 separate email logins and 10 devices. The owner is included; devices are pooled across everyone.</p>
  <p>Each person keeps their own profiles, watchlist and history. Only the owner manages billing. A device is an active browser or app sign-in used for subscription playback.</p>
  {plan?.role==='owner'&&<>
   <h3>People · {1+sharing.members.filter(m=>m.state==='active'||m.state==='invited').length} of {plan.user_limit}</h3><p>You · subscription owner</p>
   {sharing.members.map(member=><div className="sharing-row" key={member.id}><div><strong>{member.invited_email}</strong><span>{member.state==='paused'?'Paused by the current plan':member.state==='expired'?'Invitation expired':member.state==='active'?'Member':'Invitation pending · expires '+new Date(Number(member.expires_at)*1000).toLocaleDateString()}</span></div><button type="button" className="btn btn-dark" disabled={busy} onClick={()=>setPending({type:'member',id:member.id})}>{member.accepted_at?'Remove':'Revoke invitation'}</button></div>)}
   <form onSubmit={event=>{event.preventDefault();void act(async()=>{const result=await createMemberInvite({data:{email}});setLink(result.url);setEmail('')})}}>
    <label htmlFor="member-email">Invite by email address</label><div className="sharing-invite"><input id="member-email" type="email" autoComplete="off" required maxLength={254} value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/><button className="btn btn-primary" disabled={busy}>{busy?'Working…':'Create invite link'}</button></div>
    <p>No email is sent. Share the link yourself; it expires after 7 days and only the invited email can accept it.</p>
   </form>
  </>}
  {plan?.role==='member'&&<p>You are a member of this shared plan. Your subscription access ends if the owner removes you or their plan expires.</p>}
  {!plan&&<p>No active shared access. Existing memberships may be paused by an expired or smaller plan.</p>}
  {!plan&&sharing.members.map(member=><div className="sharing-row" key={member.id}><span>{member.invited_email} · paused</span><button className="btn btn-dark" disabled={busy} onClick={()=>setPending({type:'member',id:member.id})}>Remove</button></div>)}
  {sharing.ownMembershipId&&<button className="btn btn-dark" disabled={busy} onClick={()=>setPending({type:'member',id:sharing.ownMembershipId!})}>Leave shared subscription</button>}
  {link&&<div className="sharing-link"><label htmlFor="member-invite-link">Private invitation link · shown only now</label><input id="member-invite-link" readOnly value={link} onFocus={event=>event.currentTarget.select()}/><button className="btn btn-dark" type="button" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage('Invitation link copied.')).catch(()=>setMessage('Select and copy the invitation link above.'))}>Copy link</button></div>}
  <h3>{plan?.role==='owner'?'Shared devices':'Your devices'}{plan?` · maximum ${plan.device_limit} across the plan`:''}</h3>
  <p>Devices register when they first use subscription playback. Removing a device signs out that session. If the limit is full, remove an unused device and reload the title.</p>
  {sharing.devices.length===0&&<p>No registered subscription devices.</p>}
  {sharing.devices.map(device=><div className="sharing-row" key={device.id}><div><strong>{device.label}{device.current?' · this session':''}</strong><span>{device.active?'Active':'Paused'} · last used {String(device.last_seen).slice(0,10)}</span></div><button className="btn btn-dark" disabled={busy} onClick={()=>setPending({type:'device',id:device.id})}>Remove device</button></div>)}
  {pending&&<div className="sharing-confirm" role="group" aria-label="Confirm removal"><p>{pending.type==='device'?'Sign out this device?':'Remove this membership or invitation? Registered subscription sessions for the member will be signed out. Their personal data stays in their own account.'}</p><button className="btn btn-primary" disabled={busy} onClick={()=>void act(async()=>{if(pending.type==='device')await revokeMemberDevice({data:{id:pending.id}});else await removeMember({data:{id:pending.id}});setPending(null);setLink('')})}>Confirm removal</button><button className="btn btn-dark" disabled={busy} onClick={()=>setPending(null)}>Keep</button></div>}
  {message&&<p role="status">{message}</p>}
 </section>
}
