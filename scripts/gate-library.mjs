import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {DatabaseSync} from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'
import {webcrypto} from 'node:crypto'
const require=createRequire(import.meta.url)
function load(path,imports={},globals={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>imports[n]??require(n),console,URL,URLSearchParams,AbortSignal,fetch,Response,FormData,File,Blob,Uint8Array,crypto:webcrypto,...globals});return module.exports}
const db=new DatabaseSync(':memory:');db.exec(readFileSync('migrations/20261107_library.sql','utf8'));db.exec(`CREATE TABLE entertainments(id INTEGER,name TEXT,type TEXT,status INTEGER,deleted_at TEXT); INSERT INTO entertainments VALUES(1,'Real sermon','movie',1,NULL); CREATE TABLE subscriptions(id INTEGER,user_id INTEGER,payment_id TEXT,plan_type TEXT,end_date TEXT,is_manual INTEGER,status TEXT,deleted_at TEXT); CREATE TABLE settings(name TEXT,val TEXT,deleted_at TEXT); INSERT INTO settings VALUES('stripe_secretkey','test-key',NULL); INSERT INTO subscriptions VALUES(1,1,'sub_owned','stripe','2027-01-01',0,'active',NULL),(2,2,'sub_foreign','stripe','2027-01-01',0,'active',NULL);`)
const adapter={all:async(s,...p)=>db.prepare(s).all(...p),first:async(s,...p)=>db.prepare(s).get(...p)||null,run:async(s,...p)=>db.prepare(s).run(...p)}
let viewer={userId:1,profileId:11};let calls=[];let fail=false
const factory={createServerFn(){let valid=v=>v;return{validator(f){valid=f;return this},handler(f){return async(input={})=>f({data:valid(input.data)})}}}}
const transport=async(url,opts)=>{calls.push({url,opts});if(fail)return new Response('{}',{status:503});return Response.json({id:'sub_owned',cancel_at_period_end:opts.method==='POST',current_period_end:1798761600})}
const imports={'@tanstack/react-start':factory,'./db':adapter,'./viewer.server':{getActiveViewer:async()=>viewer}}
const library=load('src/lib/library.ts',{...imports,'./bibleProvider':load('src/lib/bibleProvider.ts')})
const note={key:'journal:test-note',title:'A reflection',html:'<h2>Faith</h2><p style="text-align:center;color:red">A <strong>thought</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a></p>'}
await library.saveLibraryNote({data:note});let result=await library.getLibrary();assert.equal(result.notes.length,1);assert.match(result.notes[0].html,/<strong>thought<\/strong>/);assert.match(result.notes[0].html,/text-align:center/);assert.doesNotMatch(result.notes[0].html,/script|onerror|javascript:|color:red|<img/)
viewer={userId:1,profileId:12};assert.equal((await library.getLibrary()).notes.length,0);await library.deleteLibraryNote({data:{key:note.key}});viewer={userId:1,profileId:11};assert.equal((await library.getLibrary()).notes.length,1)
await library.saveLibraryNote({data:{key:'movie:1',title:'spoofed',html:'<p>Actual title</p>'}});assert.equal((await library.getLibrary()).notes.find(n=>n.note_key==='movie:1').title,'Real sermon');await assert.rejects(library.saveLibraryNote({data:{...note,key:'movie:999'}}));await assert.rejects(library.saveLibraryNote({data:{...note,key:'../bad'}}));await assert.rejects(library.saveLibraryNote({data:{...note,html:'x'.repeat(100001)}}))
const verse={version:'1',book:'JHN',chapter:3,verse:16,book_name:'John',text:'For God so loved the world',saved:true,highlight:'gold'};await library.saveLibraryVerse({data:verse});assert.equal((await library.getLibrary()).verses[0].highlight,'gold');await library.saveLibraryVerse({data:{...verse,highlight:'blue'}});assert.equal((await library.getLibrary()).verses.length,1);viewer={userId:2,profileId:21};assert.equal((await library.getLibrary()).verses.length,0);assert.equal((await library.getLibrary()).notes.length,0);viewer={userId:1,profileId:11};await library.saveLibraryVerse({data:{...verse,highlight:'',saved:false}});assert.equal((await library.getLibrary()).verses.length,0);await assert.rejects(library.saveLibraryVerse({data:{...verse,verse:0}}));viewer=null;await assert.rejects(library.saveLibraryNote({data:note}));await assert.rejects(library.saveLibraryVerse({data:verse}));assert.equal((await library.getLibrary()).signedIn,false)
viewer={userId:1,profileId:12}; await assert.rejects(library.saveLibraryNote({data:{...note,profileKey:'1:11'}}),/active profile changed/);await assert.rejects(library.deleteLibraryNote({data:{key:note.key,profileKey:'1:11'}}),/active profile changed/);await assert.rejects(library.saveLibraryVerse({data:{...verse,profileKey:'1:11'}}),/active profile changed/);assert.equal((await library.getLibrary()).notes.length,0);
console.log('LIBRARY_PROFILE_PERSISTENCE_OK')
const billing=load('src/lib/billing.ts',imports,{fetch:transport});viewer={userId:1,profileId:11};const record={id:1,user_id:1,payment_id:'cs_once',plan_type:'stripe',end_date:'2027-01-01',is_manual:0,status:'active'}
assert.equal((await billing.inspectBilling(record,'test',async()=>Response.json({mode:'payment'}))).kind,'one-time');assert.equal((await billing.inspectBilling({...record,is_manual:1},undefined)).kind,'one-time');assert.equal((await billing.inspectBilling({...record,plan_type:'apple'},undefined)).kind,'external');assert.equal((await billing.inspectBilling(record,undefined)).kind,'unavailable');await assert.rejects(billing.cancelSubscription({data:{id:2}}));assert.equal(calls.length,0,'Foreign subscription never reaches provider')
fail=true;await assert.rejects(billing.cancelSubscription({data:{id:1}}));assert.equal(db.prepare('SELECT count(*) AS n FROM subscription_cancellations').get().n,0);fail=false;await billing.cancelSubscription({data:{id:1}});assert.equal(db.prepare('SELECT status FROM subscriptions WHERE id=1').get().status,'active');assert.equal(db.prepare('SELECT count(*) AS n FROM subscription_cancellations').get().n,1);assert.ok(calls.some(c=>c.opts.method==='POST'&&c.opts.body==='cancel_at_period_end=true'));await assert.rejects(billing.cancelStripeRenewal('sub_owned','test',async()=>Response.json({id:'sub_other',cancel_at_period_end:true})))
console.log('BILLING_OWNERSHIP_AND_FAILURE_OK')
const routes=load('src/lib/contentRoutes.ts');assert.equal(routes.contentPath({id:229,name:'A Sound From Heaven | Prophet Uebert Angel'}),'/movie/a-sound-from-heaven-prophet-uebert-angel-229');for(const input of ['229','a-sound-from-heaven-229'])assert.equal(routes.contentIdFromPath(input),229);for(const input of ['0','../229','229no','-12','NaN','x-9007199254740992'])assert.ok(Number.isNaN(routes.contentIdFromPath(input)));assert.equal(routes.titleSlug('Grâce & Truth!'),'grace-truth')
assert.equal(routes.contentPath({id:229,slug:'a-sound-229'}),'/movie/a-sound-229');console.log('READABLE_ROUTES_OK')
const images=load('src/lib/imageProcessing.server.ts')
const original=new File([new Uint8Array([255,216,255,0,1])],'image.jpg')
const avif=new Uint8Array([0,0,0,16,102,116,121,112,97,118,105,102,0,0,0,0])
let converted=0,stored=new Map()
const bindings={
 MEDIA:{head:async k=>stored.get(k),get:async k=>stored.get(k),put:async(k,bytes,metadata)=>stored.set(k,{bytes,metadata,...metadata,arrayBuffer:async()=>bytes.buffer})},
 IMAGES:{
  info:async()=>({width:600,height:400}),
  input:()=>({
   transform(opts){
    assert.equal(opts.width,512)
    return {async output(opts){
     assert.equal(opts.format,'image/avif');converted++
     return {response:()=>new Response(avif,{headers:{'Content-Type':'image/avif'}})}
    }}
   }
  })
 }
}
await images.storeAvif(original,'profiles/1/11',true,bindings);await images.storeAvif(original,'profiles/1/11',true,bindings);assert.equal(converted,1);assert.equal(stored.size,1);assert.equal([...stored.values()][0].metadata.httpMetadata.contentType,'image/avif');await assert.rejects(images.storeAvif(new File(['not an image'],'bad.jpg'),'profiles/1/11',true,bindings));bindings.IMAGES.info=async()=>({width:10000,height:10000});await assert.rejects(images.storeAvif(original,'profiles/1/12',true,bindings));assert.equal(stored.size,1)
console.log('AVIF_VALIDATION_AND_DEDUP_OK');console.log('ACCOUNT_LIBRARY_OK');db.close()
