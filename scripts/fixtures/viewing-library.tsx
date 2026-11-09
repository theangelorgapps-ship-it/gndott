import { createRoot } from 'react-dom/client'
import { createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from '@tanstack/react-router'
import { AccountLibrary } from '../../src/components/AccountLibrary'
import { ImmersivePlayer } from '../../src/components/ImmersivePlayer'
import { ViewingLibrary } from '../../src/components/ViewingLibrary'
const root=createRootRoute({component:Outlet})
const home=createRoute({getParentRoute:()=>root,path:'/',component:()=> <main style={{maxWidth:1100,margin:'40px auto',padding:20}}><AccountLibrary /></main>})
const viewing=createRoute({getParentRoute:()=>root,path:'/continue-watching',component:()=> <main style={{maxWidth:1100,margin:'40px auto',padding:20}}><h1>Your viewing</h1><ViewingLibrary /></main>})
const saved=createRoute({getParentRoute:()=>root,path:'/watchlist',component:()=> <h1>Saved titles</h1>})
const player=createRoute({getParentRoute:()=>root,path:'/player',component:()=> <ImmersivePlayer contentType="movie" contentId={17} title="Embedded sermon" trailerUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ" viewerId={1}/>})
const router=createRouter({routeTree:root.addChildren([home,viewing,saved,player])})
createRoot(document.getElementById('root')!).render(<RouterProvider router={router}/>)
