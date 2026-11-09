import { createFileRoute, Outlet } from '@tanstack/react-router'
import { StoreCartProvider } from '../components/StoreCart'
import '../store.css'
export const Route=createFileRoute('/shop')({component:ShopLayout})
function ShopLayout(){return <StoreCartProvider><div className="store-layout"><Outlet/></div></StoreCartProvider>}
