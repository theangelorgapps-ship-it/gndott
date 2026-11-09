import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { img } from '../lib/imageUrls'
import './title-about-pills.css'

type AvatarItem = { id: number; name: string; file_url?: string | null }

export function ExpandableAvatarPill({ title, countLabel, items, locations = false, children }: {
  title: string
  countLabel: string
  items: AvatarItem[]
  locations?: boolean
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  return <div className={`title-about-pill${expanded ? ' is-expanded' : ''}`}>
    <button type="button" className="title-about-toggle" aria-label={`${title}, ${items.length} ${countLabel}`} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <span className="title-about-avatars" aria-hidden="true">
        {items.slice(0, 3).map(item => <span className="title-about-avatar" key={item.id}>
          {item.file_url ? <img src={img(item.file_url)} alt="" loading="lazy" /> : locations ? <MapPin size={19} /> : <span>{item.name.slice(0, 1)}</span>}
        </span>)}
      </span>
      <span className="title-about-label"><strong>{title}</strong><span>{items.length} {countLabel}</span></span>
      <ChevronDown className="title-about-chevron" size={19} aria-hidden="true" />
    </button>
    <div id={id} hidden={!expanded} className="title-about-content">{expanded && children}</div>
  </div>
}
