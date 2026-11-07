import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(path, imports = {}, globals = {}) {
  const module = { exports: {} }
  const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(output, { module, exports: module.exports, require: name => imports[name] ?? require(name), console, URL, fetch, AbortSignal, ...globals })
  return module.exports
}
const gate = process.argv[2]
if (gate === 'categories') {
  const p = load('src/lib/catalogueFilters.ts')
  const rows = [{id:1,categories:[{id:2,name:'Faith'},{id:3,name:'Prayer'}]},{id:2,categories:[{id:3,name:'Prayer'}]},{id:3,categories:[]}]
  assert.equal(p.catalogueCategories(rows).length, 2)
  assert.equal(p.filterCatalogue(rows,2).length,1)
  assert.equal(p.filterCatalogue(rows,3).length,2)
  assert.equal(p.filterCatalogue(rows,99).length,0)
  assert.equal(p.filterCatalogue(rows).length,3)
  for (const invalid of ['1 OR 1=1', -1, 0, NaN, '2e2', 2.5]) assert.equal(p.parseCategory(invalid),undefined)
  assert.equal(p.parseCategory('3'),3)
  const result = execFileSync(process.execPath,['scripts/gate-tv-data.mjs','catalogue'],{encoding:'utf8'})
  assert.match(result,/TV_DATA_API_OK/)
  console.log('HALO_CATEGORIES_OK')
} else if (gate === 'preview') {
  const p = load('src/components/previewPlayback.ts', {'./directPlayback': { createDirectPlayback() { throw new Error('test must inject media transport') } }})
  let ready=0, errors=0, destroyed=0, muted=null, rejectSound=true
  const events = new Map()
  const video = {duration:600,currentTime:0,readyState:2,muted:false,pause(){},async play(){if(!this.muted && rejectSound)throw new Error('Autoplay blocked')},addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)}
  const create = () => ({play:async()=>{},destroy:()=>{destroyed++}})
  const ctl = p.createPreviewPlayback(video,'https://media.test/playlist.m3u8',{ready:()=>ready++,muted:v=>muted=v,failure:()=>errors++},create)
  assert.equal(video.muted,true)
  events.get('loadedmetadata')()
  assert.equal(video.currentTime,30)
  assert.equal(ready,0,'Do not reveal before a completed seek')
  events.get('seeked')()
  for(let i=0;i<8;i++)await Promise.resolve()
  assert.equal(ready,1); assert.equal(muted,true,'Blocked sound must retain muted playback')
  rejectSound=false; await ctl.sound(true)
  assert.equal(muted,false,'Gesture sound action actually unmutes')
  events.get('ended')(); assert.equal(video.currentTime,30)
  ctl.destroy(); assert.equal(events.size,0); assert.equal(destroyed,1); assert.equal(errors,0)
  video.duration=30; video.currentTime=0
  const short=p.createPreviewPlayback(video,'short.mp4',{ready:()=>ready++,muted(){},failure:()=>errors++},create)
  events.get('loadedmetadata')(); assert.equal(video.currentTime,0,'Short trailers restart rather than seek beyond their duration');short.destroy()
  console.log('HALO_PREVIEW_OK')
 } else if (gate === 'bible') {
  const p = load('src/lib/bibleProvider.ts')
  let calls = 0
  const transport = async url => { calls++; assert.ok(url.startsWith('https://api.prayerpulse.io/bible/')); return {ok:true,json:async()=>[{verse:1,text:'<em>Word</em> &amp; truth'}]} }
  await assert.rejects(p.fetchBibleChapter({version:'bad',book:'JHN',chapter:3},transport))
  await assert.rejects(p.fetchBibleChapter({version:'1',book:'https://example.test',chapter:3},transport))
  await assert.rejects(p.fetchBibleChapter({version:'1',book:'JHN',chapter:0},transport))
  assert.equal(calls,0,'Invalid input must not cause any upstream request')
  const clean=await p.fetchBibleChapter({version:'1',book:'JHN',chapter:3},transport)
  assert.equal(clean.verses[0].text,'Word & truth')
  await assert.rejects(p.fetchBibleBooks('1',async()=>({ok:false,status:503})))
  await assert.rejects(p.fetchBibleBooks('1',async()=>({ok:true,json:async()=>({error:'upstream error'})})))
  await assert.rejects(p.fetchBibleChapter({version:'1',book:'JHN',chapter:3},async()=>({ok:true,json:async()=>[{verse:1,text:'a'},{verse:1,text:'duplicate'}]})))
  for (const v of p.BIBLE_VERSIONS) {
    const books=await p.fetchBibleBooks(v.id)
    assert.ok(books.length>=66); assert.equal(new Set(books.map(b=>b.id)).size,books.length)
    assert.equal(books.find(b=>b.id==='JHN').chapters,21)
    const reading=await p.fetchBibleChapter({version:v.id,book:'JHN',chapter:3})
    assert.equal(reading.verses.length,36)
    assert.ok(reading.verses.find(verse=>verse.number===16).text.length>50)
    assert.equal(reading.version,v.id)
    console.log(v.code+': '+books.length+' books; John 3: '+reading.verses.length+' verses')
  }
  console.log('HALO_BIBLE_OK')
} else if (gate === 'build') {
  for (const [cmd,args] of [['npx',['tsc','--noEmit']],['npm',['run','build']],[process.execPath,['scripts/gate-player.mjs']],[process.execPath,['scripts/gate-recommendation-v2.mjs']]]) {
    console.log(execFileSync(cmd,args,{encoding:'utf8',timeout:180000,maxBuffer:10*1024*1024}))
  }
  console.log('HALO_BUILD_OK')
} else { throw new Error('Unknown or unimplemented gate: '+gate) }
