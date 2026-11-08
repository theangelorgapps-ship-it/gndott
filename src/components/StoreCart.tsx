import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ShoppingBag, X, ArrowRight } from 'lucide-react'
import { getStoreCart, updateStoreCart } from '../lib/store'
import { storeMoney, storeText } from '../lib/storeTypes'

type CartContext = { cart:any; busy:boolean; error:string; update:(data:Parameters<typeof updateStoreCart>[0]['data'])=>Promise<boolean>; refresh:()=>Promise<void> }
const StoreContext=createContext<CartContext|null>(null)
export function useStoreCart(){const c=useContext(StoreContext);if(!c)throw new Error('Store cart provider missing');return c}
export function StoreCartProvider({children}:{children:ReactNode}){
 const [cart,setCart]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const path=useRouterState({select:s=>s.location.pathname})
 const [open,setOpen]=useState(false)
 const refresh=async()=>{try{setCart(await getStoreCart());setError('')}catch{setError('Unable to load your cart. Please retry.')}}
 useEffect(()=>{void refresh()},[])
 useEffect(()=>{setOpen(false)},[path])
 const update=async(data:Parameters<typeof updateStoreCart>[0]['data'])=>{setBusy(true);setError('');try{setCart(await updateStoreCart({data}));if(data.action==='add')setOpen(true);return true}catch(e){setError(e instanceof Error?e.message:'Unable to update your cart.');return false}finally{setBusy(false)}}
 return <StoreContext.Provider value={{cart,busy,error,update,refresh}}>{children}
  {path!=='/shop/checkout' && <aside className={`store-floating-cart${open?' expanded':''}`} aria-label="Shopping cart">
    <button className="store-cart-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><ShoppingBag size={21}/><span>Cart <b>{cart?.items_count||0}</b></span>{open?<X size={19}/>:<span>{cart?.totals?storeMoney(cart.totals.total_items,cart.totals.currency_code,cart.totals.currency_minor_unit):''}</span>}</button>
    {open && <div className="store-mini-cart"><h2>Your cart</h2>{cart?.items?.length?cart.items.map((item:any)=><div key={item.key} className="store-mini-item"><img src={item.images?.[0]?.thumbnail||item.images?.[0]?.src} alt=""/><div><strong>{storeText(item.name)}</strong>{item.variation?.map((v:any)=><small key={v.attribute}>{storeText(v.attribute)}: {storeText(v.value)} </small>)}<p>{item.quantity} × {storeMoney(item.prices.price,item.prices.currency_code,item.prices.currency_minor_unit)}</p></div></div>):<p>Your cart is empty.</p>}
    {error&&<p role="alert">{error}<button onClick={()=>void refresh()}>Retry</button></p>}
    {!!cart?.items?.length&&<Link className="btn btn-primary" to="/shop/checkout">Review & checkout <ArrowRight size={18}/></Link>}
    </div>}
  </aside>}
 </StoreContext.Provider>
}
