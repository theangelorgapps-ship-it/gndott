import {createServerFn} from '@tanstack/react-start'
import {env} from 'cloudflare:workers'
import {storeAvif} from './imageProcessing.server'
import {getActiveViewer} from './viewer.server'
import {first,run} from './db'
export const MAX_IMAGE_BYTES=8*1024*1024
export const uploadProfilePhoto=createServerFn({method:'POST'}).validator((data:FormData)=>{if(!(data instanceof FormData))throw new Error('Choose a photo.');return data}).handler(async({data})=>{
 const v=await getActiveViewer();if(!v?.profileId)throw new Error('Sign in and choose a profile first.')
 const file=data.get('image');if(!(file instanceof File))throw new Error('Choose a photo.')
 const result=await storeAvif(file,`profiles/${v.userId}/${v.profileId}`,true,env)
 await run("UPDATE user_multi_profiles SET avatar=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND deleted_at IS NULL",result.url,v.profileId,v.userId)
 return {ok:true,url:result.url}
})
/** The same server conversion is the sole upload path for future catalogue artwork updates. */
export const uploadCatalogueImage=createServerFn({method:'POST'}).validator((data:FormData)=>data).handler(async({data})=>{
 const v=await getActiveViewer();if(!v)throw new Error('Sign in required.')
 const user=await first<{user_type:string}>('SELECT user_type FROM users WHERE id=?',v.userId);if(user?.user_type!=='admin')throw new Error('Administrator access required.')
 const table=String(data.get('table')),field=String(data.get('field')),id=Number(data.get('id')),file=data.get('image')
 if(!['entertainments','videos','episodes'].includes(table)||!['poster_url','thumbnail_url'].includes(field)||!Number.isSafeInteger(id)||id<1||!(file instanceof File))throw new Error('Choose a valid image and title.')
 if(!await first(`SELECT id FROM ${table} WHERE id=? AND deleted_at IS NULL`,id))throw new Error('Title not found.')
 const result=await storeAvif(file,`catalogue/${table}/${id}`,false,env)
 await run(`UPDATE ${table} SET ${field}=?,updated_at=datetime('now') WHERE id=?`,result.url,id)
 return {ok:true,url:result.url}
})
