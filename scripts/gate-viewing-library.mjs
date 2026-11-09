// Exercise real server handlers and SQLite through their public read/write APIs.
import assert from 'node:assert/strict'
import {readFileSync, existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {DatabaseSync} from 'node:sqlite'
import {resolve, dirname} from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url), db=new DatabaseSync(':memory:')
let session={uid:1,pid:11}
db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,status INTEGER DEFAULT 1,is_banned INTEGER DEFAULT 0,deleted_at TEXT);
CREATE TABLE user_multi_profiles(id INTEGER PRIMARY KEY,user_id INTEGER,name TEXT,avatar TEXT,is_child_profile INTEGER,deleted_at TEXT);
CREATE TABLE entertainments(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,type TEXT,poster_url TEXT,thumbnail_url TEXT,status INTEGER DEFAULT 1,deleted_at TEXT);
CREATE TABLE videos(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,poster_url TEXT,thumbnail_url TEXT,status INTEGER DEFAULT 1,deleted_at TEXT);
CREATE TABLE episodes(id INTEGER PRIMARY KEY,entertainment_id INTEGER,name TEXT,poster_url TEXT,thumbnail_url TEXT,status INTEGER DEFAULT 1,deleted_at TEXT);
CREATE TABLE continue_watch(id INTEGER PRIMARY KEY,user_id INTEGER,profile_id INTEGER,entertainment_id INTEGER,entertainment_type TEXT,episode_id INTEGER,watched_time TEXT,total_watched_time TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
INSERT INTO users(id) VALUES(1),(2); INSERT INTO user_multi_profiles(id,user_id,name) VALUES(11,1,'First'),(12,1,'Second'),(21,2,'Other');
INSERT INTO entertainments(id,name,slug,type) VALUES(1,'First sermon','first-sermon','movie'),(2,'Prayer teaching','prayer-teaching','teaching'),(3,'Faith series','faith-series','tvshow');
INSERT INTO videos(id,name,slug) VALUES(1,'First video','first-video');
INSERT INTO episodes(id,entertainment_id,name) VALUES(31,3,'The beginning'),(32,3,'The return');`)
const d1={prepare(sql){return{bind(...p){return{all:async()=>({results:db.prepare(sql).all(...p)}),first:async()=>db.prepare(sql).get(...p)??null,run:async()=>db.prepare(sql).run(...p)}}}}}
const factory={createServerFn(){let validate=x=>x;const b={validator(fn){validate=fn;return b},handler(fn){return async(input={})=>fn({data:validate(input.data)})}};return b}}
const cache=new Map()
function load(path){path=resolve(path);if(cache.has(path))return cache.get(path).exports
 const module={exports:{}};cache.set(path,module)
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
 vm.runInNewContext(code,{module,exports:module.exports,console,URL,require(name){if(name==='@tanstack/react-start')return factory;if(name==='cloudflare:workers')return{env:{DB:d1}};if(name==='./session.server')return{getSession:async()=>session};if(name.startsWith('.')){const file=resolve(dirname(path),name);return load(existsSync(file+'.ts')?file+'.ts':file)}return require(name)}})
 return module.exports
}
const playback=load('src/lib/playback.ts')
const save=(contentType,contentId,position=120,duration=600,extra={})=>playback.recordWatchProgress({data:{contentType,contentId,position,duration,...extra}})
const history=(data={})=>playback.getViewingHistory({data:{tab:'history',...data}})
try{
 await save('movie',1,600); await save('episode',32,240); await save('video',1,1)
 let result=await history()
 assert.equal(result.items.length,3,'History includes completed playback, episodes and briefly watched videos')
 assert.equal(result.items.find(x=>x.type==='movie').completed,true)
 assert.equal(result.items.find(x=>x.episode_id===32).slug,'faith-series')
 assert.match(result.items[0].watched_at,/^\d{4}-\d{2}-\d{2}T.*Z$/)
 assert.deepEqual(Array.from((await playback.getViewingHistory({data:{tab:'continue'}})).items,x=>x.episode_id),[32])

 await save('teaching',2,350)
 assert.deepEqual(Array.from((await history({category:'video'})).items,x=>x.name),['First video'])
 assert.deepEqual(Array.from((await history({search:'return'})).items,x=>x.episode_id),[32])
 assert.equal((await history({search:'%'})).items.length,0,'Search characters are literal')
 const firstPage=await history({limit:2}), secondPage=await history({limit:2,offset:firstPage.nextOffset})
 assert.equal(firstPage.items.length,2);assert.equal(secondPage.items.length,2);assert.equal(secondPage.nextOffset,null)
 assert.equal(new Set([...firstPage.items,...secondPage.items].map(x=>x.cw_id)).size,4)
 for(const data of [{limit:49},{offset:-1},{offset:10001},{search:'x'.repeat(121)},{tab:'bogus'},{category:'live'}]) await assert.rejects(()=>history(data))
 session={uid:1,pid:12};assert.equal((await history()).items.length,0)
 await save('movie',1,240,600,{userId:2,profileId:21});assert.equal((await history()).items[0].position,240,'Client scope fields cannot redirect writes')
 session={uid:2,pid:21};assert.equal((await history({userId:1,profileId:12})).items.length,0)
 session={uid:1,pid:21};assert.equal((await history()).needsProfile,true);assert.equal((await save('movie',1)).needsProfile,true)
 session=null;assert.equal((await history()).needsAuth,true);assert.equal((await save('movie',1)).needsAuth,true)
 session={uid:1,pid:11};assert.equal((await history()).items.find(x=>x.type==='movie').position,600)
 for(const args of [['movie',1,-1],['movie',1,1,86401],['movie',1,1,Infinity],['movie',0],['teaching',1]]) {
   if(args[0]==='teaching')assert.equal((await save(...args)).ok,false);else await assert.rejects(()=>save(...args))
 }
 db.exec("INSERT INTO continue_watch(user_id,profile_id,entertainment_id,episode_id,watched_time,total_watched_time,created_at,updated_at) VALUES(1,11,3,31,'00:04:00','00:10:00','2024-01-01 12:00:00','2024-01-01 12:00:00')")
 assert.equal((await history()).items.find(x=>x.episode_id===31).position,240)
 assert.equal((await playback.getPlaybackProgress({data:{contentType:'episode',contentId:31}})).position,240,'Legacy untyped progress restores naturally')
 await save('episode',31,280)
 assert.equal((await history()).items.filter(x=>x.episode_id===31).length,1)
 assert.equal((await playback.getPlaybackProgress({data:{contentType:'episode',contentId:31}})).position,280)
 const progress=await playback.getPlaybackProgress({data:{contentType:'episode',contentId:31}})
 session={uid:1,pid:12}
 assert.equal((await save('episode',31,300,600,{profileKey:progress.profileKey})).needsProfile,true,'Queued events cannot move into a newly selected profile')
 assert.equal((await history()).items.some(x=>x.episode_id===31),false)
 console.log('VIEWING_LIBRARY_DATA_OK: history, completion, episodes, legacy resume, literal search, filters, bounded paging, user/profile isolation and invalid inputs')
}finally{db.close()}
