/** Database policy shared by server functions and the isolated SQLite gate. */
export type Entitlement = { subscription_id:number; owner_user_id:number; user_id:number; membership_id:string|null; name:string; plan_id:number; level:number; start_date:string|null; end_date:string; user_limit:number; device_limit:number }
export type MembershipRow = {id:string;invited_email:string;accepted_at:string|null;expires_at:number;seat:number;state:string}
export type SubscriptionDeviceRow = {id:string;label:string;last_seen:string;user_id:number;current:number;active:number}
export type SubscriptionActor = { uid:number; email:string; sessionId:string }
export async function resolveEntitlement(db:D1Database,userId:number) {
 return db.prepare('SELECT * FROM r2_entitled_users WHERE user_id=? ORDER BY membership_id IS NULL DESC LIMIT 1').bind(userId).first<Entitlement>()
}
export async function admitSubscriptionDevice(db:D1Database,actor:SubscriptionActor,label:string) {
 // This single conditional INSERT is serialized by SQLite/D1. A previously revoked
 // session cannot re-enrol, and concurrent requests cannot oversubscribe the pool.
 await db.prepare(`INSERT OR IGNORE INTO subscription_devices(id,owner_user_id,user_id,session_id,label)
  SELECT ?,e.owner_user_id,e.user_id,?,? FROM r2_entitled_users e
  JOIN ba_viewer_session bs ON bs.id=? AND bs.userId=e.user_id
  WHERE e.user_id=? AND
  (CASE WHEN CAST(bs.expiresAt AS TEXT) NOT GLOB '*[^0-9.]*' THEN CAST(bs.expiresAt AS REAL)/1000.0 ELSE (julianday(bs.expiresAt)-2440587.5)*86400 END)>unixepoch()
  AND (SELECT COUNT(*) FROM r2_valid_subscription_devices d WHERE d.owner_user_id=e.owner_user_id)<e.device_limit
  ORDER BY e.membership_id IS NULL DESC LIMIT 1`).bind(crypto.randomUUID(),actor.sessionId,label.slice(0,120),actor.sessionId,actor.uid).run()
 const device=await db.prepare('SELECT id FROM r2_active_subscription_devices WHERE session_id=? AND user_id=?').bind(actor.sessionId,actor.uid).first()
 if (!device) return false
 await db.prepare("UPDATE subscription_devices SET last_seen=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id=? AND revoked_at IS NULL").bind(actor.sessionId).run()
 return true
}
export async function inviteSubscriptionMember(db:D1Database,actor:SubscriptionActor,email:string,hash:string) {
 if(email===actor.email.trim().toLowerCase()) throw new Error('The owner is already included in this plan.')
 const id=crypto.randomUUID()
 await db.batch([
  db.prepare("UPDATE subscription_members SET revoked_at=datetime('now') WHERE owner_user_id=? AND member_user_id IS NULL AND revoked_at IS NULL AND expires_at<=unixepoch()").bind(actor.uid),
  db.prepare(`INSERT OR IGNORE INTO subscription_members(id,owner_user_id,seat,invited_email,token_hash,expires_at)
   SELECT ?,o.owner_user_id,seats.seat,?,?,unixepoch()+604800 FROM r2_active_subscription_owners o
   JOIN (SELECT 1 AS seat UNION ALL SELECT 2 UNION ALL SELECT 3) seats ON seats.seat<o.user_limit
   WHERE o.owner_user_id=? AND NOT EXISTS(SELECT 1 FROM subscription_members m WHERE m.owner_user_id=o.owner_user_id AND m.seat=seats.seat AND m.revoked_at IS NULL)
   ORDER BY seats.seat LIMIT 1`).bind(id,email,hash,actor.uid),
 ])
 const inserted=await db.prepare('SELECT id FROM subscription_members WHERE id=?').bind(id).first()
 if(!inserted) throw new Error('No invitation was created. Check your active plan, available spaces and existing invitations.')
 return id
}
export async function acceptSubscriptionInvite(db:D1Database,actor:SubscriptionActor,hash:string) {
 // Matching the authenticated database identity prevents forwarding a link to a
 // different account. Conditional UPDATE rechecks dates, capacity and membership.
 await db.prepare(`UPDATE subscription_members SET member_user_id=?,accepted_at=datetime('now')
 WHERE token_hash=? AND revoked_at IS NULL AND member_user_id IS NULL AND expires_at>unixepoch()
 AND invited_email=(SELECT LOWER(TRIM(email)) FROM users WHERE id=? AND status=1 AND COALESCE(is_banned,0)=0 AND deleted_at IS NULL)
 AND owner_user_id<>? AND EXISTS(SELECT 1 FROM r2_active_subscription_owners o WHERE o.owner_user_id=subscription_members.owner_user_id AND subscription_members.seat<o.user_limit)
 AND NOT EXISTS(SELECT 1 FROM r2_active_subscription_owners o WHERE o.owner_user_id=?)
 AND NOT EXISTS(SELECT 1 FROM subscription_members m WHERE m.member_user_id=? AND m.revoked_at IS NULL)`)
 .bind(actor.uid,hash,actor.uid,actor.uid,actor.uid,actor.uid).run()
 const membership=await db.prepare('SELECT id FROM subscription_members WHERE token_hash=? AND member_user_id=? AND revoked_at IS NULL AND accepted_at IS NOT NULL').bind(hash,actor.uid).first<{id:string}>()
 const entitlement=await resolveEntitlement(db,actor.uid)
 if(!membership || entitlement?.membership_id!==membership.id) throw new Error('This invitation cannot be accepted. Sign in with the invited email, or ask the owner for a new link and an available space.')
 return {ok:true as const}
}
export async function removeSubscriptionMember(db:D1Database,actor:SubscriptionActor,id:string) {
 // Owners can revoke even after expiry; members may leave their own membership.
 await db.batch([
  db.prepare(`UPDATE subscription_devices SET revoked_at=datetime('now') WHERE EXISTS(SELECT 1 FROM subscription_members m WHERE m.id=? AND (m.owner_user_id=? OR m.member_user_id=?) AND m.owner_user_id=subscription_devices.owner_user_id AND m.member_user_id=subscription_devices.user_id)`).bind(id,actor.uid,actor.uid),
  db.prepare(`DELETE FROM ba_viewer_session WHERE id IN (SELECT d.session_id FROM subscription_devices d JOIN subscription_members m ON m.owner_user_id=d.owner_user_id AND m.member_user_id=d.user_id WHERE m.id=? AND (m.owner_user_id=? OR m.member_user_id=?))`).bind(id,actor.uid,actor.uid),
  db.prepare("UPDATE subscription_members SET revoked_at=datetime('now') WHERE id=? AND (owner_user_id=? OR member_user_id=?) AND revoked_at IS NULL").bind(id,actor.uid,actor.uid),
 ])
 return {ok:true as const}
}
export async function revokeSubscriptionDevice(db:D1Database,actor:SubscriptionActor,id:string) {
 await db.batch([
  db.prepare("DELETE FROM ba_viewer_session WHERE id IN (SELECT session_id FROM subscription_devices WHERE id=? AND (owner_user_id=? OR user_id=?))").bind(id,actor.uid,actor.uid),
  db.prepare("UPDATE subscription_devices SET revoked_at=datetime('now') WHERE id=? AND (owner_user_id=? OR user_id=?)").bind(id,actor.uid,actor.uid),
 ])
 return {ok:true as const}
}
export async function subscriptionDashboard(db:D1Database,actor:SubscriptionActor) {
 const entitlement=await resolveEntitlement(db,actor.uid)
 const isOwner=entitlement?.owner_user_id===actor.uid
 const ownMembership=await db.prepare('SELECT id FROM subscription_members WHERE member_user_id=? AND revoked_at IS NULL').bind(actor.uid).first<{id:string}>()
 // Owners see membership emails and device labels, never members' profiles,
 // library, session credentials or IP addresses. Members see only their devices.
 const members=await db.prepare(`SELECT id,invited_email,accepted_at,expires_at,seat,CASE WHEN member_user_id IS NULL AND expires_at<=unixepoch() THEN 'expired' WHEN ? IS NULL OR seat>=? THEN 'paused' WHEN accepted_at IS NOT NULL THEN 'active' ELSE 'invited' END AS state
 FROM subscription_members WHERE owner_user_id=? AND revoked_at IS NULL ORDER BY seat`).bind(isOwner?entitlement.subscription_id:null,isOwner?entitlement.user_limit:0,actor.uid).all<MembershipRow>()
 const devices=await db.prepare(`SELECT d.id,d.label,d.last_seen,d.user_id,CASE WHEN d.session_id=? THEN 1 ELSE 0 END AS current,
 CASE WHEN EXISTS(SELECT 1 FROM r2_active_subscription_devices a WHERE a.id=d.id) THEN 1 ELSE 0 END AS active
 FROM subscription_devices d JOIN ba_viewer_session bs ON bs.id=d.session_id
 WHERE d.revoked_at IS NULL AND (d.owner_user_id=? OR d.user_id=?) ORDER BY d.created_at,d.id`).bind(actor.sessionId,actor.uid,actor.uid).all<SubscriptionDeviceRow>()
 return {entitlement:entitlement ? {name:entitlement.name,end_date:entitlement.end_date,status:'active' as const,user_limit:entitlement.user_limit,device_limit:entitlement.device_limit,role:isOwner?'owner' as const:'member' as const,membership_id:entitlement.membership_id}:null,ownMembershipId:ownMembership?.id??null,members:members.results,devices:devices.results}
}
