import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl, setResponseHeader } from '@tanstack/react-start/server'
import { getSession } from './session.server'
import { authWriteOrigin } from './auth.server'
import { digest, normalizeEmail, randomToken } from './authCore'
import { entitlementDatabase } from './entitlement.server'
import { acceptSubscriptionInvite, inviteSubscriptionMember, removeSubscriptionMember, revokeSubscriptionDevice, subscriptionDashboard } from './entitlement-core'
async function actor(write=false){
 setResponseHeader('Cache-Control','private, no-store')
 if(write) authWriteOrigin()
 const value=await getSession()
 if(!value) throw new Error('Sign in to manage shared access.')
 return value
}
const id=(value:unknown)=>{if(typeof value!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(value))throw new Error('Choose a valid item.');return value}
export const getSubscriptionSharing=createServerFn({method:'GET'}).handler(async()=>subscriptionDashboard(entitlementDatabase(),await actor()))
export const createMemberInvite=createServerFn({method:'POST'}).validator((data:{email:string})=>({email:normalizeEmail(data?.email)})).handler(async({data})=>{
 const user=await actor(true),token=randomToken()
 await inviteSubscriptionMember(entitlementDatabase(),user,data.email,await digest(token))
 return {url:`${new URL(getRequestUrl()).origin}/subscription-invite#${token}`}
})
export const acceptMemberInvite=createServerFn({method:'POST'}).validator((data:{token:string})=>{if(!data||!/^[-\w]{43}$/.test(data.token))throw new Error('This invitation link is invalid.');return data}).handler(async({data})=>acceptSubscriptionInvite(entitlementDatabase(),await actor(true),await digest(data.token)))
export const removeMember=createServerFn({method:'POST'}).validator((data:{id:string})=>({id:id(data?.id)})).handler(async({data})=>removeSubscriptionMember(entitlementDatabase(),await actor(true),data.id))
export const revokeMemberDevice=createServerFn({method:'POST'}).validator((data:{id:string})=>({id:id(data?.id)})).handler(async({data})=>revokeSubscriptionDevice(entitlementDatabase(),await actor(true),data.id))
