/** Rentals remain separate purchases. All other non-free restricted content needs a plan. */
export function requiresSubscription(item: {movie_access?:unknown;access?:unknown;plan_id?:unknown}) {
 const access=item.movie_access??item.access
 return access==='subscription'||access==='premium'||(access!=null&&access!==''&&access!=='free'&&access!=='paid')||((access==null||access==='')&&Number(item.plan_id)>0)
}
export function subscriptionFields<T extends Record<string,any>>(item:T,entitlement:{plan_id:number}|null,deviceAllowed:boolean):T & {hasSubscriptionAccess?:boolean} {
 if(!requiresSubscription(item)) return item
 const allowed=!!entitlement&&deviceAllowed&&(!Number(item.plan_id)||Number(item.plan_id)===Number(entitlement.plan_id))
 return allowed ? {...item,hasSubscriptionAccess:true} : {...item,hasSubscriptionAccess:false,bunny_video_url:null,video_url_input:null,video_url:null,video_url_output:null,download_url:null}
}
