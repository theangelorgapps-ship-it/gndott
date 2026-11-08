import { env } from 'cloudflare:workers'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { getSession } from './session.server'
import { admitSubscriptionDevice, resolveEntitlement } from './entitlement-core'
export function entitlementDatabase(){ return (env as any).DB as D1Database }
export async function subscriptionPlaybackAccess(requiredPlanId?:unknown) {
 setResponseHeader('Cache-Control','private, no-store')
 const actor=await getSession()
 if(!actor) return false
 const db=entitlementDatabase(), entitlement=await resolveEntitlement(db,actor.uid)
 if(!entitlement) return false
 // Plan-specific media keeps its existing plan boundary.
 if(requiredPlanId && Number(requiredPlanId)!==entitlement.plan_id) return false
 const agent=getRequestHeader('user-agent')||''
 const platform=/iPad|iPhone/.test(agent)?'Apple mobile':/Android/.test(agent)?'Android':/Windows/.test(agent)?'Windows':/Macintosh/.test(agent)?'Mac':'Web'
 const browser=/Edg\//.test(agent)?'Edge':/Firefox\//.test(agent)?'Firefox':/Chrome\//.test(agent)?'Chrome':/Safari\//.test(agent)?'Safari':'browser'
 return admitSubscriptionDevice(db,actor,`${platform} · ${browser}`)
}
