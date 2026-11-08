import fields from './media-fields.json'
import { convertAvif, imageType, migratedAvifKey, sha256, writeVerifiedAvif, MAX_MIGRATION_BYTES } from '../src/lib/imageProcessing.server'

const encoder = new TextEncoder()
const validKey = (key: unknown): key is string => typeof key === 'string' && /^(private\/)?legacy-20261105\/[a-f0-9]{64}\.(png|jpe?g|webp)$/i.test(key)
const receiptKey = async (key: string) => `private/avif-migration/v1/${await sha256(key)}.json`
const json = (data: unknown, status=200) => Response.json(data,{status,headers:{'cache-control':'no-store'}})
export async function authorized(request: Request, body: string, secret: string) {
  if (!secret || secret.length < 32) return false
  const time = request.headers.get('x-media-time') ?? ''
  const signature = request.headers.get('x-media-signature') ?? ''
  if (!/^\d{13}$/.test(time) || Math.abs(Date.now()-Number(time))>60000 || !/^[a-f0-9]{64}$/.test(signature)) return false
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify'])
  return crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g)!,h=>parseInt(h,16)),encoder.encode(`${time}\n${request.method}\n${new URL(request.url).pathname}\n${body}`))
}
async function receipt(env: any, key: string) {
  const object = await env.MEDIA.get(await receiptKey(key))
  if (!object) throw Error('Convert and verify this original first.')
  return object.json()
}
async function verify(env: any, record: any) {
  if (!validKey(record.key) || record.target !== await migratedAvifKey(record.key)) throw Error('Invalid conversion receipt.')
  const object = await env.MEDIA.get(record.target)
  if (!object || object.httpMetadata?.contentType!=='image/avif') throw Error('Replacement missing or incorrect content type.')
  const bytes = new Uint8Array(await object.arrayBuffer())
  if (bytes.length!==record.bytes || imageType(bytes)!=='image/avif' || await sha256(bytes)!==record.sha256) throw Error('Replacement hash verification failed.')
  const info = await env.IMAGES.info(new Blob([bytes]).stream())
  if (info.width!==record.width || info.height!==record.height) throw Error('Replacement decode verification failed.')
}
export async function references(env: any, key: string) {
  const results = await env.DB.batch(fields.map(([table,column])=>env.DB.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE instr("${column}",?)>0`).bind(`/media/${key}`)))
  return results.reduce((sum: number,result: any)=>sum+Number(result.results[0].n),0)
}
export async function operation(data: any, env: any): Promise<Response> {
  if (data.action==='inventory') {
    const result = await env.MEDIA.list({limit:1000,cursor:data.cursor || undefined})
    return json({objects:result.objects.filter((object: any)=>validKey(object.key)).map((object: any)=>({key:object.key,etag:object.etag,size:object.size})),cursor:result.truncated ? result.cursor : null})
  }
  if (!validKey(data.key)) return json({error:'Invalid owned source key.'},400)
  const original = await env.MEDIA.get(data.key)
  if (data.action==='backup') {
    if (!original) return json({error:'Original missing.'},404)
    return new Response(original.body,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-source-etag':original.etag}})
  }
  if (data.action==='convert') {
    if (!original) throw Error('Original missing.')
    if (original.size>MAX_MIGRATION_BYTES) throw Error('Original exceeds migration limit.')
    const bytes = new Uint8Array(await original.arrayBuffer())
    const sourceSha256 = await sha256(bytes)
    if (data.backupSha256!==sourceSha256) throw Error('Verified local backup required before conversion.')
    const target = await migratedAvifKey(data.key)
    const cached = await env.MEDIA.get(target)
    let converted
    if (cached?.httpMetadata?.contentType==='image/avif' && cached.customMetadata?.sourceEtag===original.etag) {
      const existing = new Uint8Array(await cached.arrayBuffer())
      const info = await env.IMAGES.info(new Blob([existing]).stream())
      converted = {bytes:existing,width:info.width,height:info.height,sha256:await sha256(existing)}
      if (imageType(existing)!=='image/avif' || converted.sha256!==cached.customMetadata.sha256) throw Error('Cached replacement failed verification.')
    } else {
      converted = await convertAvif(bytes,env,{migration:true})
      await writeVerifiedAvif(target,converted,env,{sourceKey:data.key,sourceEtag:original.etag})
    }
    const record = {key:data.key,target,sourceEtag:original.etag,sourceSha256,originalBytes:bytes.length,bytes:converted.bytes.length,sha256:converted.sha256,width:converted.width,height:converted.height,convertedAt:new Date().toISOString()}
    await verify(env,record)
    await env.MEDIA.put(await receiptKey(data.key),JSON.stringify(record),{httpMetadata:{contentType:'application/json'}})
    return json(record)
  }
  const record = await receipt(env,data.key)
  await verify(env,record)
  if (data.action==='verify') return json({...record,originalPresent:!!original,references:await references(env,data.key)})
  if (data.action==='rewrite') {
    // Source URLs are replaced by the exact verified receipt target, including URLs within JSON.
    await env.DB.batch(fields.map(([table,column])=>env.DB.prepare(`UPDATE "${table}" SET "${column}"=replace("${column}",?,?) WHERE instr("${column}",?)>0`).bind(`/media/${data.key}`,`/media/${record.target}`,`/media/${data.key}`)))
    return json({...record,references:await references(env,data.key)})
  }
  if (data.action==='prune') {
    if (data.backupSha256!==record.sourceSha256 || data.sha256!==record.sha256) throw Error('Local backup and replacement receipts are required.')
    if (await references(env,data.key)) throw Error('Original is still referenced in D1.')
    if (original) {
      if (original.etag!==record.sourceEtag || await sha256(new Uint8Array(await original.arrayBuffer()))!==record.sourceSha256) throw Error('Original changed after conversion; do not prune.')
      await env.MEDIA.delete(data.key)
    }
    if (await env.MEDIA.head(data.key)) throw Error('Original deletion verification failed.')
    return json({...record,pruned:true})
  }
  return json({error:'Unknown action.'},400)
}
export default {async fetch(request: Request,env: any) {
  if (request.method!=='POST' || new URL(request.url).pathname!=='/operate' || Number(request.headers.get('content-length'))>16384) return json({error:'Not found.'},404)
  const body = await request.text()
  if (body.length>16384 || !await authorized(request,body,env.MIGRATION_SECRET)) return json({error:'Unauthorized.'},401)
  try { return await operation(JSON.parse(body),env) }
  catch(error) { return json({error:error instanceof Error ? error.message : 'Migration operation failed.'},409) }
}}
