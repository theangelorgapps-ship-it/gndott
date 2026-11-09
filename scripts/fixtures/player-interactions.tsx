import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from '@tanstack/react-router'
import { PosterCard, LiveChannelCard, Top10Card, HeroSlider } from '../../src/components/Poster'
import { AppleSpotlight } from '../../src/components/ui/apple-spotlight'
import { Route as movie } from '../../src/routes/sermon.$id'
import { Route as video } from '../../src/routes/videos_.$id'
import { Route as show } from '../../src/routes/shows_.$id'
import { Route as teaching } from '../../src/routes/teachings_.$id'
import { Route as channel } from '../../src/routes/channel.$id'
function Home() {
  const [search,setSearch]=useState(false)
  const item={id:1,name:'Fixture Sermon',type:'movie',poster_url:'/images/entertainment/movie/poster/the_daring_player_poster.avif',video_url_input:location.origin+'/fixture.mp4'}
  return <main><button type="button" onClick={()=>setSearch(true)}>Search fixtures</button>{search&&<AppleSpotlight handleClose={()=>setSearch(false)}/>}<HeroSlider slides={[item,{...item,id:2,name:'Second fixture'}]} baseFor={()=>'/movie'}/><section className="section" style={{display:'flex',gap:24}}><PosterCard item={item} base="/movie"/><PosterCard item={{...item,name:'Fixture Video',type:'video',id:4}} base="/video"/><PosterCard item={{...item,name:'Fixture Series',type:'tvshow',id:2}} base="/tv-show"/><LiveChannelCard channel={{id:1,name:'Fixture Channel'}}/><Top10Card item={item} base="/movie" rank={1}/></section></main>
}
const root=createRootRoute({component:Outlet})
const home=createRoute({getParentRoute:()=>root,path:'/',component:Home})
const routes=[movie,video,show,teaching,channel]
// File routes receive their path at generated-tree registration in production.
const paths=['/sermon/$id','/videos/$id','/shows/$id','/teachings/$id','/channel/$id']
routes.forEach((route:any,index)=>route.update({id:paths[index],path:paths[index],getParentRoute:()=>root}))
const router=createRouter({routeTree:root.addChildren([home,...routes]),defaultPendingMinMs:0})
createRoot(document.getElementById('root')!).render(<RouterProvider router={router}/>)
