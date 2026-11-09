const thumbnail='/images/entertainment/movie/thumb/the_daring_player_thumb.avif'
const rows=[{id:1,cw_id:1,name:'Hope sermon',slug:'hope',type:'movie',position:600,duration:600,completed:true,watched_at:'2026-11-08T12:00:00Z',thumbnail_url:thumbnail},{id:2,cw_id:2,name:'Prayer teaching',type:'teaching',position:120,duration:600,completed:false,watched_at:'2026-11-07T12:00:00Z',thumbnail_url:thumbnail},{id:3,cw_id:3,name:'Faith series',slug:'faith-series',type:'tvshow',episode_id:32,episode_name:'The return',position:240,duration:600,completed:false,watched_at:'2026-11-06T12:00:00Z',thumbnail_url:thumbnail},{id:4,cw_id:4,name:'Grace video',type:'video',position:100,duration:600,completed:false,watched_at:'2026-11-05T12:00:00Z',thumbnail_url:thumbnail}]
async function boundary(name,input={}) {
 if(name==='getViewingHistory') {
   (window.fixtureReads??=[]).push(input.data)
   await new Promise(r=>setTimeout(r,input.data.search==='slow'?500:20))
   if(window.fixtureFailure)throw Error('Fixture unavailable')
   if(window.fixtureGuest)return {needsAuth:true,needsProfile:false,items:[],nextOffset:null}
   if(window.fixtureProfile)return {needsAuth:false,needsProfile:true,items:[],nextOffset:null}
   const {tab,category='all',search='',offset=0,limit=24}=input.data
   const items=rows.filter(x=>(tab==='history'||!x.completed)&&(category==='all'||x.type===category)&&`${x.name} ${x.episode_name??''}`.toLowerCase().includes(search.toLowerCase()))
   const size=window.fixturePaging?2:limit
   return {items:items.slice(offset,offset+size),nextOffset:items.length>offset+size?offset+size:null}
 }
 if(name==='getLibrary')return {signedIn:true,profileKey:'1:11',notes:[{note_key:'journal:one',title:'Prayer notes',html:'<p>Remember the promise.</p>',updated_at:'2026-11-08 12:00:00'}],verses:[{version:'1',book:'JHN',book_name:'John',chapter:3,verse:16,text:'A saved scripture.',highlight:'yellow',saved:1}]}
 if(name==='getPlaybackProgress')return {position:120,duration:600}
 if(name==='recordWatchProgress'){(window.fixtureWrites??=[]).push(input.data);return {ok:true}}
 if(name==='getWatchlist')return {items:[]}
 throw Error('Unexpected fixture boundary: '+name)
}
