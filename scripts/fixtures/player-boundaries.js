const title = (id=1,type='movie') => ({id,name: type==='tvshow'?'Fixture Series':type==='teaching'?'Fixture Teaching':type==='video'?'Fixture Video':'Fixture Sermon',type,movie_access:id===90?'paid':'free',access:'free',hasSubscriptionAccess:id!==91,poster_url:'/images/entertainment/movie/poster/the_daring_player_poster.avif',thumbnail_url:'/images/entertainment/movie/thumb/the_daring_player_thumb.avif',video_url_input:id>=90?null:location.origin+'/fixture.mp4',description:'A local playback fixture with no account or network writes.'})
const common = {similar:[],clips:[],genres:[],cast:[],seasons:[],episodes:[],viewerId:null}
async function boundary(name,input) {
  if(name==='getMovie')return {...common,movie:title(input.data)}
  if(name==='getVideo')return {...common,video:title(input.data,'video')}
  if(name==='getTvShow')return {...common,show:{...title(input.data,'tvshow'),video_url_input:null},seasons:[{id:1,name:'Season 1'}],episodes:[{...title(20),name:'First episode',season_id:1,episode_index:1}]}
  if(name==='getLiveChannel')return {channel:{id:input.data,name:'Fixture Channel',access:'free'},related:[],streamUrl:input.data===99?null:input.data===98?'https://www.youtube.com/embed/dQw4w9WgXcQ':location.origin+'/fixture.m3u8',viewerId:null,isAdmin:false,unavailable:input.data===99?'This stream is unavailable.':null}
  if(name==='getLiveDiscussion')return {signedIn:true,canComment:true,enabled:true,slowMode:5,isAdmin:false,canModerate:input.data.channelId===77,blocked:[],mutes:[],reports:input.data.channelId===77?[{id:11,comment_id:1,reason:'spam',status:'open',body:'Reported fixture message'}]:[],comments:[{id:1,author_name:'Fixture Viewer',body:'A message for local layout verification.',mine:false}]}
  if(name==='moderateLive'){(window.fixtureModerationCalls??=[]).push(input.data);return {ok:true}}
  if(name==='sendLiveComment'){(window.fixtureCommentCalls??=[]).push(input.data);throw Error('Please wait 5 seconds before commenting again.')}
  if(name==='getWatchlist')return {items:[]}
  if(name==='getPlaybackProgress')return {position:0,duration:0}
  if(name==='recordWatchProgress')return {ok:true}
  if(name==='getLibrary')return {signedIn:false,notes:[],verses:[],watchlist:[],profileKey:null}
  if(name==='searchContent')return {movies:[title()],tvshows:[title(2,'tvshow')],teachings:[title(3,'teaching')],videos:[title(4,'video')],channels:[{id:1,name:'Fixture Channel'}]}
  if(name==='getBibleBooks')return [{id:'GEN',name:'Genesis',chapters:50,testament:'Old Testament'}]
  if(name==='getBibleChapter')return {version:'1',book:'GEN',chapter:1,verses:[{number:1,text:'Local test passage.'}]}
  throw Error('Unexpected local fixture boundary: '+name)
}
