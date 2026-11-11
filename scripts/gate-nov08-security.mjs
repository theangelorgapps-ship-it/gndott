// Offline execution of production policy/handlers. Network is prohibited throughout.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import sanitizeHtml from 'sanitize-html'
import { sameOrigin } from '../src/lib/authCore.ts'
import { authBaseURL } from '../src/lib/auth-origins.ts'
import { requiresSubscription, subscriptionFields } from '../src/lib/subscriptionPolicy.ts'
import { playbackFields, positiveId, profileInput, publicHttpsUrl, readVastMedia } from '../src/lib/api-security.ts'
const realFetch=globalThis.fetch
globalThis.fetch=async()=>{throw new Error('Unexpected network request in offline gate')}
const root=new URL('../',import.meta.url)
function compile(file,imports) {
 const source=readFileSync(new URL(file,root),'utf8')
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const module={exports:{}}
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{assert(name in imports,`Unexpected dependency: ${name}`);return imports[name]},URL,Date,console,fetch:globalThis.fetch})
 return module.exports
}
const factory={createServerOnlyFn:fn=>fn,createServerFn(){let validate=x=>x;const builder={validator(fn){validate=fn;return builder},handler(fn){return async(input={})=>fn({data:validate(input.data)})}};return builder}}
for(const [realm,canonical,legacy] of [['viewer','https://halobox.tv','https://gndott.theangelorgapps.workers.dev'],['admin','https://fort.halobox.tv','https://gndottadmin.theangelorgapps.workers.dev']]) {
 assert.equal(authBaseURL('https://attacker.test',canonical,realm),canonical)
 assert.equal(authBaseURL('https://attacker.test',undefined,realm),legacy)
 assert.equal(authBaseURL('http://localhost:5173',canonical,realm),'http://localhost:5173')
 for(const bad of ['http://halobox.tv','https://evil.test','https://halobox.tv.evil.test',canonical+'/api/auth',canonical+'?host=x','https://user@'+new URL(canonical).hostname, realm==='viewer'?'https://fort.halobox.tv':'https://halobox.tv']) assert.throws(()=>authBaseURL(canonical,bad,realm))
}
for(const bad of [NaN,Infinity,0,-1,1.1,'1',null]) assert.throws(()=>positiveId(bad))
for(const bad of [{name:12},{name:' '},{name:'x'.repeat(81)},{name:'Name',isChild:'false'}]) assert.throws(()=>profileInput(bad))
const paid={id:1,movie_access:'paid',bunny_video_url:'private-id',video_url_input:'https://cdn.example.test/paid.m3u8',trailer_url:'https://cdn.example.test/trailer.mp4'}
assert.equal(playbackFields(paid).video_url_input,null)
assert.equal(playbackFields(paid).bunny_video_url,null)
assert.equal(playbackFields(paid).trailer_url,paid.trailer_url)
assert.equal(playbackFields(paid,true),paid)
assert.equal(playbackFields({...paid,movie_access:'free'}).video_url_input,paid.video_url_input)
assert.equal(playbackFields({...paid,movie_access:'free'},true,true).video_url_input,null,'Parent show entitlement applies to free episodes')
for(const bad of ['http://ads.example.test/tag','https://127.0.0.1/tag','https://169.254.169.254/latest','https://[::1]/','https://localhost/','https://foo.local/','https://foo.internal/','https://user:pass@ads.example.test/tag','https://ads.example.test:8443/tag','https://ads.example.test/tag#frag']) assert.throws(()=>publicHttpsUrl(bad))
let fetches=0
const transport=async(url,options)=>{fetches++;assert.equal(options.redirect,'error');assert(options.signal);return new Response('<VAST><MediaFile type="video/mp4"><![CDATA[https://cdn.example.test/ad.mp4]]></MediaFile><Duration>00:00:10</Duration></VAST>')}
assert.equal((await readVastMedia('https://ads.example.test/tag',transport)).mediaUrl,'https://cdn.example.test/ad.mp4')
await assert.rejects(readVastMedia('https://ads.example.test/tag',async()=>new Response('x'.repeat(262145))))
await assert.rejects(readVastMedia('https://ads.example.test/tag',async()=>new Response('',{status:302,headers:{location:'https://127.0.0.1/'}})))
let configured=false, entitled=false, mutations=0, session={uid:42}, activeContent=paid, subscription=null, subscriptionDevice=false, activeEpisodes=[]
const database={
 async all(sql){return sql.includes('FROM episodes WHERE')?activeEpisodes:[]},
 async first(sql,...args){
  if(sql.includes('FROM vast_ads_setting')) return configured?{id:1}:null
  if(sql.includes('FROM pay_per_views')) {assert.equal(args[0],42);return entitled?{id:2}:null}
  if(sql.includes('FROM entertainments WHERE id')) {assert(sql.includes('status = 1'));return activeContent}
  if(sql.includes('FROM videos WHERE id')) return {...paid,movie_access:undefined,access:'paid'}
  if(sql.includes('SELECT id, name, price')) return {id:1,price:10}
  return null
 },
 async run(){mutations++;return{changes:1}}
}
const api=compile('src/lib/api.ts',{'./content-html':compile('src/lib/content-html.ts',{'sanitize-html':{default:sanitizeHtml}}),'./heroes.server':{loadConfiguredHeroes:async()=>[]},'@tanstack/react-start':factory,'./session.server':{getSession:async()=>session,clearSessionCookie:async()=>{}},'./db':database,'./recommendations':{buildRecommendationPayload:()=>({}),buildMixedPopular:()=>[],isMeaningfulWatch:()=>false,parseWatchSeconds:()=>0},'./recommendations.server':{isChildViewer:async()=>false,loadRecommendationCandidates:async()=>[],loadRecommendationSignals:async()=>({})},'./viewing-history.server':{loadViewingHistory:async()=>[],viewingQuery:''},'./viewer.server':{getActiveViewer:async()=>null},'./api-security':{playbackFields,positiveId,profileInput,publicHttpsUrl,readVastMedia},'./subscriptionPolicy':{requiresSubscription,subscriptionFields},'./entitlement.server':{subscriptionPlaybackAccess:async()=>subscriptionDevice,entitlementDatabase:()=>null},'./entitlement-core':{resolveEntitlement:async()=>subscription},'./people.server':{loadPersonalities:async()=>[],loadTitlePeople:async()=>[],loadTitleLocations:async()=>[],loadPersonalityDetail:async()=>null}})
assert.equal((await api.fetchVastMedia({data:'https://unconfigured.example.test/tag'})).ok,false)
assert.equal(fetches,1,'Unconfigured caller-controlled URL must never invoke transport')
assert.equal((await api.purchasePayPerView({data:{type:'movie',id:1,gateway:'cash'}})).ok,false)
assert.equal(mutations,0,'Client-selected cash gateway cannot grant an entitlement')
assert.equal((await api.getMovie({data:1})).movie.video_url_input,null)
entitled=true
assert.equal((await api.getMovie({data:1})).movie.video_url_input,paid.video_url_input)
entitled=false
activeContent={...paid,movie_access:'subscription',plan_id:6}
assert.equal((await api.getMovie({data:1})).movie.hasSubscriptionAccess,false)
subscription={plan_id:6};subscriptionDevice=false
assert.equal((await api.getMovie({data:1})).movie.video_url_input,null,'Full pool cannot expose sources')
subscriptionDevice=true
assert.equal((await api.getMovie({data:1})).movie.hasSubscriptionAccess,true)
assert.equal((await api.getMovie({data:1})).movie.video_url_input,paid.video_url_input)
subscription={plan_id:9}
assert.equal((await api.getMovie({data:1})).movie.video_url_input,null,'Wrong plan cannot expose sources')
activeEpisodes=[{id:10,access:'free',video_url_input:paid.video_url_input}]
assert.equal((await api.getTvShow({data:1})).episodes[0].video_url_input,null,'Denied parent strips even free episode sources')
activeContent=paid;activeEpisodes=[];session=null
assert.equal((await api.getVideo({data:1})).video.video_url_input,null)
// Session helper enforces same-origin before all authenticated server-function writes.
let request=new Request('https://halobox.tv/server-fn',{method:'POST',headers:{origin:'https://evil.test'}}), authReads=0, authenticated=false, profileWrites=0
const sessionDB={prepare(sql){return{bind(...args){return{first:async()=>sql.includes('FROM ba_viewer_session')?{profileId:7}:args[0]===7&&args[1]===42?{id:7}:null,run:async()=>{profileWrites++;assert.deepEqual(args,[7,'fixture-session',42])}}}}}}
const sessionModule=compile('src/lib/session.server.ts',{'cloudflare:workers':{env:{DB:sessionDB}},'@tanstack/react-start/server':{getRequest:()=>request,getRequestHeaders:()=>request.headers,deleteCookie:()=>{}},'./better-auth.server':{AUTH_REALM:'viewer',getAuth:()=>({api:{getSession:async()=>{authReads++;return authenticated?{user:{id:'42'},session:{id:'fixture-session'}}:null},signOut:async()=>{}}})},'./better-auth-core':{eligibleUser:async()=>({id:42,email:'viewer@example.test'})},'./authCore':{sameOrigin}})
await assert.rejects(sessionModule.getSession())
await assert.rejects(sessionModule.clearSessionCookie())
assert.equal(authReads,0)
request=new Request('https://halobox.tv/server-fn',{method:'POST',headers:{origin:'https://halobox.tv','sec-fetch-site':'same-origin'}})
assert.equal(await sessionModule.getSession(),null)
assert.equal(authReads,1)
authenticated=true
await assert.rejects(sessionModule.setSessionCookie({uid:42,pid:999}),/belonging/)
await assert.rejects(sessionModule.setSessionCookie({uid:99,pid:7}),/Sign in again/)
assert.equal(profileWrites,0)
await sessionModule.setSessionCookie({uid:42,pid:7})
assert.equal(profileWrites,1)
// Execute the active admin module with synthetic roles; no admin data is read.
const adminRoot=process.env.HALOBOX_ADMIN_ROOT
if(adminRoot){
 let role='demo_admin',writes=0
 const module={exports:{}}
 const code=ts.transpileModule(readFileSync(adminRoot+'/src/lib/admin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const imports={'@tanstack/react-start':factory,'cloudflare:workers':{env:{}},'@tanstack/react-start/server':{getRequest:()=>new Request('https://fort.halobox.tv/server-fn',{method:'POST',headers:{origin:'https://fort.halobox.tv'}})},'./session.server':{getSession:async()=>({uid:88})},'./db':{first:async()=>({id:88,user_type:role}),all:async()=>[],run:async()=>{writes++}},'./series-validation':{},'./bunny':{},'./banner-design':{},'./locations-validation':{}}
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{assert(name in imports,name);return imports[name]},URL,console})
 await assert.rejects(module.exports.adminDeleteContent({data:1}),/read-only/)
 assert.equal(writes,0)
 role='user';await assert.rejects(module.exports.adminDeleteContent({data:1}),/Admin access required/)
}
// Public content HTML must be sanitized before it reaches the viewer.
const contentHtml=compile('src/lib/content-html.ts',{'sanitize-html':{default:sanitizeHtml}})
assert(!/script|onerror|javascript:/i.test(contentHtml.sanitizePublicContentHtml('<p>ok</p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a>')),'sanitizePublicContentHtml must strip scripts, handlers and javascript: URLs')
assert(contentHtml.sanitizePublicContentHtml('<p>ok</p>').includes('<p>ok</p>'))
globalThis.fetch=realFetch
console.log('NOV08_SECURITY_GATES_PASS: canonical realm origins, input limits, paid playback fields, server entitlement checks, no cash grant, configured HTTPS-only bounded VAST, CSRF, content HTML sanitized, demo-admin writes denied; zero network/email')
