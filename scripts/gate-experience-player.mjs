#!/usr/bin/env node
// Deterministic production-helper tests; browser layout/media checks are a separate integration gate.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(resolve(root, file), 'utf8')
function load(file, imports = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => { if (!(name in imports)) throw Error('Unexpected dependency: '+name); return imports[name] }, setTimeout, clearTimeout })
  return module.exports
}
const p = load('src/components/playerCapabilities.ts')
const flush = async () => { for (let i=0;i<10;i++) await Promise.resolve() }

// A renewed gesture replaces the old deadline; denied hiding does not steal focus.
let now=0, next=0, canHide=true, visible=true
const jobs=new Map()
const clock={set(fn,delay){const id=++next;jobs.set(id,{fn,at:now+delay});return id},clear(id){jobs.delete(id)}}
function advance(ms){now+=ms;for(const [id,job] of [...jobs])if(job.at<=now){jobs.delete(id);job.fn()}}
const idle=p.createIdleControls(value=>{visible=value},()=>canHide,clock)
idle.reveal();advance(3719);assert.equal(visible,true)
advance(1);assert.equal(visible,false,'Control fade starts at exactly 3720 ms')
idle.reveal();advance(1000);idle.reveal();advance(2721);assert.equal(visible,true,'Activity resets the deadline')
canHide=false;advance(999);assert.equal(visible,true,'A held or keyboard-focused control remains reachable')
canHide=true;idle.reveal();advance(3720);assert.equal(visible,false)
idle.reveal();idle.destroy();advance(5000);assert.equal(visible,true);assert.equal(jobs.size,0)
idle.reveal();assert.equal(jobs.size,0,'Disposed controls cannot restart a timer')

// Wake-lock acquisition, hiding, reacquisition, rejection and stale pending requests.
function wakeHarness(request) {
  const listeners=new Map()
  const doc={visibilityState:'visible',addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)}
  const service=p.createPlaybackWakeLock({wakeLock:{request}},doc)
  return {doc,service,listeners,visibility(state){doc.visibilityState=state;listeners.get('visibilitychange')?.()}}
}
let requests=0,releases=0
const locks=[]
const wake=wakeHarness(async type=>{assert.equal(type,'screen');requests++;const lock={async release(){releases++;this.listener?.()},addEventListener(n,fn){assert.equal(n,'release');this.listener=fn}};locks.push(lock);return lock})
wake.service.setPlaying(false);await flush();assert.equal(requests,0)
wake.service.setPlaying(true);wake.service.setPlaying(true);await flush();assert.equal(requests,1,'Only one request may be pending')
wake.visibility('hidden');await flush();assert.equal(releases,1)
wake.visibility('visible');await flush();assert.equal(requests,2)
locks.at(-1).listener();await flush();assert.equal(requests,2,'Do not loop against an OS revocation')
wake.service.setPlaying(false);wake.service.setPlaying(true);await flush();assert.equal(requests,3)
wake.service.destroy();await flush();assert.equal(releases,2);assert.equal(wake.listeners.size,0)
wake.visibility('visible');wake.service.setPlaying(true);await flush();assert.equal(requests,3)
let complete,staleReleased=0
const pending=wakeHarness(()=>new Promise(resolve=>{complete=resolve}))
pending.service.setPlaying(true);pending.service.destroy()
complete({async release(){staleReleased++},addEventListener(){}});await flush();assert.equal(staleReleased,1,'Late acquired lock releases after unmount')
const denied=wakeHarness(async()=>{throw Error('NotAllowedError')});denied.service.setPlaying(true);await flush();denied.service.destroy()
const unsupported=p.createPlaybackWakeLock({}, {visibilityState:'visible',addEventListener(){},removeEventListener(){}})
unsupported.setPlaying(true);unsupported.destroy();await flush()

// PiP is capability-based and invokes actual native enter/exit methods; failure propagates to UI.
let entered=0,exited=0
const doc={pictureInPictureEnabled:true,pictureInPictureElement:null,async exitPictureInPicture(){exited++;this.pictureInPictureElement=null}}
const video={readyState:2,disablePictureInPicture:false,async requestPictureInPicture(){entered++;doc.pictureInPictureElement=this}}
assert.equal(p.supportsPictureInPicture(video,doc),true)
await p.togglePictureInPicture(video,doc);assert.equal(entered,1);assert.equal(p.isPictureInPicture(video,doc),true)
await p.togglePictureInPicture(video,doc);assert.equal(exited,1)
video.readyState=0;await assert.rejects(p.togglePictureInPicture(video,doc),/Start the video/)
video.readyState=2;video.disablePictureInPicture=true;assert.equal(p.supportsPictureInPicture(video,doc),false)
await assert.rejects(p.togglePictureInPicture(null,doc),/not available/)
video.disablePictureInPicture=false;video.requestPictureInPicture=async()=>{throw Error('OS denied')}
await assert.rejects(p.togglePictureInPicture(video,doc),/OS denied/)
const safari={readyState:2,webkitPresentationMode:'inline',webkitSupportsPresentationMode:mode=>mode==='picture-in-picture',webkitSetPresentationMode(mode){this.webkitPresentationMode=mode}}
assert.equal(p.supportsPictureInPicture(safari,{}),true)
await p.togglePictureInPicture(safari,{});assert.equal(safari.webkitPresentationMode,'picture-in-picture')
await p.togglePictureInPicture(safari,{});assert.equal(safari.webkitPresentationMode,'inline')

