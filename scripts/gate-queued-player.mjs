#!/usr/bin/env node
// Executes the owned components and real preview controller with deterministic
// DOM/media/timers. No network, server, provider credentials, or production data.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
let checks=0
function check(value,message){assert.ok(value,message);checks++}
let now=0,timerId=0
const timers=new Map()
const setTimer=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id}
const clearTimer=id=>timers.delete(id)
function advance(ms){now+=ms;for(const[id,t]of[...timers])if(t.at<=now){timers.delete(id);t.fn()}}
class Surface{
 constructor(name){this.name=name;this.events=new Map();this.parent=null}
 addEventListener(type,fn){const handlers=this.events.get(type)||new Set();handlers.add(fn);this.events.set(type,handlers)}
 removeEventListener(type,fn){this.events.get(type)?.delete(fn)}
 dispatchEvent(event){this.emit(event.type,event);return !event.defaultPrevented}
 emit(type,data={}){const event=Object.assign({type,target:this,currentTarget:this,detail:1,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true}},data);for(const fn of[...(this.events.get(type)||[])])fn(event);return event}
 contains(node){for(let n=node;n;n=n.parent)if(n===this)return true;return false}
 closest(selector){return selector==='.p-card'?this.card:null}
 querySelector(selector){return selector==='.p-card-link'?this.link:selector.startsWith('.halo-preview-sound')?this.firstControl:null}
 getBoundingClientRect(){return{left:150,top:220,bottom:400,width:160,height:180}}
 focus(){doc.activeElement=this}
}
class Video extends Surface{
 constructor(){super('video');this.currentTime=0;this.duration=120;this.readyState=2;this.muted=true;this.volume=1;this.attempts=[];this.pauses=0;this.loads=0}
 async play(){this.attempts.push(this.muted);if(this.rejectSound&&!this.muted)throw Error('autoplay denied');this.emit('playing')}
 pause(){this.pauses++;this.emit('pause')}
 load(){this.loads++}
 removeAttribute(name){if(name==='src')this.src=''}
}
let coarse=false,reduced=false,playerOpen=false
const win=new Surface('window'),doc=new Surface('document')
win.innerWidth=1280;win.innerHeight=900;win.matchMedia=query=>({matches:query.includes('reduced-motion')?reduced:query.includes('min-width')?!coarse:coarse,addEventListener(){},removeEventListener(){}})
doc.hidden=false;doc.body=new Surface('body');doc.body.style={};doc.querySelector=()=>playerOpen?{}:null;doc.getElementById=()=>null
const observers=[]
class Intersection{constructor(fn){this.fn=fn;observers.push(this)}observe(){this.fn([{isIntersecting:true}])}disconnect(){this.disconnected=true}}
class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail}}
const jsx=(type,props)=>({type,props:props||{}})
let current
const react={
 useState(initial){const r=current,i=r.cursor++;if(!(i in r.slots))r.slots[i]={value:typeof initial==='function'?initial():initial};return[r.slots[i].value,value=>{const next=typeof value==='function'?value(r.slots[i].value):value;if(!Object.is(next,r.slots[i].value)){r.slots[i].value=next;r.dirty=true}}]},
 useRef(value){const r=current,i=r.cursor++;return r.slots[i]??=( {current:value})},
 useId(){const r=current,i=r.cursor++;return r.slots[i]??=`test-${i}`},
 useEffect(fn,deps){const r=current,i=r.cursor++,old=r.slots[i];if(!old||!deps||deps.some((v,j)=>!Object.is(v,old.deps?.[j])))r.pending.push({i,fn,deps});},
}
function all(tree,predicate,found=[]){if(!tree)return found;if(Array.isArray(tree)){for(const node of tree)all(node,predicate,found);return found}if(typeof tree==='object'){if(predicate(tree))found.push(tree);all(tree.props?.children,predicate,found)}return found}
const find=(tree,predicate)=>all(tree,predicate)[0]
function renderer(component,props={}){
 const host=new Surface('card'),link=new Surface('link'),marker=new Surface('marker'),popup=new Surface('popup'),video=new Video(),preview=new Surface('hero-preview'),iframe=new Surface('iframe')
 host.link=link;link.parent=host;popup.firstControl=new Surface('first-control');popup.firstControl.parent=popup;marker.card=host;marker.parent=host;popup.parent=host;video.parent=popup
 iframe.contentWindow={messages:[],postMessage(...args){this.messages.push(args)}}
 const r={slots:[],cursor:0,pending:[],dirty:true,tree:null,host,link,marker,popup,video,preview,iframe,
 render(){let count=0;do{assert.ok(++count<25,'Render settles');this.dirty=false;this.cursor=0;this.pending=[];current=this;this.tree=component(props);current=null;
  for(const el of all(this.tree,x=>!!x.props?.ref)){const cls=el.props.className||'';const node=el.type==='video'?video:el.type==='iframe'?iframe:cls==='pv-marker'?marker:cls.includes('tv-title-preview')?preview:popup;el.props.ref.current=node}
  for(const job of this.pending){this.slots[job.i]?.cleanup?.();this.slots[job.i]={deps:job.deps,cleanup:job.fn()}}
 }while(this.dirty);return this.tree},unmount(){for(const slot of this.slots)slot?.cleanup?.()}}
 r.render();return r
}
const media=[]
function createDirectPlayback(video,url,callbacks){const record={video,url,destroyed:false};media.push(record);return{async play(){video.src=url;await video.play()},destroy(){if(record.destroyed)return;record.destroyed=true;video.pause();video.removeAttribute('src');video.load()},pause(){video.pause()}}}
const globals={window:win,document:doc,Node:Surface,IntersectionObserver:Intersection,CustomEvent,Event:class{},setTimeout:setTimer,clearTimeout:clearTimer,requestAnimationFrame:fn=>setTimer(fn,16),cancelAnimationFrame:clearTimer,URL,console}
function load(file,imports={},suffix=''){const module={exports:{}};vm.runInNewContext(ts.transpileModule(read(file)+suffix,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{...globals,module,exports:module.exports,require:name=>{if(name.endsWith('.css'))return{};assert.ok(name in imports,`Unexpected import ${name}`);return imports[name]}});return module.exports}
const preview=load('src/components/previewPlayback.ts',{'./directPlayback':{createDirectPlayback}})
const icons=new Proxy({},{get:(_,name)=>String(name)})
const baseImports={react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'lucide-react':icons}
const bridgeRecords=[]
const bridgeFactory=(frame,callbacks)=>{const b={muted:true,paused:false,volume(){},mute(value){b.muted=value},play(){callbacks.play()},pause(){b.paused=true},destroy(){b.destroyed=true},seek(){},get(_,fn){fn(b.muted)}};bridgeRecords.push(b);callbacks.ready(b);return b}
const title=load('src/components/TitlePreview.tsx',{...baseImports,'./Detail':{youtubeId:value=>value?.includes('youtube')?'abc123':null},'./previewPlayback':preview,'./playerBridge':{createPlayerBridge:bridgeFactory}})
const poster=load('src/components/Poster.tsx',{...baseImports,'./ScrollRail':{ScrollRail:'rail'},'@/lib/contentRoutes':{contentPath:item=>'/movie/'+item.id},'@tanstack/react-router':{Link:'a',useNavigate:()=>()=>{}},'react-dom':{createPortal:child=>child},'./previewPlayback':preview,'./TitlePreview':title,'./HeroArtwork':{HeroArtwork:'HeroArtwork'},'../lib/imageUrls':{img:value=>value,DEFAULT_IMG:'fallback'},'../lib/api':{getWatchlist:async()=>({items:[]}),toggleWatchlist:async()=>({ok:true})}},'\nexport { HoverPreview };')
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
function reveal(r){r.video.emit('loadedmetadata');r.video.emit('seeked');r.video.emit('playing');r.render()}
const item={id:1,name:'Preview fixture',poster_url:'poster.avif',thumbnail_url:'thumb.avif',movie_access:'free',video_url_input:'https://cdn.example.test/clip.mp4'}
// PASS 1: real desktop event handling, immediate muted media, user sound intent.
const card=renderer(poster.PosterCard,{item,base:'/movie'})
check(card.tree.type==='article','Card actions are siblings, never nested interactive anchors')
card.unmount()
const desktop=renderer(poster.HoverPreview,{item,base:'/movie'})
desktop.host.emit('mouseenter');desktop.render()
check(media.length===1,'Hover starts media immediately without an entrance timer')
reveal(desktop);await tick();desktop.render()
check(desktop.video.currentTime===30,'Hover seeks to 30 seconds before revealing')
check(desktop.video.attempts.every(Boolean),'Hover never attempts audible autoplay')
let sound=find(desktop.tree,x=>x.props?.['aria-label']==='Enable preview sound')
check(sound&&!sound.props.disabled,'Real unmute control is available after readiness')
sound.props.onClick();await tick();desktop.render()
check(desktop.video.muted===false,'Unmute is driven by explicit button gesture')
check(!!find(desktop.tree,x=>x.props?.['aria-label']==='Mute preview sound'),'Sound label reflects actual media state')
desktop.link.focus();win.emit('keydown',{key:'ArrowDown'});check(doc.activeElement===desktop.popup.firstControl,'Keyboard can enter popup controls from the card')
win.emit('scroll');desktop.render();check(media[0].destroyed,'Scrolling stops and releases popup media')
desktop.unmount()
// PASS 2: first touch consumes navigation, small movement allowed; swipes/cancel,
// keyboard, modifier-click, explicit actions and competing media stay correct.
coarse=true
const phone=renderer(poster.HoverPreview,{item,base:'/movie'})
phone.host.emit('pointerdown',{target:phone.link,pointerType:'touch',clientX:20,clientY:20})
phone.host.emit('pointermove',{target:phone.link,pointerType:'touch',clientX:24,clientY:23})
phone.host.emit('pointerup',{target:phone.link,pointerType:'touch',clientX:24,clientY:23})
const tap=phone.host.emit('click',{target:phone.link});phone.render()
check(tap.defaultPrevented&&tap.stopped,'First mild touch previews without navigation')
check(!!find(phone.tree,x=>x.props?.className==='p-inline-preview'),'Preview is inline, not a detached mobile popup')
reveal(phone);await tick();phone.render()
check(phone.video.currentTime===30&&phone.video.muted,'Phone preview starts at 30 seconds muted')
phone.video.rejectSound=true;find(phone.tree,x=>x.props?.['aria-label']==='Enable preview sound').props.onClick();await tick();phone.render();check(phone.video.muted&&!!find(phone.tree,x=>x.props?.['aria-label']==='Enable preview sound'),'Denied audible play falls back to honest muted playback')
check(all(phone.tree,x=>x.type==='a').length===2,'Phone retains distinct Watch and Details links')
win.emit('scroll');phone.render();check(!!find(phone.tree,x=>x.props?.className==='p-inline-preview'),'Scrolling to the explicit Watch action retains the inline preview')
check(!phone.host.emit('click',{target:phone.link,detail:0}).defaultPrevented,'Keyboard link activation still navigates')
check(!phone.host.emit('click',{target:phone.link,ctrlKey:true}).defaultPrevented,'Modified link activation is preserved')
check(!phone.host.emit('click',{target:phone.popup}).defaultPrevented,'Explicit sibling actions are not intercepted')
win.emit('gndott:preview-active',{detail:new Surface('other-preview')});phone.render()
check(!find(phone.tree,x=>x.props?.className==='p-inline-preview'),'A competing preview dismisses the current one')
const beforeSwipe=media.length
phone.host.emit('pointerdown',{target:phone.link,pointerType:'touch',clientX:20,clientY:20})
const movement=phone.host.emit('pointermove',{target:phone.link,pointerType:'touch',clientX:65,clientY:24})
phone.host.emit('pointerup',{target:phone.link,pointerType:'touch',clientX:65,clientY:24})
phone.host.emit('click',{target:phone.link});phone.render()
check(!movement.defaultPrevented&&media.length===beforeSwipe,'Swipe remains scrollable and does not open media')
phone.host.emit('pointerdown',{target:phone.link,pointerType:'touch',clientX:20,clientY:20});phone.host.emit('pointercancel',{target:phone.link});phone.host.emit('click',{target:phone.link});phone.render()
check(media.length===beforeSwipe,'Cancelled touch cannot open preview')
phone.host.emit('pointerdown',{target:phone.link,pointerType:'touch',clientX:20,clientY:20});phone.host.emit('pointerup',{target:phone.link});phone.host.emit('click',{target:phone.link});phone.render()
check(media.length===beforeSwipe+1,'A new tap recovers immediately after a swipe')
doc.emit('pointerdown',{target:new Surface('outside')});phone.render();check(media.at(-1).destroyed,'Outside tap releases inline media')
phone.unmount()
check([...phone.host.events.values()].every(set=>set.size===0),'Unmount removes card event handlers')
const locked=renderer(poster.HoverPreview,{item:{...item,movie_access:'paid'},base:'/movie'})
locked.host.emit('click',{target:locked.link});locked.render();check(!find(locked.tree,x=>x.type==='video'),'Locked full content is never used as preview');locked.unmount()
const failed=renderer(poster.HoverPreview,{item,base:'/movie'})
failed.host.emit('click',{target:failed.link});failed.render();failed.video.emit('error');failed.render()
check(!!find(failed.tree,x=>x.props?.className==='p-inline-status'),'Unavailable media has an honest fallback')
check(all(failed.tree,x=>x.type==='a').length===2,'Unavailable media retains Watch and Details');failed.unmount()
// PASS 3: actual hero component timer, pause/play/sound, competition and cleanup.
coarse=false
const hero=renderer(title.TitlePreview,{title:'Hero fixture',directVideoUrl:item.video_url_input,startSeconds:80})
const beforeHero=media.length
advance(1199);hero.render();check(media.length===beforeHero,'Hero does not load early')
advance(1);hero.render();check(media.length===beforeHero+1,'Hero begins at exactly 1.2 seconds')
reveal(hero);await tick();hero.render();check(hero.video.currentTime===80&&hero.video.muted,'Hero preserves its offset and muted startup')
find(hero.tree,x=>x.props?.['aria-label']==='Pause background preview').props.onClick();hero.render()
check(media.at(-1).destroyed,'Pause destroys background media')
const pausedCount=media.length
find(hero.tree,x=>x.props?.['aria-label']==='Play background preview').props.onClick();hero.render()
check(media.length===pausedCount+1,'Explicit preview Play resumes without another autoplay delay')
win.emit('gndott:playback-open');hero.render();check(media.at(-1).destroyed,'Full player immediately stops hero preview');hero.unmount()
reduced=true
const reducedHero=renderer(title.TitlePreview,{title:'Reduced',directVideoUrl:item.video_url_input})
const reducedCount=media.length;advance(1200);reducedHero.render();check(media.length===reducedCount,'Reduced motion disables automatic hero video')
find(reducedHero.tree,x=>x.props?.['aria-label']==='Play background preview').props.onClick();reducedHero.render();check(media.length===reducedCount+1,'Reduced motion retains explicit preview playback');reducedHero.unmount();reduced=false
const bunny=renderer(title.TitlePreview,{title:'Bunny',bunnyLibraryId:'library',bunnyVideoId:'video'})
advance(1200);bunny.render();check(bridgeRecords.at(-1).muted,'Bunny embedded preview starts muted')
find(bunny.tree,x=>x.props?.['aria-label']==='Enable preview sound').props.onClick();bunny.render();check(!bridgeRecords.at(-1).muted,'Bunny sound control calls the provider bridge')
win.emit('gndott:preview-active',{detail:new Surface('competing')});bunny.render();check(bridgeRecords.at(-1).destroyed&&bridgeRecords.at(-1).paused,'Competing preview releases embedded provider');bunny.unmount()
const youtube=renderer(title.TitlePreview,{title:'YouTube',trailerUrl:'https://youtube.com/watch?v=abc123'})
advance(1200);youtube.render();win.emit('message',{origin:'https://evil.test',source:youtube.iframe.contentWindow,data:{event:'onStateChange',info:1}});youtube.render()
check(find(youtube.tree,x=>x.props?.['aria-label']==='Enable preview sound').props.disabled,'Untrusted provider messages cannot claim readiness')
win.emit('message',{origin:'https://www.youtube.com',source:youtube.iframe.contentWindow,data:{event:'onStateChange',info:1}});youtube.render()
find(youtube.tree,x=>x.props?.['aria-label']==='Enable preview sound').props.onClick();youtube.render()
check(youtube.iframe.contentWindow.messages.some(([message])=>JSON.parse(message).func==='unMute'),'YouTube sound uses its authenticated iframe command target')
win.emit('gndott:playback-open');youtube.render();check(youtube.iframe.contentWindow.messages.some(([message])=>JSON.parse(message).func==='pauseVideo'),'Full player pauses embedded YouTube');youtube.unmount()
const carousel=renderer(poster.HeroSlider,{slides:[item,{...item,id:2}],baseFor:()=>'/movie'})
check(!find(carousel.tree,x=>x.props?.className==='hero-pause'),'Duplicate standalone slideshow play icon is removed')
check(!!find(carousel.tree,x=>x.props?.['aria-label']==='Pause Slide'),'Accessible carousel rotation pause remains')
find(carousel.tree,x=>x.props?.['aria-label']==='Pause Slide').props.onClick();carousel.render()
check(!!find(carousel.tree,x=>x.props?.['aria-label']==='Resume Slide'),'Carousel rotation can resume separately')
check(all(carousel.tree,x=>x.type==='HeroArtwork').length===2,'Hero keeps root responsive artwork integration')
carousel.unmount()
// PASS 4: Bible selection handlers and request identities; narrow-layout CSS
// contracts supplement behavior; real browser geometry remains the root gate.
const bibleRequests=[]
const books=[{id:'JHN',name:'John',chapters:21},{id:'GEN',name:'Genesis',chapters:50}]
const bible=load('src/components/BibleReader.tsx',{...baseImports,'@/lib/library':{getLibrary:async()=>({verses:[],profileKey:'fixture'}),saveLibraryVerse:async()=>({})},'../lib/bible':{getBibleBooks:async()=>({books,error:null}),getBibleChapter:async({data})=>{bibleRequests.push(data);return{passage:{...data,verses:[{number:1,text:'Fixture verse'}]},error:null}}},'../lib/bibleProvider':{BIBLE_VERSIONS:[{id:'1',code:'KJV',name:'King James'},{id:'2',code:'WEB',name:'World English'}]}})
const reader=renderer(bible.BibleReader)
await tick();reader.render()
let selects=all(reader.tree,x=>x.type==='select')
check(selects.length===3,'Three native labelled Bible selectors avoid heavy glass decoration')
check(all(reader.tree,x=>x.type==='label'&&x.props.htmlFor).length===3,'Each selector has its own associated label')
selects[1].props.onChange({target:{value:'GEN'}});reader.render();await tick();reader.render()
selects=all(reader.tree,x=>x.type==='select')
check(selects[1].props.value==='GEN'&&selects[2].props.value===1,'Changing book resets chapter to 1')
selects[2].props.onChange({target:{value:'5'}});reader.render();await tick();reader.render()
check(bibleRequests.at(-1).book==='GEN'&&bibleRequests.at(-1).chapter===5,'Chapter selection loads the selected passage')
selects=all(reader.tree,x=>x.type==='select');selects[0].props.onChange({target:{value:'2'}});reader.render();await tick();reader.render()
check(bibleRequests.at(-1).version==='2','Translation selection loads selected translation')
reader.unmount()
const css=read('src/queued-player.css')
check(css.includes('height: 48px; min-height: 48px')&&css.includes('minmax(0,1.35fr)'),'Bible controls share fixed height and shrinkable phone grid')
check(css.includes('background: #2a2a2e; box-shadow: none'),'Bible controls use flat grey surfaces')
check(observers.every(observer=>observer.disconnected),'All preview observers are cleaned up')
check(media.every(record=>record.destroyed),'Every started video controller is destroyed')
console.log(`QUEUED_PLAYER_OK: ${checks} assertions; four passes; real component events/controller/timers; no network or server.`)
