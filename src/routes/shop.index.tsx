import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { getStoreProducts } from '../lib/store'
import { storeText } from '../lib/storeTypes'
import { ProductCard } from '../components/ui/product-card-1'
export const Route=createFileRoute('/shop/')({loader:()=>getStoreProducts(),component:ShopIndex})
function ShopIndex(){
 const {products,error}=Route.useLoaderData();const [query,setQuery]=useState(''),[category,setCategory]=useState('')
 const cats=[...new Map(products.flatMap(p=>p.categories).map(c=>[c.slug,c])).values()]
 const filtered=products.filter(p=>(!category||p.categories.some(c=>c.slug===category))&&storeText(p.name).toLowerCase().includes(query.toLowerCase()))
 return <><header className="store-hero"><span>GOODNEWS • EVERY DAY</span><h1>Take the inspiration<br/>with you.</h1><p>Books to deepen your faith. Essentials for everyday life.</p></header><section className="store-catalogue"><div className="store-filters"><label><Search size={20}/><input aria-label="Search products" placeholder="Search the shop" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Product category" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All products</option>{cats.map(c=><option key={c.slug} value={c.slug}>{storeText(c.name)}</option>)}</select><span>{filtered.length} products</span></div>{error?<div role="alert"><p>{error}</p><a className="btn btn-primary" href="https://uebertangel.org/shop/">Visit the original store</a></div>:filtered.length?<div className="store-product-grid">{filtered.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<p>No products match your search.</p>}</section></>
}
