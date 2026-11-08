import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { StoreCartProvider } from '../components/StoreCart'
import '../store.css'
export const Route=createFileRoute('/shop')({component:ShopLayout})
function ShopLayout(){return <StoreCartProvider><div className="store-layout"><nav className="store-subnav" aria-label="Store"><Link to="/shop">The Halobox Shop</Link><a className="store-order-history" href="https://uebertangel.org/myaccount/" target="_blank" rel="noopener noreferrer">Order history ↗</a></nav><Outlet/></div></StoreCartProvider>}
