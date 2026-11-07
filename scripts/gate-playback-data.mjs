#!/usr/bin/env node
// Execute the real server handlers with an in-memory SQLite D1 adapter. No network or shared data.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const db = new DatabaseSync(':memory:')
let session = { uid: 1, pid: 11 }
const queries = []
const columns = {
users:'id INTEGER PRIMARY KEY,status INTEGER DEFAULT 1,is_banned INTEGER DEFAULT 0,deleted_at TEXT',
user_multi_profiles:'id INTEGER PRIMARY KEY,user_id INTEGER,name TEXT,avatar TEXT,is_child_profile INTEGER,deleted_at TEXT',
entertainments:'id INTEGER PRIMARY KEY,name TEXT,slug TEXT,description TEXT,type TEXT,poster_url TEXT,thumbnail_url TEXT,release_date TEXT,IMDb_rating TEXT,duration TEXT,language TEXT,movie_access TEXT,content_rating TEXT,trailer_url TEXT,total_views INTEGER,created_at TEXT,updated_at TEXT,status INTEGER DEFAULT 1,deleted_at TEXT',
videos:'id INTEGER PRIMARY KEY,name TEXT,slug TEXT,description TEXT,poster_url TEXT,thumbnail_url TEXT,release_date TEXT,IMDb_rating TEXT,duration TEXT,access TEXT,content_rating TEXT,trailer_url TEXT,created_at TEXT,updated_at TEXT,status INTEGER DEFAULT 1,deleted_at TEXT',
episodes:'id INTEGER PRIMARY KEY,entertainment_id INTEGER,name TEXT,poster_url TEXT,thumbnail_url TEXT,status INTEGER DEFAULT 1,deleted_at TEXT',
continue_watch:'id INTEGER PRIMARY KEY,user_id INTEGER,profile_id INTEGER,entertainment_id INTEGER,entertainment_type TEXT,episode_id INTEGER,watched_time TEXT,total_watched_time TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT',
watchlists:'id INTEGER PRIMARY KEY,user_id INTEGER,profile_id INTEGER,entertainment_id INTEGER,type TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT',
genres:'id INTEGER PRIMARY KEY,name TEXT,status INTEGER DEFAULT 1,deleted_at TEXT',
entertainment_gener_mapping:'id INTEGER PRIMARY KEY,entertainment_id INTEGER,genre_id INTEGER'
}
for (const [name, fields] of Object.entries(columns)) db.exec(`CREATE TABLE ${name} (${fields})`)
db.exec(`INSERT INTO users(id) VALUES(1),(2); INSERT INTO user_multi_profiles(id,user_id,name) VALUES(11,1,'First'),(12,1,'Second'),(21,2,'Other');
INSERT INTO entertainments(id,name,type) VALUES(1,'Movie','movie'),(2,'Teaching','teaching'),(3,'Show','tvshow');
INSERT INTO videos(id,name) VALUES(1,'Video with colliding ID'); INSERT INTO episodes(id,entertainment_id,name) VALUES(31,3,'Episode one'),(32,3,'Episode two');
INSERT INTO genres(id,name) VALUES(1,'Faith'),(2,'Prayer'); INSERT INTO entertainment_gener_mapping(entertainment_id,genre_id) VALUES(1,1),(2,2),(3,1);
UPDATE entertainments SET thumbnail_url='movie-landscape.jpg' WHERE id=1;
UPDATE entertainments SET thumbnail_url='show-landscape.jpg' WHERE id=3;
UPDATE videos SET thumbnail_url='video-landscape.jpg' WHERE id=1;
UPDATE episodes SET thumbnail_url='episode-landscape.jpg' WHERE id=32;`)
const d1={prepare(sql){return{bind(...params){return{all:async()=>{queries.push(sql);return{results:db.prepare(sql).all(...params)}},first:async()=>db.prepare(sql).get(...params)??null,run:async()=>db.prepare(sql).run(...params)}}}}}
function compile(path,imports={}){
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:n=>n in imports?imports[n]:require(n),console,URL});return module.exports
}
const factory={createServerFn(){let validate=x=>x;const b={validator(fn){validate=fn;return b},handler(fn){return async(input={})=>fn({data:validate(input.data)})}};return b}}
const database=compile('src/lib/db.ts',{'cloudflare:workers':{env:{DB:d1}}})
const sessionModule={getSession:async()=>session,setSessionCookie:async s=>{session=s}}
const viewer=compile('src/lib/viewer.server.ts',{'./db':database,'./session.server':sessionModule})
const recommendations=compile('src/lib/recommendations.ts', {'./contentRoutes':compile('src/lib/contentRoutes.ts',{})})
const imports={'@tanstack/react-start':factory,'./db':database,'./session.server':sessionModule,'./viewer.server':viewer,'./recommendations':recommendations}
const playback=compile('src/lib/playback.ts',imports), api=compile('src/lib/api.ts',imports)
const save=(contentType,contentId,position=120,duration=600)=>playback.recordWatchProgress({data:{contentType,contentId,position,duration}})
const read=(contentType,contentId)=>playback.getPlaybackProgress({data:{contentType,contentId}})
try{
 assert.equal((await save('movie',1)).ok,true)
 await save('movie',1,180);assert.equal(db.prepare('SELECT COUNT(*) n FROM continue_watch').get().n,1,'Repeated events update existing history')
 await save('video',1,200);await save('episode',32,240)
 assert.equal((await read('movie',1)).position,180);assert.equal((await read('video',1)).position,200);assert.equal((await read('episode',32)).position,240)
 assert.equal((await read('episode',31)).position,0)
 let continuing=await api.getContinueWatching();assert.equal(continuing.items.length,3);assert.equal(continuing.items.find(x=>x.episode_id===32).episode_name,'Episode two')
 assert.equal(continuing.items.find(x=>x.type==='movie').thumbnail_url,'movie-landscape.jpg')
 assert.equal(continuing.items.find(x=>x.type==='video').thumbnail_url,'video-landscape.jpg','Typed IDs select the matching landscape artwork')
 assert.equal(continuing.items.find(x=>x.episode_id===32).thumbnail_url,'episode-landscape.jpg')
 db.exec("UPDATE episodes SET thumbnail_url='   ' WHERE id=32")
 assert.equal((await api.getContinueWatching()).items.find(x=>x.episode_id===32).thumbnail_url,'show-landscape.jpg','Missing episode artwork falls back to the show thumbnail')
 await save('movie',1,590);assert.equal((await api.getContinueWatching()).items.length,2,'Completed title leaves resume rail')
 await api.toggleWatchlist({data:{entertainmentId:2}});assert.equal((await api.getWatchlist()).items[0].id,2)
 assert.equal((await api.getRecommendations()).hasHistory,true)
 session={uid:1,pid:12};assert.equal((await read('video',1)).position,0);assert.equal((await api.getWatchlist()).items.length,0);assert.equal((await api.getContinueWatching()).items.length,0);assert.equal((await api.getRecommendations()).hasHistory,false)
 await save('movie',1,360);assert.equal((await read('movie',1)).position,360)
 session={uid:1,pid:11};assert.equal((await read('movie',1)).position,590,'Second profile cannot overwrite first')
 session={uid:2,pid:21};assert.equal((await read('movie',1)).position,0)
 session={uid:1,pid:21};assert.equal((await save('movie',1)).needsProfile,true);assert.equal((await api.getWatchlist()).needsProfile,true);assert.equal((await api.getRecommendations()).hasHistory,false,'Foreign profile cannot supply recommendations')
 session={uid:1};assert.equal((await save('movie',1)).needsProfile,true)
 session=null;assert.equal((await save('movie',1)).needsAuth,true)
 session={uid:1,pid:11};await assert.rejects(()=>save('movie',1,NaN));await assert.rejects(()=>save('movie',1,1,Infinity));await assert.rejects(()=>save('movie',-1));assert.equal((await save('movie',999)).ok,false)
 assert.equal((await save('teaching',1)).ok,false,'Incorrect content type cannot write colliding title')
 db.exec("UPDATE continue_watch SET watched_time='00:04:00',total_watched_time='00:10:00' WHERE entertainment_type='video'")
 assert.equal((await read('video',1)).position,240,'Legacy clock values resume correctly')
 db.exec('UPDATE users SET is_banned=1 WHERE id=1');assert.equal((await save('movie',1)).needsAuth,true)
 console.log('PLAYBACK_DATA_OK: real SQLite read/write, landscape artwork and fallback, typed IDs, episode resume, completion, watchlists, recommendation profile isolation, invalid input and inactive accounts')
}finally{db.close()}
