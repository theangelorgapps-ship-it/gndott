// Actual React hook with delayed RPC fixtures. No live account or progress writes.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const temporary = mkdtempSync(path.join(tmpdir(), 'halobox-playback-progress-'))
let server, browser
try {
  const fixture = `
    window.reads=[];window.writes=[];window.persisted=[];window.sessionKey='1:11';window.holdWrites=false;window.writeReleases=[];
    export const getPlaybackProgress=({data})=>new Promise((resolve,reject)=>window.reads.push({data,resolve,reject}));
    export const recordWatchProgress=async({data})=>{
      window.writes.push(data);
      const result=!window.sessionKey?{ok:false,needsAuth:true}:data.profileKey!=null&&data.profileKey!==window.sessionKey?{ok:false,needsProfile:true}:{ok:true};
      if(window.holdWrites)await new Promise(resolve=>window.writeReleases.push(resolve));
      if(result.ok)window.persisted.push(data);
      return result;
    };
  `
  await build({ stdin: { contents: `
    import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
    import{usePlaybackProgress}from'./src/hooks/usePlaybackProgress';
    function Playback({id,enabled=true}){
      const progress=usePlaybackProgress({contentType:'movie',contentId:id},enabled);
      window.observe=progress.record;window.flush=progress.flush;
      return <output>{JSON.stringify({id,saved:progress.saved,loaded:progress.loaded,saveError:progress.saveError,loadError:progress.loadError,saveRequirement:progress.saveRequirement})}</output>;
    }
    const root=createRoot(document.getElementById('app'));
    window.mount=(id,enabled=true)=>flushSync(()=>root.render(<Playback id={id} enabled={enabled}/>));
    window.closePlayback=()=>flushSync(()=>root.render(null));
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: path.join(temporary,'fixture.js'), platform: 'browser', format: 'esm', jsx: 'automatic', plugins: [{ name: 'local-rpc', setup(b) {
    b.onResolve({filter:/lib\/playback$/},()=>({path:'playback',namespace:'fixture'}))
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:fixture}))
  }}] })
  server=createServer((req,res)=>{
    res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html')
    res.end(req.url==='/fixture.js'?readFileSync(path.join(temporary,'fixture.js')):'<!doctype html><html><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'})
  const page=await browser.newPage();page.setDefaultTimeout(5000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const base=`http://127.0.0.1:${server.address().port}`
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort())
  const reset=async()=>{await page.goto(base);await page.waitForFunction(()=>typeof window.mount==='function')}
  const mount=async(id=1,enabled=true)=>page.evaluate(({id,enabled})=>window.mount(id,enabled),{id,enabled})
  const settle=async(index,profileKey='1:11',extra={})=>page.evaluate(async({index,profileKey,extra})=>{
    window.reads[index].resolve({position:0,duration:0,profileKey,...extra})
    for(let i=0;i<12;i++)await Promise.resolve()
  },{index,profileKey,extra})
  const state=async()=>JSON.parse(await page.locator('output').textContent())

  await reset();await mount()
  await page.evaluate(()=>{window.observe(12,600,true);window.observe(18,600,true);window.closePlayback()})
  assert.deepEqual(await page.evaluate(()=>window.writes),[],'No write before ownership resolves')
  await settle(0)
  assert.deepEqual(await page.evaluate(()=>window.persisted),[{contentType:'movie',contentId:1,position:18,duration:600,profileKey:'1:11'}],'Closing during the read preserves the final observed position')
  assert.equal(await page.locator('output').count(),0)

  await reset();await mount()
  await page.evaluate(()=>{window.observe(12,600,true);window.closePlayback()})
  await mount()
  await page.evaluate(()=>window.observe(30,600,true))
  await settle(1)
  await page.evaluate(()=>window.closePlayback())
  await settle(0)
  assert.deepEqual(await page.evaluate(()=>window.persisted.map(value=>value.position)),[30],'Reopening the same title keeps the newer observation even after both sessions close')

  await reset();await mount()
  await page.evaluate(()=>{window.observe(12,600,true);window.closePlayback()})
  await mount();await settle(1)
  await page.evaluate(()=>window.closePlayback())
  await settle(0)
  assert.deepEqual(await page.evaluate(()=>window.persisted.map(value=>value.position)),[12],'Reopening without observing playback preserves the earlier valid observation')

  await reset();await mount()
  await page.evaluate(()=>{window.observe(12,600,true);window.closePlayback()})
  await mount()
  await page.evaluate(()=>window.observe(30,600,true))
  await settle(1)
  await page.evaluate(()=>window.observe(5,600,true))
  await page.waitForFunction(()=>window.persisted.some(value=>value.position===5))
  await page.evaluate(()=>window.closePlayback())
  await settle(0)
  assert.deepEqual(await page.evaluate(()=>window.persisted.map(value=>value.position)),[30,5],'A later backward seek wins over the older pending observation')

  await reset();await mount();await settle(0)
  await page.evaluate(()=>{window.holdWrites=true;window.observe(12,600,true)})
  await page.waitForFunction(()=>window.writes.length===1)
  await page.evaluate(()=>window.closePlayback())
  await mount()
  await page.evaluate(()=>window.observe(30,600,true))
  await settle(1)
  assert.equal(await page.evaluate(()=>window.writes.length),1,'Reopened playback waits for an older in-flight write to finish')
  await page.evaluate(()=>window.writeReleases[0]())
  await page.waitForFunction(()=>window.writes.length===2)
  await page.evaluate(()=>window.writeReleases[1]())
  await page.waitForFunction(()=>window.persisted.length===2)
  assert.deepEqual(await page.evaluate(()=>window.persisted.map(value=>value.position)),[12,30],'Overlapping sessions write in observed order')

  await reset();await mount();await settle(0)
  await page.evaluate(()=>window.observe(12,600,true))
  await page.waitForFunction(()=>window.persisted.length===1)
  await page.evaluate(()=>{window.holdWrites=true;window.observe(30,600,true)})
  await page.waitForFunction(()=>window.writes.length===2)
  await page.evaluate(()=>{window.observe(12,600,true);window.writeReleases[0]()})
  await page.waitForFunction(()=>window.persisted.length===2)
  assert.equal(await page.evaluate(()=>window.writes.length),3,'Seeking back to the previously saved position still queues behind the in-flight write')
  await page.evaluate(()=>window.writeReleases[1]())
  await page.waitForFunction(()=>window.persisted.length===3)
  assert.deepEqual(await page.evaluate(()=>window.persisted.map(value=>value.position)),[12,30,12])

  await reset();await mount()
  await page.evaluate(()=>{window.observe(12,600,true);window.closePlayback();window.sessionKey='1:12'})
  await mount()
  await page.evaluate(()=>window.observe(30,600,true))
  await settle(1,'1:12')
  await page.evaluate(()=>{window.closePlayback();window.sessionKey='1:11'})
  await settle(0,'1:11')
  assert.deepEqual(await page.evaluate(()=>window.persisted.map(value=>[value.profileKey,value.position])),[['1:12',30],['1:11',12]],'Observations from another profile cannot supersede a valid save for the original profile')

  await reset();await mount()
  await page.evaluate(()=>{window.observe(12,600,true);window.sessionKey='2:21'})
  await settle(0,null,{needsAuth:true})
  assert.deepEqual(await page.evaluate(()=>window.writes),[],'A read without an authenticated owner cannot move observed progress into a later account')
  await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).loaded)
  assert.equal((await state()).saveRequirement,'auth','Mounted playback retains the sign-in prompt')

  await reset();await mount()
  await page.evaluate(()=>window.observe(12,600,true))
  await mount(2)
  await page.evaluate(()=>window.observe(24,800,true))
  await settle(1,'1:11',{position:200,duration:800})
  await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).loaded)
  await settle(0,'1:11',{position:90,duration:600})
  assert.deepEqual(await page.evaluate(()=>window.persisted),[
    {contentType:'movie',contentId:2,position:24,duration:800,profileKey:'1:11'},
    {contentType:'movie',contentId:1,position:12,duration:600,profileKey:'1:11'},
  ],'Out-of-order reads save each title with its own final observation')
  assert.deepEqual((await state()).saved,{position:200,duration:800},'The old read cannot replace the new title resume position')

  // Ownership can change while a read is pending, whether playback stays open
  // or closes. The server must receive the old expected owner and reject it.
  for(const sessionKey of ['1:12','2:21',null]){
    await reset();await mount()
    await page.evaluate(sessionKey=>{window.observe(12,600,true);window.sessionKey=sessionKey},sessionKey)
    await settle(0,'1:11')
    assert.equal((await page.evaluate(()=>window.writes))[0].profileKey,'1:11')
    assert.deepEqual(await page.evaluate(()=>window.persisted),[],'A stale resolved owner never moves into the new session')
    await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).saveRequirement!==null)
    assert.equal((await state()).saveRequirement,sessionKey?'profile':'auth')
  }
  await reset();await mount()
  await page.evaluate(()=>{window.observe(12,600,true);window.sessionKey='1:12';window.closePlayback()})
  await mount(2)
  await page.evaluate(()=>window.observe(25,800,true))
  await settle(1,'1:12')
  await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).loaded)
  await settle(0,'1:11')
  await page.evaluate(()=>window.observe(28,800,true))
  await page.waitForFunction(()=>window.persisted.some(value=>value.position===28))
  assert.deepEqual(await page.evaluate(()=>window.persisted.map(value=>[value.contentId,value.profileKey,value.position])),[[2,'1:12',25],[2,'1:12',28]],'An old rejected write cannot block the new playback session')
  assert.equal((await state()).saveRequirement,null)

  await reset();await mount()
  await page.evaluate(()=>window.observe(12,600,true))
  await settle(0,null,{needsProfile:true})
  await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).loaded)
  assert.equal((await state()).saveRequirement,'profile')
  await page.evaluate(()=>{window.sessionKey='1:12';window.observe(20,600,true);window.closePlayback()})
  assert.deepEqual(await page.evaluate(()=>window.writes),[],'Selecting a profile later cannot adopt observations with no resolved owner')

  await reset();await mount()
  await settle(0,'1:11',{position:120,duration:600})
  await page.evaluate(()=>{window.flush();window.closePlayback()})
  assert.deepEqual(await page.evaluate(()=>window.writes),[],'Loading saved progress without playback events never records viewing')
  for(const close of [false,true]){
    await reset();await mount()
    await page.evaluate(close=>{window.observe(12,600,true);if(close)window.closePlayback();window.reads[0].reject(new Error('Offline'))},close)
    if(!close){
      await page.waitForFunction(()=>JSON.parse(document.querySelector('output').textContent).loaded)
      assert.equal((await state()).loadError,true)
      await page.evaluate(()=>{window.observe(20,600,true);window.flush();window.closePlayback()})
    }
    assert.deepEqual(await page.evaluate(()=>window.writes),[],'Failed reads never permit an unscoped write')
  }

  assert.deepEqual(errors,[])
  console.log('PLAYBACK_PROGRESS_BROWSER_OK: delayed read/close, title changes/reopens, observation and write ordering, backward seeks, auth/profile isolation, missing ownership, read failure and no-event playback')
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));rmSync(temporary,{recursive:true,force:true})}
