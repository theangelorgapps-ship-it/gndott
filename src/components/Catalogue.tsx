import { useEffect, useId, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { CatalogueTitle } from '../lib/catalogue'
import { filterCatalogue, parseCatalogueSearch, type CatalogueCategory, type CatalogueSearch } from '../lib/catalogueFilters'
import { HeroSlider, PosterCard } from './Poster'
import { LiquidGlassLayers } from './ui/liquid-glass'
import { ChoicePicker } from './ui/choice-picker'

function SearchableFilter({ label, allLabel, value, options, onSelect }: {
  label: string; allLabel: string; value?: number; options: { value: number; label: string }[]; onSelect: (value?: number) => void
}) {
  return <ChoicePicker label={label} value={value == null ? '' : String(value)}
    options={[{ value: '', label: allLabel }, ...options.map(option => ({ value: String(option.value), label: option.label }))]}
    onChange={next => onSelect(next ? Number(next) : undefined)} />
}

export function Catalogue({ title, singular, base, data, search, onSearchChange }: {
  title: string
  singular: string
  base: '/movie' | '/teaching' | '/tv-show'
  data: { items: CatalogueTitle[]; categories: CatalogueCategory[]; years: number[] }
  search: CatalogueSearch
  onSearchChange: (search: CatalogueSearch) => void
}) {
  const searchId = useId()
  const [draft, setDraft] = useState(search.q ?? '')
  useEffect(() => setDraft(search.q ?? ''), [search.q])
  const filtered = useMemo(() => filterCatalogue(data.items, search), [data.items, search])
  const slides = useMemo(() => data.items.filter(item => item.thumbnail_url || item.poster_url).slice(0, 5), [data.items])
  const hasFilters = !!(search.q || search.category || search.year)
  const category = data.categories.find(item => item.id === search.category)
  const update = (next: Partial<CatalogueSearch>) => onSearchChange(parseCatalogueSearch({ ...search, q: draft, ...next }))
  const clear = () => { setDraft(''); onSearchChange({}) }
  const plural = title.toLowerCase()

  return <div className="catalogue-page">
    {!!slides.length && <HeroSlider slides={slides} baseFor={() => base} ctaLabel="Watch now" />}
    <section className={`section catalogue-section${slides.length ? '' : ' catalogue-section-no-hero'}`} aria-label={title}>
      <div className="section-head"><h2>{title}</h2></div>
      <form className="catalogue-toolbar" role="search" aria-label={`Search and filter ${plural}`} onSubmit={event => { event.preventDefault(); update({ q: draft }) }}>
        <div className="catalogue-search liquid-glass">
          <LiquidGlassLayers />
          <label className="catalogue-sr-only" htmlFor={searchId}>{`Search ${plural}`}</label>
          <input id={searchId} type="search" value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Search ${plural}`} maxLength={120} autoComplete="off" />
          {draft && <button type="button" className="catalogue-search-clear" aria-label="Clear search" onClick={() => { setDraft(''); update({ q: undefined }) }}><X size={17} aria-hidden="true" /></button>}
          <button type="submit" className="catalogue-search-submit" aria-label={`Search ${plural}`}><Search size={21} aria-hidden="true" /></button>
        </div>
        <SearchableFilter label="Category" allLabel="All categories" value={search.category} options={data.categories.map(item => ({ value: item.id, label: item.name }))} onSelect={category => update({ category })} />
        <SearchableFilter label="Year" allLabel="All years" value={search.year} options={data.years.map(year => ({ value: year, label: String(year) }))} onSelect={year => update({ year })} />
        {hasFilters && <button type="button" className="catalogue-reset" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button>}
      </form>
      <p className="catalogue-result-count" role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? singular : plural}{search.q ? ` matching “${search.q}”` : ''}{search.category ? ` · ${category?.name ?? 'Unavailable category'}` : ''}{search.year ? ` · ${search.year}` : ''}</p>
      {!!filtered.length && <div className="grid catalogue-grid">{filtered.map(item => <PosterCard key={item.id} item={item} base={base} />)}</div>}
      {!filtered.length && <div className="catalogue-empty">
        <SlidersHorizontal size={28} aria-hidden="true" />
        <h3>{hasFilters ? `No ${plural} match these filters` : `No ${plural} available yet`}</h3>
        <p>{hasFilters ? 'Try another search, category or year.' : 'New titles will appear here as they are published.'}</p>
        {hasFilters && <button type="button" onClick={clear}>Show all {plural}</button>}
      </div>}
    </section>
  </div>
}