// Preview transports seek before revealing, do not depend on dwell timers, and recover from sound policy.
const preview=load('src/components/previewPlayback.ts',{'./directPlayback':{createDirectPlayback(){throw Error('Inject transport')}}})
function previewHarness(options) {
  const events=new Map();let ready=0,failed=0,destroyed=0,loads=0,muted=null,denied=true
  const media={duration:300,currentTime:0,readyState:2,muted:false,volume:1,pause(){},async play(){if(!this.muted&&denied)throw Error('Autoplay blocked')},addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)}
  const transport=()=>({async play(){loads++},destroy(){destroyed++}})
  const controller=preview.createPreviewPlayback(media,'https://example.test/live.m3u8',{ready:()=>ready++,failure:()=>failed++,muted:v=>muted=v},transport,options)
  return {media,controller,events,setDenied(v){denied=v},get result(){return {ready,failed,destroyed,loads,muted}}}
}
const hover=previewHarness()
assert.equal(hover.result.loads,1,'Transport starts immediately on mounting')
hover.events.get('loadedmetadata')();assert.equal(hover.media.currentTime,30);assert.equal(hover.result.ready,0)
hover.events.get('seeked')();await flush();assert.equal(hover.result.ready,0,'Seeking alone is not proof of preview playback');hover.events.get('playing')();assert.equal(hover.result.ready,1);assert.equal(hover.result.muted,true)
hover.setDenied(false);await hover.controller.sound(true);assert.equal(hover.result.muted,false)
await hover.controller.sound(false);assert.equal(hover.media.muted,true)
hover.events.get('ended')();assert.equal(hover.media.currentTime,30)
hover.controller.destroy();assert.equal(hover.events.size,0);assert.equal(hover.result.destroyed,1)
const title=previewHarness({start:0,volume:.3})
title.events.get('loadedmetadata')();await flush();assert.equal(title.media.currentTime,0);assert.equal(title.media.volume,.3);assert.equal(title.result.muted,true)
title.setDenied(false);await title.controller.sound(true);assert.equal(title.media.volume,.3);assert.equal(title.result.muted,false)
title.controller.destroy()
const mutedHero=previewHarness({start:80,volume:.3,sound:false})
mutedHero.setDenied(false)
mutedHero.events.get('loadedmetadata')();mutedHero.events.get('seeked')();await flush()
assert.equal(mutedHero.media.muted,true,'Hero must remain muted even when audible autoplay is allowed')
await mutedHero.controller.sound(true);assert.equal(mutedHero.media.muted,false,'Only explicit unmute enables hero audio')
mutedHero.controller.destroy()
const short=previewHarness();short.media.duration=20;short.events.get('loadedmetadata')();assert.equal(short.media.currentTime,0);short.controller.destroy()

// Wiring checks supplement—not replace—the production-helper assertions above.
const player=read('src/components/ImmersivePlayer.tsx'), poster=read('src/components/Poster.tsx'), style=read('src/player.css')
assert.match(player,/setPlaying\(mediaPlaying && !fallback\)/,'Wake lock follows media events')
assert.match(player,/onPlaying=\{\(\) => \{ setMediaPlaying\(true\)/)
assert.match(player,/disabled=\{!ready \|\| pipBusy\}/)
assert.match(player,/onBlurCapture=\{revealControls\}/)
const hoverSource=poster.slice(poster.indexOf('function HoverPreview'),poster.indexOf('export function LiveChannelCard'))
assert.doesNotMatch(hoverSource,/timer = setTimeout|}, 400\)/,'No hover-entry dwell')
assert.match(hoverSource,/'Sound on' : 'Mute'/,'Sound has a visible text label')
assert.match(style,/top: calc\(var\(--panel-media-top\) \+ var\(--panel-media-height\) \+ 10px\)/,'Mobile reading tray begins below the reserved video rectangle')
assert.match(style,/left: 46%/,'Short landscape phones use adjacent media and reading areas')
assert.match(style,/padding-bottom: max\(clamp\(32px, 4.5dvh, 88px\)/,'Transport gets a lifted safe-area gutter')
assert.match(read('src/components/TitleDetail.tsx'),/playback.movieAccess !== 'paid' \|\| playback.myPurchase/,'Full title preview source respects existing paid gate')
assert.doesNotMatch(read('src/components/BibleReader.tsx'),/Bible text via Prayer Pulse/)
console.log('EXPERIENCE_PLAYER_PASS')
