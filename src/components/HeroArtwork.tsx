import type { CSSProperties } from 'react'
import { img } from '../lib/imageUrls'
import { parseHeroDesign } from '../lib/hero-design'
import '../hero-design.css'

export function heroCopyStyle(item: any): CSSProperties | undefined {
  const design = parseHeroDesign(item.hero_design)
  const style: Record<string, string> = {}
  for (const device of ['phone', 'tablet', 'web'] as const) {
    const frame = design?.devices[device]
    if (!frame) continue
    style[`--hero-${device}-align`] = frame.align
    style[`--hero-${device}-items`] = frame.align === 'left' ? 'flex-start' : frame.align === 'right' ? 'flex-end' : 'center'
  }
  return Object.keys(style).length ? style as CSSProperties : undefined
}
export function HeroArtwork({ item, active, priority }: { item: any; active: boolean; priority?: boolean }) {
  const design = parseHeroDesign(item.hero_design)
  const source = (device: 'web' | 'tablet' | 'phone') => img(design?.devices[device]?.image || (device === 'phone' ? item.poster_url || item.thumbnail_url : item.thumbnail_url || item.poster_url))
  const style: Record<string, string> = {}
  for (const device of ['phone', 'tablet', 'web'] as const) {
    const frame = design?.devices[device]
    if (frame) { style[`--hero-${device}-fit`] = frame.fit; style[`--hero-${device}-position`] = `${frame.x}% ${frame.y}%` }
  }
  return <picture className={`hero-artwork-layer${active ? ' is-active' : ''}`}>
    <source media="(max-width: 600px)" srcSet={source('phone')}/>
    <source media="(max-width: 1024px)" srcSet={source('tablet')}/>
    <img className="hero-device-art" src={source('web')} alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" style={style as CSSProperties}/>
  </picture>
}
