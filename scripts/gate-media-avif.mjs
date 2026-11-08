import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import sharp from 'sharp'
import {webcrypto,createHmac} from 'node:crypto'
const modules=new Map()
function load(file) {
  file=path.resolve(file)
  if(modules.has(file))return modules.get(file)
  if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'))
  const module={exports:{}}
  modules.set(file,module.exports)
  const require=ref=>load(path.resolve(path.dirname(file),ref.endsWith('.json')||ref.endsWith('.ts')?ref:ref+'.ts'))
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require,URL,Uint8Array,DataView,Blob,File,Response,Request,Headers,TextEncoder,AbortSignal,crypto:webcrypto,console})
  return module.exports
}
const media=load('src/lib/imageProcessing.server.ts')
const urls=load('src/lib/imageUrls.ts')
const external=load('src/lib/externalArtwork.server.ts')
const migration=load('ops/media-avif-worker.ts')
const source=new Uint8Array(await sharp({create:{width:16,height:16,channels:4,background:'#4567ab'}}).png().toBuffer())
const avif=new Uint8Array(await sharp(source).avif().toBuffer())
assert.equal(media.imageType(source),'image/png')
assert.equal(media.imageType(avif),'image/avif')
for(const invalid of [new Uint8Array(),new TextEncoder().encode('<svg/>'),source.slice(0,4),avif.slice(0,15)])assert.throws(()=>media.imageType(invalid))
const records=new Map()
let imageReads=0,transforms=0,deleted=0,refs=0
const object=(key)=>{const value=records.get(key);return value?{...value,key,size:value.bytes.length,body:new Blob([value.bytes]).stream(),etag:value.etag||'etag',arrayBuffer:async()=>value.bytes.slice().buffer,json:async()=>JSON.parse(new TextDecoder().decode(value.bytes))}:null}
const env={
 IMAGES:{
   info:async stream=>{imageReads++;const m=await sharp(Buffer.from(await new Response(stream).arrayBuffer())).metadata();return {width:m.width,height:m.height}},
   input:()=>({transform:()=>{transforms++;return {output:async()=>({response:()=>new Response(avif,{headers:{'content-type':'image/avif'}})})}}})
 },
 MEDIA:{get:async key=>object(key),head:async key=>object(key),put:async(key,bytes,options={})=>{records.set(key,{bytes:typeof bytes==='string'?new TextEncoder().encode(bytes):new Uint8Array(bytes),...options})},delete:async key=>{deleted++;records.delete(key)},list:async()=>({objects:[{key:'legacy-20261105/'+ 'a'.repeat(64)+'.png'},{key:'foreign/file.png'}],truncated:false})},
 DB:{prepare:sql=>({bind:(...args)=>({sql,args})}),batch:async statements=>statements.map(statement=>({results:[{n:refs}]}))}
}
const upload=await media.storeAvif(new File([source],'photo.png'),'profiles/1/1',true,env)
assert.match(upload.url,/\.avif$/)
assert.equal(records.get(upload.key).httpMetadata.contentType,'image/avif')
const count=transforms
await media.storeAvif(new File([source],'photo.png'),'profiles/1/1',true,env)
assert.equal(transforms,count,'verified duplicate should not convert again')
await assert.rejects(()=>media.storeAvif(new File([source],'x.png'),'../bad',false,env),/scope/)
await assert.rejects(()=>media.storeAvif(new File([],'empty.png'),'profiles/1/1',false,env),/smaller/)
await assert.rejects(()=>media.storeAvif(new File([source],'x.png'),'profiles/1/1',false,{MEDIA:env.MEDIA}),/unavailable/)
// Reproduce Cloudflare's production fallback above its AVIF dimension limit.
const sizeLimitedImages={...env,IMAGES:{...env.IMAGES,input:()=>({transform:options=>({output:async()=>({response:()=>new Response(options.width>1200||options.height>1200?source:avif,{headers:{'content-type':options.width>1200||options.height>1200?'image/webp':'image/avif'}})})})})}}
assert.equal(media.imageType((await media.convertAvif(source,sizeLimitedImages)).bytes),'image/avif')
const fallbackImages={...env,IMAGES:{...env.IMAGES,input:()=>({transform:()=>({output:async()=>({response:()=>new Response(source,{headers:{'content-type':'image/webp'}})})})})}}
await assert.rejects(()=>media.convertAvif(source,fallbackImages,{migration:true}),/status=200; contentType=image\/webp/)
const evilImages={...env,IMAGES:{...env.IMAGES,input:()=>({transform:()=>({output:async()=>({response:()=>new Response(source,{headers:{'content-type':'image/avif'}})})})})}}
await assert.rejects(()=>media.convertAvif(source,evilImages),/AVIF/)
const corruptStore={...env,MEDIA:{...env.MEDIA,get:async key=>({...object(key),arrayBuffer:async()=>source.buffer})}}
await assert.rejects(async()=>media.writeVerifiedAvif('corrupt.avif',{bytes:avif,sha256:await media.sha256(avif)},corruptStore),/verification/)
const good='https://uebertangel.org/wp-content/uploads/2026/01/book.jpg'
assert.equal(urls.allowedExternalArtwork(good).href,good)
for(const bad of ['https://uebertangel.org.evil.test/wp-content/uploads/book.jpg','http://uebertangel.org/wp-content/uploads/book.jpg','https://uebertangel.org:444/wp-content/uploads/book.jpg','https://localhost/book.jpg','https://uebertangel.org/wp-admin/book.jpg','https://uebertangel.org/wp-content/uploads/%2e%2e/private/book.jpg',good+'?url=http://localhost/',good+'#secret'])assert.equal(urls.allowedExternalArtwork(bad),null)
assert.match(urls.img(good),/^\/media\/external\?url=/)
assert.equal(urls.img('/images/avatars/icon1.webp'),'/images/avatars/icon1.avif')
assert.equal(urls.img('/avatars/avatar-1.png'),'/images/avatars/icon1.avif')
assert.equal(urls.img(null),'/default-image.avif')
let fetches=0
assert.equal(await external.externalArtwork('http://localhost/x.png',env,async()=>{fetches++;throw Error('should not fetch')}),null)
assert.equal(fetches,0)
await assert.rejects(()=>external.externalArtwork(good,env,async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1'}})),/unavailable/)
await assert.rejects(()=>external.externalArtwork(good,env,async()=>new Response('x',{headers:{'content-type':'image/png','content-length':String(media.MAX_IMAGE_BYTES+1)}})),/unavailable/)
await external.externalArtwork(good,env,async(_url,options)=>{assert.equal(options.redirect,'manual');fetches++;return new Response(source,{headers:{'content-type':'image/png'}})})
await external.externalArtwork(good,env,async()=>{throw Error('cache missed')})
assert.equal(fetches,1)
// Store AVIF is already compressed. Preserve it after the same type/info/size/hash checks,
// even when the provider refuses AVIF re-encoding (notably larger AVIF sources).
const avifUrl='https://uebertangel.org/wp-content/uploads/2026/09/already-compressed.avif'
const noAvifReencode={...env,IMAGES:{...env.IMAGES,input:()=>{throw Error('Provider refuses AVIF input')}}}
const cachedAvif=await external.externalArtwork(avifUrl,noAvifReencode,async()=>new Response(avif,{headers:{'content-type':'image/avif'}}))
assert.equal(await media.sha256(new Uint8Array(await cachedAvif.arrayBuffer())),await media.sha256(avif))
await assert.rejects(()=>external.externalArtwork(avifUrl+'-invalid.avif',noAvifReencode,async()=>new Response(new TextEncoder().encode('<html>error</html>'),{headers:{'content-type':'image/avif'}})),/Choose a JPEG/)
await assert.rejects(()=>external.externalArtwork(avifUrl+'-truncated.avif',noAvifReencode,async()=>new Response(avif.slice(0,32),{headers:{'content-type':'image/avif'}})))
const hugeAvifInfo={...noAvifReencode,IMAGES:{...noAvifReencode.IMAGES,info:async()=>({width:10000,height:10000})}}
await assert.rejects(()=>external.externalArtwork(avifUrl+'-huge.avif',hugeAvifInfo,async()=>new Response(avif,{headers:{'content-type':'image/avif'}})),/dimensions/)
await assert.rejects(()=>media.convertAvif(avif,noAvifReencode,{preserveAvif:true,avatar:true}),/refuses AVIF input/)
const sourceKey='legacy-20261105/'+ 'a'.repeat(64)+'.png'
records.set(sourceKey,{bytes:source,httpMetadata:{contentType:'image/png'}})
assert.equal(await media.ownedAvifObject('private/'+sourceKey,env),null)
assert.equal(await media.ownedAvifObject('../'+sourceKey,env),null)
const legacy=await media.ownedAvifObject(sourceKey,env)
assert.equal(legacy.httpMetadata.contentType,'image/avif')
assert.ok(records.has(sourceKey),'conversion on read must not delete originals')
const secret='test-secret-at-least-thirty-two-characters'
const body=JSON.stringify({action:'inventory'})
const time=String(Date.now())
const signature=createHmac('sha256',secret).update(`${time}\nPOST\n/operate\n${body}`).digest('hex')
const signed=new Request('https://worker.example/operate',{method:'POST',body,headers:{'x-media-time':time,'x-media-signature':signature}})
assert.equal(await migration.authorized(signed,body,secret),true)
assert.equal(await migration.authorized(signed,body+' ',secret),false)
assert.equal(await migration.authorized(signed,body,'bad'),false)
assert.equal((await migration.default.fetch(new Request('https://worker.example/operate',{method:'POST',body}),{...env,MIGRATION_SECRET:secret})).status,401)
assert.equal((await migration.operation({action:'backup',key:'foreign/file.png'},env)).status,400)
await assert.rejects(()=>migration.operation({action:'convert',key:sourceKey,backupSha256:'wrong'},env),/backup/)
const converted=await (await migration.operation({action:'convert',key:sourceKey,backupSha256:await media.sha256(source)},env)).json()
assert.equal(converted.target,await media.migratedAvifKey(sourceKey))
refs=1
await assert.rejects(()=>migration.operation({action:'prune',key:sourceKey,backupSha256:converted.sourceSha256,sha256:converted.sha256},env),/referenced/)
refs=0
await assert.rejects(()=>migration.operation({action:'prune',key:sourceKey,backupSha256:'wrong',sha256:converted.sha256},env),/backup/)
const storedOriginal=records.get(sourceKey)
records.set(sourceKey,{...storedOriginal,etag:'changed'})
await assert.rejects(()=>migration.operation({action:'prune',key:sourceKey,backupSha256:converted.sourceSha256,sha256:converted.sha256},env),/changed/)
records.set(sourceKey,storedOriginal)
const goodTarget=records.get(converted.target)
records.set(converted.target,{...goodTarget,bytes:source})
await assert.rejects(()=>migration.operation({action:'prune',key:sourceKey,backupSha256:converted.sourceSha256,sha256:converted.sha256},env),/verification/)
assert.equal(deleted,0)
records.set(converted.target,goodTarget)
const pruned=await (await migration.operation({action:'prune',key:sourceKey,backupSha256:converted.sourceSha256,sha256:converted.sha256},env)).json()
assert.equal(pruned.pruned,true)
assert.equal(deleted,1)
assert.equal((await media.ownedAvifObject(sourceKey,env)).httpMetadata.contentType,'image/avif','old URL must work after deletion')
console.log('MEDIA_AVIF_PASS: upload decode/type/hash checks, dedupe, private isolation, external allowlist/cache/redirect and size guards, signed operation auth, backup/replacement/reference/source-change deletion guards, legacy URL survives prune')
