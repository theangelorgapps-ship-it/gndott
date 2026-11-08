import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import sharp from 'sharp'
import {webcrypto,createHash} from 'node:crypto'
const modules=new Map()
function load(file) {
 file=path.resolve(file);if(modules.has(file))return modules.get(file)
 if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'))
 const module={exports:{}};modules.set(file,module.exports)
 const require=ref=>load(path.resolve(path.dirname(file),ref.endsWith('.json')?ref:ref+'.ts'))
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require,URL,Uint8Array,DataView,Blob,File,Response,Request,Headers,TextEncoder,AbortSignal,crypto:webcrypto,console:{warn(){}}})
 return module.exports
}
const {inspectTrustedAvif}=load('src/lib/trustedAvif.ts')
const media=load('src/lib/imageProcessing.server.ts')
const {externalArtwork}=load('src/lib/externalArtwork.server.ts')
const fixture=fs.readFileSync('verification/fixtures/store-grid.avif')
const metadata=await sharp(fixture).metadata()
const decoded=await sharp(fixture).raw().toBuffer({resolveWithObject:true})
assert.equal(metadata.compression,'av1');assert.equal(decoded.info.width,1600);assert.equal(decoded.info.height,1986)
const inspected=inspectTrustedAvif(fixture);assert.equal(inspected.width,1600);assert.equal(inspected.height,1986)
const simple=await sharp({create:{width:24,height:24,channels:3,background:'#4369ab'}}).avif().toBuffer()
assert.equal(inspectTrustedAvif(simple).width,24)
for(const cut of [0,8,27,28,123,515,845,861,1165,1180,50000,fixture.length-1])assert.throws(()=>inspectTrustedAvif(fixture.subarray(0,cut)))
const bad=mutate=>{const bytes=Buffer.from(fixture);mutate(bytes);assert.throws(()=>inspectTrustedAvif(bytes))}
bad(b=>b.writeBigUInt64BE(BigInt(b.length+1),1173)) // Extended mdat bounds.
bad(b=>b.writeUInt32BE(b.length+1,885)) // First iloc extent starts beyond the file.
bad(b=>b.writeUInt32BE(b.length,889)) // Extent length crosses the mdat end.
bad(b=>b.writeUInt16BE(1,881)) // External data reference is forbidden.
bad(b=>b.writeUInt32BE(0,664)) // Invalid primary width.
bad(b=>b.writeUInt32BE(0xffffffff,668)) // Oversized primary height.
bad(b=>b.writeUInt16BE(15,537)) // Grid reference count disagrees with its tile grid.
bad(b=>b[855]=0) // Grid rows no longer match references.
bad(b=>b[705]=1) // Invalid AV1 codec configuration marker.
bad(b=>b[1257]|=128) // Invalid AV1 OBU framing in the first tile.
bad(b=>b.writeUInt32BE(0,0)) // Open-ended/zero-sized box is unsupported.
const records=new Map()
const env={IMAGES:{info:async()=>{throw Error('IMAGES_INFO_ERROR 9516: Error while decoding the AVIF file. The file may be using features which are not supported.')},input:()=>{throw Error('Must not re-encode validated trusted AVIF')}},MEDIA:{
 get:async key=>{const record=records.get(key);return record?{...record,body:new Blob([record.bytes]).stream(),arrayBuffer:async()=>record.bytes.slice().buffer}:null},
 put:async(key,bytes,options)=>records.set(key,{bytes:new Uint8Array(bytes),...options})
}}
const url='https://uebertangel.org/wp-content/uploads/2026/09/f16717c5-5128-4dde-b342-379a170634ca.avif'
const result=await externalArtwork(url,env,async()=>new Response(fixture,{headers:{'content-type':'image/avif'}}))
assert.equal(createHash('sha256').update(Buffer.from(await result.arrayBuffer())).digest('hex'),createHash('sha256').update(fixture).digest('hex'))
await externalArtwork(url,env,async()=>{throw Error('Cache should be used')})
await assert.rejects(()=>media.convertAvif(fixture,env),/inspected/)
await assert.rejects(()=>media.convertAvif(fixture,env,{migration:true}),/inspected/)
await assert.rejects(()=>media.convertAvif(fixture,env,{preserveAvif:true,avatar:true}),/inspected/)
const otherError={...env,IMAGES:{...env.IMAGES,info:async()=>{throw Error('IMAGES_INFO_ERROR 9520: service unavailable')}}}
await assert.rejects(()=>media.convertAvif(fixture,otherError,{preserveAvif:true}),/inspected/)
await assert.rejects(()=>media.convertAvif(fixture.subarray(0,fixture.length-1),env,{preserveAvif:true}),/container/)
console.log(`STORE_AVIF_PASS: actual 16-tile grid fully decoded by Sharp at1600x1986; structural fallback only for external CF9516; ${12+11} malformed/truncated variants rejected; hash/readback/cache checked; uploads and migration remain strict`)
