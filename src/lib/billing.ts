import {createServerFn} from '@tanstack/react-start'
import {first,run} from './db'
import {getActiveViewer} from './viewer.server'
type BillingRecord={id:number;user_id:number;payment_id:string|number;plan_type:string;end_date:string|null;is_manual:number;status:string}
export type CancellationState={kind:'none'|'one-time'|'recurring'|'external'|'unavailable';id?:number;end?:string|null;cancelled?:boolean;message:string;manageUrl?:string}
const api='https://api.stripe.com/v1'
async function secret(){return(await first<{val:string}>("SELECT val FROM settings WHERE name='stripe_secretkey' AND deleted_at IS NULL LIMIT 1"))?.val}
async function stripe(path:string,token:string,body?:URLSearchParams,transport:typeof fetch=fetch){const result=await transport(`${api}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Stripe-Version':'2025-04-30.basil',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?.toString(),signal:AbortSignal.timeout(15000)});if(!result.ok)throw new Error('Unable to reach billing. Please try again.');return result.json() as Promise<any>}
export async function inspectBilling(record:BillingRecord,token:string|undefined,transport:typeof fetch=fetch):Promise<CancellationState & {providerId?:string}>{
 const end=record.end_date
 if(record.status!=='active')return{kind:'none',message:'No active subscription.'}
 const provider=String(record.plan_type||'').toLowerCase(),id=String(record.payment_id||'')
 if(provider.includes('apple')||provider.includes('appstore'))return{kind:'external',id:record.id,end,message:'Manage or cancel this subscription in your Apple account.',manageUrl:'https://apps.apple.com/account/subscriptions'}
 if(provider.includes('google'))return{kind:'external',id:record.id,end,message:'Manage or cancel this subscription in Google Play.',manageUrl:'https://play.google.com/store/account/subscriptions'}
 if(record.is_manual||provider==='cash')return{kind:'one-time',id:record.id,end,message:'This is a one-time purchase. It will not renew or charge you again.'}
 if(!token)return{kind:'unavailable',id:record.id,end,message:'Billing is temporarily unavailable. Try again or contact Hello@halobox.tv.'}
 let providerId=id
 if(id.startsWith('cs_')){const session=await stripe(`/checkout/sessions/${encodeURIComponent(id)}`,token,undefined,transport);if(session.mode==='payment')return{kind:'one-time',id:record.id,end,message:'This is a one-time purchase. It will not renew or charge you again.'};providerId=typeof session.subscription==='string'?session.subscription:session.subscription?.id}
 if(!/^sub_[a-zA-Z0-9]+$/.test(providerId||''))return{kind:'unavailable',id:record.id,end,message:'This plan needs billing support. Contact Hello@halobox.tv to cancel; include your account email.'}
 const sub=await stripe(`/subscriptions/${providerId}`,token,undefined,transport)
 const timestamp=sub.cancel_at||sub.current_period_end||Math.max(0,...(sub.items?.data||[]).map((x:any)=>x.current_period_end||0))
 return {kind:'recurring',id:record.id,providerId,end:timestamp?new Date(timestamp*1000).toISOString():end,cancelled:!!sub.cancel_at_period_end||!!sub.cancel_at||sub.status==='canceled',message:sub.cancel_at_period_end||sub.cancel_at||sub.status==='canceled'?'Renewal is cancelled. Your access continues until the end of your paid period.':'You can cancel renewal at any time. Your access continues through the paid period.'}
}
async function recordForUser(userId:number,id?:number){return first<BillingRecord>(`SELECT id,user_id,payment_id,plan_type,end_date,is_manual,status FROM subscriptions WHERE user_id=? AND deleted_at IS NULL${id?' AND id=?':''} ORDER BY id DESC LIMIT 1`,userId,...(id?[id]:[]))}
export const getCancellationState=createServerFn({method:'GET'}).handler(async():Promise<CancellationState>=>{const v=await getActiveViewer();if(!v)return{kind:'none',message:'Sign in to manage your subscription.'};const record=await recordForUser(v.userId);if(!record)return{kind:'none',message:'No active subscription.'};try{const {providerId,...state}=await inspectBilling(record,await secret());return state}catch{return{kind:'unavailable',id:record.id,end:record.end_date,message:'Billing could not be reached. Please try again or contact Hello@halobox.tv.'}}})
export async function cancelStripeRenewal(providerId:string,token:string,transport:typeof fetch=fetch){if(!/^sub_[a-zA-Z0-9]+$/.test(providerId))throw new Error('Invalid subscription.');const result=await stripe(`/subscriptions/${providerId}`,token,new URLSearchParams({cancel_at_period_end:'true'}),transport);if(result.id!==providerId||(!result.cancel_at_period_end&&!result.cancel_at&&result.status!=='canceled'))throw new Error('Billing did not confirm cancellation. Please try again.');return result}
export const cancelSubscription=createServerFn({method:'POST'}).validator((d:{id:number})=>{if(!Number.isSafeInteger(d.id)||d.id<1)throw new Error('Choose a subscription.');return d}).handler(async({data})=>{
 const v=await getActiveViewer();if(!v)throw new Error('Sign in to manage your subscription.');const record=await recordForUser(v.userId,data.id);if(!record)throw new Error('Subscription not found.')
 const token=await secret(),state=await inspectBilling(record,token);if(state.kind!=='recurring'||!state.providerId||!token)throw new Error(state.message)
 if(!state.cancelled)await cancelStripeRenewal(state.providerId,token)
 await run(`INSERT INTO subscription_cancellations(subscription_id,user_id,provider_id,effective_at) VALUES(?,?,?,?) ON CONFLICT(subscription_id) DO UPDATE SET effective_at=excluded.effective_at,requested_at=datetime('now')`,record.id,v.userId,state.providerId,state.end)
 // Keep active access until the paid-through date; cancellation disables renewal at Stripe.
 return {ok:true,message:'Renewal cancelled. You keep access until the end of your paid period.',end:state.end}
})
