// Real server handlers against SQLite; no remote writes or network requests.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import { webcrypto, createHmac } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(path, imports = {}, globals = {}) {
 const module={exports:{}}
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:n=>imports[n]??require(n),URL,console,TextEncoder, TextDecoder,Uint8Array,btoa,atob,crypto:webcrypto,setTimeout,clearTimeout,...globals})
 return module.exports
}
const sources=load('src/lib/liveSources.ts')
if(process.argv[2]==='playback') {
 for(const url of ['rtmp://service.test/live/key','javascript:alert(1)','http://service.test/a.m3u8','https://127.0.0.1/a','https://user:pass@service.test/a','https://localhost/a']) assert.equal(sources.liveUrl(url),null)
 assert.equal(sources.liveUrl('rtmps://ingest.service.test/live/key','rtmp'),'rtmps://ingest.service.test/live/key')
 assert.equal(sources.resolveLiveSource(null,[{server_url:'https://cdn.test/poster.jpg',stream_type:'HLS'},{server_url:'https://cdn.test/live.m3u8'}]),'https://cdn.test/live.m3u8')
 assert.equal(sources.resolveLiveSource({source_kind:'rtmp',ingest_url:'rtmp://service.test/key'},[{server_url:'https://cdn.test/stale.m3u8'}]),null)
 assert.equal(sources.resolveLiveSource({hls_url:'https://cdn.test/output'},[]),'https://cdn.test/output')
 assert.equal(sources.liveWindow({length:0}),null)
 const window=sources.liveWindow({length:2,start:i=>i===1?100:0,end:i=>i===1?200:40});assert.equal(window.start,100);assert.equal(window.edge,198);assert.equal(window.dvr,true)
 assert.equal(sources.liveWindow({length:1,start:()=>100,end:()=>120}).dvr,false)
 const states=[],refs=[];let si=0,ri=0,progressEnabled=true,records=0
 const react={useState(v){const i=si++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useRef(v){const i=ri++;return refs[i]??=( {current:v})},useEffect(){},useCallback:fn=>fn}
 const p=load('src/components/ImmersivePlayer.tsx',{react,'./Detail':{youtubeId:()=>null},'./Poster':{img:v=>v,plainText:v=>v},'./playerBridge':{},'./directPlayback':{},'./playbackResume':load('src/components/playbackResume.ts'),'../lib/liveSources':sources,'../hooks/usePlaybackProgress':{usePlaybackProgress:(_,enabled)=>{progressEnabled=enabled;return{loaded:true,saved:{position:55,duration:200},record(){records++}}}}})
 const render=()=>{si=ri=0;return p.ImmersivePlayer({live:true,contentType:'video',contentId:34,title:'Channel',directVideoUrl:'https://cdn.test/output',viewerId:1})}
 const find=(t,p)=>!t||typeof t!=='object'?null:Array.isArray(t)?t.map(x=>find(x,p)).find(Boolean):p(t)?t:find(t.props?.children,p)
 let tree=render();assert.equal(progressEnabled,false);let video=find(tree,e=>e.type==='video');assert.ok(video,'Opaque HLS output uses direct shared player')
 const media={currentTime:150,duration:Infinity,seekable:{length:1,start:()=>100,end:()=>200},volume:1,muted:false}
 video.props.ref.current=media;video.props.onLoadedMetadata({currentTarget:media});video.props.onPlay();video.props.onTimeUpdate({currentTarget:media});tree=render()
 const slider=find(tree,e=>e.props?.['aria-label']==='Playback position');assert.equal(slider.props.min,100);assert.equal(slider.props.max,200)
 slider.props.onChange({target:{value:0}});assert.equal(media.currentTime,100)
 find(render(),e=>e.props?.className==='tv-go-live').props.onClick();assert.equal(media.currentTime,198)
 video.props.onPause();video.props.onEnded();assert.equal(records,0,'Live never writes VOD progress')
 assert.ok(!find(render(),e=>e.type==='button'&&e.props.children==='Notes'),'Live cannot write a note into another VOD ID')
 const direct=load('src/components/directPlayback.ts');let hlsUrl='',nativeLoads=0
 class Hls{static isSupported(){return true}static Events={ERROR:'error',MANIFEST_PARSED:'manifest'};on(){}attachMedia(){}loadSource(u){hlsUrl=u}destroy(){}}
 const dp=direct.createDirectPlayback({canPlayType:()=>'',load(){nativeLoads++},play:async()=>{},pause(){},removeAttribute(){}},'https://cdn.test/output',{qualities(){},blocked(){assert.fail('blocked')},failure(){assert.fail('failed')}},async()=>({default:Hls}),false,true)
 await dp.play();assert.equal(hlsUrl,'https://cdn.test/output');assert.equal(nativeLoads,0);dp.destroy()
 const key='isolated-live-session-test-secret-123456789';let token
 const session=load('src/lib/session.server.ts',{'cloudflare:workers':{env:{SESSION_SECRET:key}},'@tanstack/react-start/server':{getCookie:()=>token,getRequestUrl:()=> 'https://site.test',setCookie:(_,v,o)=>{token=v;assert.ok(o.secure&&o.httpOnly)},deleteCookie(){}}})
 await session.setSessionCookie({uid:1});assert.equal((await session.getSession()).uid,1)
 token+='.';assert.equal(await session.getSession(),null)
 const expired=btoa(JSON.stringify({uid:1,exp:1}));token=expired+'.'+createHmac('sha256',key).update(expired).digest('base64');assert.equal(await session.getSession(),null)
 token=await session.sign({uid:1});const [payload,signature]=token.split('.');token=btoa(JSON.stringify({uid:2,exp:9999999999}))+'.'+signature;assert.equal(await session.getSession(),null)
 console.log('LIVE_PLAYBACK_PASS');process.exit(0)
}
assert.equal(process.argv[2],'discussion')
const db=new DatabaseSync(':memory:')
db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,user_type TEXT,first_name TEXT,last_name TEXT,status INTEGER,is_banned INTEGER,deleted_at TEXT);
 INSERT INTO users VALUES(1,'user','One','Viewer',1,0,NULL),(2,'user','Two','Viewer',1,0,NULL),(3,'admin','Admin','User',1,0,NULL);
 CREATE TABLE user_multi_profiles(id INTEGER,user_id INTEGER,is_child_profile INTEGER,deleted_at TEXT);INSERT INTO user_multi_profiles VALUES(11,1,0,NULL),(12,1,1,NULL),(21,2,0,NULL);
 CREATE TABLE live_tv_channel(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,poster_url TEXT,description TEXT,access TEXT,plan_id INTEGER,category_id INTEGER,status INTEGER,deleted_at TEXT);
 INSERT INTO live_tv_channel VALUES(34,'Channel','channel',NULL,'Live','free',NULL,1,1,NULL),(35,'Other','other',NULL,'Other','free',NULL,1,1,NULL),(36,'Paid','paid',NULL,'Paid','paid',9,1,1,NULL),(37,'Hidden','hidden',NULL,'Hidden','free',NULL,1,0,NULL);
 CREATE TABLE live_tv_stream_content_mapping(id INTEGER,tv_channel_id INTEGER,stream_type TEXT,server_url TEXT,server_url1 TEXT,deleted_at TEXT);INSERT INTO live_tv_stream_content_mapping VALUES(1,34,'HLS','https://cdn.test/live.m3u8',NULL,NULL);
 CREATE TABLE subscriptions(id INTEGER,user_id INTEGER,plan_id INTEGER,status TEXT,deleted_at TEXT,start_date TEXT,end_date TEXT);
 CREATE TABLE live_tv_channel_plan_mapping(tv_channel_id INTEGER,plan_id INTEGER,deleted_at TEXT);`)
db.exec(readFileSync('migrations/20261108_live_tv.sql','utf8'))
const adapter={all:async(s,...p)=>db.prepare(s).all(...p),first:async(s,...p)=>db.prepare(s).get(...p)||null,run:async(s,...p)=>db.prepare(s).run(...p)}
let viewer=null,origin='https://site.test';const asUser=n=>viewer=n?{userId:n,profileId:n===1?11:n===2?21:null,profileName:'Viewer'}:null
const factory={createServerFn(){let validate=x=>x;return{validator(fn){validate=fn;return this},handler(fn){return async(input={})=>fn({data:validate(input.data)})}}}}
const api=load('src/lib/liveTv.ts',{'@tanstack/react-start':factory,'@tanstack/react-start/server':{setResponseHeader(){},getRequestHeader:k=>k==='origin'?origin:null,getRequestUrl:()=> 'https://site.test/channel/34'},'./db':adapter,'./viewer.server':{getActiveViewer:async()=>viewer},'./liveSources':sources})
const call=(fn,data)=>api[fn]({data});const read=()=>call('getLiveDiscussion',{channelId:34});let sequence=0
const post=(extra={})=>call('sendLiveComment',{channelId:34,body:'Hello',requestId:'test-message-'+String(++sequence).padStart(12,'0'),...extra})
const age=()=>db.exec("UPDATE live_comments SET created_at=datetime('now','-3 minutes')")
assert.equal((await call('getLiveChannel',34)).streamUrl,'https://cdn.test/live.m3u8');await assert.rejects(call('getLiveChannel',36));await assert.rejects(call('getLiveChannel',37));await assert.rejects(post());await assert.rejects(api.getLiveAdmin())
asUser(1);await assert.rejects(api.getLiveAdmin());await post({requestId:'idempotent-message-00001'});await post({requestId:'idempotent-message-00001'});assert.equal((await read()).comments.length,1);await assert.rejects(post(),/quickly/)
const firstId=(await read()).comments[0].id;age();await post({parentId:firstId,body:'Reply'});assert.equal((await read()).comments[0].reply_body,'Hello')
age();await assert.rejects(post({channelId:35,parentId:firstId}));await assert.rejects(post({announcement:true}));await assert.rejects(post({body:'x'.repeat(1001)}));viewer.profileId=12;await assert.rejects(post());assert.equal((await read()).canComment,false)
asUser(2);await call('reportLiveComment',{channelId:34,commentId:firstId,reason:'spam',detail:'Please review'});assert.equal((await read()).reports.length,1);await assert.rejects(call('reportLiveComment',{channelId:35,commentId:firstId,reason:'spam',detail:''}))
asUser(1);assert.equal((await read()).reports.length,0,'Reports cannot leak across viewers');asUser(null);assert.equal((await read()).reports.length,0)
asUser(3);const settings={channelId:34,sourceKind:'rtmp',hlsUrl:'https://cdn.test/output',ingestUrl:'rtmps://ingest.test/private-key',commentsEnabled:false,slowMode:0}
await call('saveLiveSettings',settings);assert.equal((await read()).reports.length,1);assert.equal((await api.getLiveAdmin()).channels.find(c=>c.id===34).ingest_url,settings.ingestUrl)
const publicRead=JSON.stringify(await call('getLiveChannel',34));assert.ok(!publicRead.includes('private-key'));assert.ok(!publicRead.includes('ingest_url'));await post({announcement:true,body:'Welcome from admin'})
asUser(1);age();await assert.rejects(post(),/paused/);assert.equal((await read()).canComment,false);await assert.rejects(call('saveLiveSettings',settings));await assert.rejects(call('moderateLive',{channelId:34,targetId:firstId,action:'hide'}))
asUser(3);await call('saveLiveSettings',{...settings,commentsEnabled:true});await call('moderateLive',{channelId:34,targetId:firstId,action:'pin'});assert.equal((await read()).comments[0].id,firstId);await assert.rejects(call('moderateLive',{channelId:35,targetId:firstId,action:'hide'}))
await call('moderateLive',{channelId:34,targetId:firstId,action:'mute'});asUser(1);await assert.rejects(post(),/paused/);assert.equal((await read()).canComment,false)
asUser(3);await call('moderateLive',{channelId:34,targetId:firstId,action:'hide'});assert.equal((await read()).mutes.length,1);await call('moderateLive',{channelId:34,targetId:firstId,action:'unmute'});asUser(1);age();await post();await assert.rejects(post({parentId:firstId}));assert.ok(!(await read()).comments.some(c=>c.id===firstId))
asUser(3);const reportId=(await read()).reports[0].id;await call('moderateLive',{channelId:34,targetId:reportId,action:'resolve'});assert.equal((await read()).reports[0].status,'resolved')
await assert.rejects(call('saveLiveSettings',{...settings,hlsUrl:''}));await assert.rejects(call('saveLiveSettings',{...settings,hlsUrl:'https://127.0.0.1/private'}));assert.equal((await call('getLiveChannel',34)).streamUrl,settings.hlsUrl)
origin='https://attacker.test';await assert.rejects(call('saveLiveSettings',settings));await assert.rejects(post());origin='https://site.test'
asUser(1);await assert.rejects(call('getLiveChannel',36));db.exec("INSERT INTO subscriptions VALUES(1,1,9,'active',NULL,NULL,'2099-01-01')");assert.equal((await call('getLiveChannel',36)).channel.id,36);db.exec("UPDATE subscriptions SET end_date='2000-01-01'");await assert.rejects(call('getLiveChannel',36))
assert.ok(db.prepare('SELECT count(*) AS n FROM live_moderation_log').get().n>=6)
console.log('LIVE_DISCUSSION_PASS');db.close()
