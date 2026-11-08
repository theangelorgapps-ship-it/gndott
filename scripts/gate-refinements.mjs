import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const load=(file,globals={})=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,URL,...globals});return module.exports}
const {bunnySeekFrame: frame}=load('src/components/bunnySeek.ts')
const source='https://vz-example.b-cdn.net/1d964e93-6c48-4410-9f49-92fde5161f56/playlist.m3u8?token=example&expires=123'
assert.equal(frame(source,0,100).url.includes('/seek/_0.jpg?token=example&expires=123'),true)
assert.equal(frame(source,71.99,100).row,5)
assert.equal(frame(source,71.99,100).column,5)
assert.equal(frame(source,72,100).row,0)
assert.equal(frame(source,72,100).column,0)
assert.equal(frame(source,72,100).url.includes('/seek/_1.jpg'),true)
assert.equal(frame(source,5,8).column,5)
assert.equal(frame(source,-3,8).column,0)
assert.equal(frame(source,10,8).column,1)
for(const url of ['http://vz-example.b-cdn.net/1d964e93-6c48-4410-9f49-92fde5161f56/playlist.m3u8','https://b-cdn.net.evil.test/video.mp4','blob:example',null]) assert.equal(frame(url,5,100),null)
assert.equal(frame(source,NaN,100),null)
assert.equal(frame(source,5,0),null)
assert.equal(frame(source,5,Infinity),null)
assert.equal(frame(source,5,NaN),null)
let webkit=0,standard=0,exits=0
const video={webkitEnterFullscreen(){webkit++},webkitExitFullscreen(){exits++},webkitDisplayingFullscreen:false}
const doc={fullscreenElement:null,fullscreenEnabled:false,exitFullscreen:async()=>exits++}
const screen=load('src/components/playerFullscreen.ts',{document:doc})
const container={querySelector:()=>video,requestFullscreen:async()=>{standard++}}
// Native iPhone presentation must happen synchronously in the user gesture.
const pending=screen.enterPlayerFullscreen(container);assert.equal(webkit,1);await pending;assert.equal(standard,0)
doc.fullscreenEnabled=true;await screen.enterPlayerFullscreen(container);assert.equal(standard,1)
container.requestFullscreen=async()=>{throw Error('denied')};await screen.enterPlayerFullscreen(container);assert.equal(webkit,2)
video.webkitDisplayingFullscreen=true;await screen.togglePlayerFullscreen(container);assert.equal(exits,1)
await assert.rejects(()=>screen.enterPlayerFullscreen({querySelector:()=>null}),/not supported/)
console.log('REFINEMENTS_PASS: Bunny sheet boundaries, signed URL retention, invalid sources, native/standard fullscreen fallback')
