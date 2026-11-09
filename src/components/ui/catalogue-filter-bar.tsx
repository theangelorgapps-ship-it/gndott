import { useId, useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { MobileLiquidGlass } from './liquid-glass'
import '../../catalogue-filter-bar.css'

/** Keep the category rail in the page gutter. Additional filters expand in the
 * document flow, so keyboard and mobile sheets never overlap the results. */
export function CatalogueFilterBar({ label, categories, category, onCategoryChange, activeCount = 0, onReset, children }: {
  label: string
  categories: { value: string; label: string }[]
  category: string
  onCategoryChange: (value: string) => void
  activeCount?: number
  onReset?: () => void
  children: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return <div className="filter-bar">
    <div className="filter-bar-row">
      <MobileLiquidGlass asChild><button type="button" className="filter-round-button" aria-label={`${label} filters${activeCount ? `, ${activeCount} active` : ''}`}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        {open ? <X size={21} aria-hidden="true" /> : <SlidersHorizontal size={21} aria-hidden="true" />}
        {activeCount > 0 && <span className="filter-count" aria-hidden="true">{activeCount}</span>}
      </button></MobileLiquidGlass>
      <nav className="filter-category-slider" aria-label={`${label} categories`}>
        {categories.map(option => <button key={option.value} type="button" className="category-glass" aria-pressed={category === option.value}
          onClick={() => onCategoryChange(option.value)}>{option.label}</button>)}
      </nav>
    </div>
    <div id={id} className="filter-panel" hidden={!open}>
      <div className="filter-panel-heading"><span>Filters</span>{activeCount > 0 && onReset && <button type="button" onClick={onReset}>Reset</button>}</div>
      <div className="filter-panel-fields">{open && children}</div>
    </div>
  </div>
}
