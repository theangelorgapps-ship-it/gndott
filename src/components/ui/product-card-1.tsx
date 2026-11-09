import { img } from '@/lib/imageUrls'
// Adapted from the supplied product-card-1 reference: real WooCommerce data and accessible navigation.
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react'
import { productPath, storeMoney, storeText, type StoreProduct } from '../../lib/storeTypes'
export function ProductCard({product:p}:{product:StoreProduct}){
 const [index,setIndex]=useState(0)
 return <article className="store-product-card"><div className="store-product-art">
  <Link to={productPath(p) as any} aria-label={storeText(p.name)}><img src={img(p.images[index]?.src)} alt={p.images[index]?.alt||storeText(p.name)} loading="lazy"/></Link>
  {!p.is_in_stock&&<span className="store-product-badge">Sold out</span>}
  {Number(p.prices.regular_price)>Number(p.prices.price)&&<span className="store-product-badge">Sale</span>}
  {p.images.length>1&&<div className="store-image-controls"><button aria-label={`Previous image of ${storeText(p.name)}`} onClick={()=>setIndex((index+p.images.length-1)%p.images.length)}><ChevronLeft size={17}/></button><button aria-label={`Next image of ${storeText(p.name)}`} onClick={()=>setIndex((index+1)%p.images.length)}><ChevronRight size={17}/></button></div>}
 </div><div className="store-product-copy"><span>{storeText(p.categories[0]?.name)}</span><h2><Link to={productPath(p) as any}>{storeText(p.name)}</Link></h2><div className="store-price"><strong>{p.has_options?'From ':''}{storeMoney(p.prices.price,p.prices.currency_code,p.prices.currency_minor_unit)}</strong><Link to={productPath(p) as any} aria-label={`View ${storeText(p.name)}`}><ArrowUpRight size={21}/></Link></div></div></article>
}
