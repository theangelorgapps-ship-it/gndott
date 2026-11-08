import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import type { CatalogueTitle } from '../lib/catalogue'
import { filterCatalogue, parseCatalogueSearch, type CatalogueCategory, type CatalogueSearch } from '../lib/catalogueFilters'
import { HeroSlider, PosterCard } from './Poster'
import { LiquidGlassLayers } from './ui/liquid-glass'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

type Choice = { value: number; label: string }

function SearchableFilter({ label, allLabel, value, options, onSelect }: {
  label: string; allLabel: string; value?: number; options: Choice[]; onSelect: (value?: number) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(option => option.value === value)
  const choices = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const choose = (next?: number) => { onSelect(next); setOpen(false) }
  function moveFocus(event: KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    if (!buttons.length) return
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length
    event.preventDefault()
    buttons[next]?.focus()
  }
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setQuery('') }}>
    <PopoverTrigger asChild>
      <button type="button" className="catalogue-select liquid-glass" aria-label={`${label}: ${selected?.label ?? (value ? `Unavailable ${label.toLowerCase()}` : allLabel)}`}>
        <LiquidGlassLayers />
        <span className="catalogue-select-label"><small>{label}</small><span>{selected?.label ?? (value ? String(value) : allLabel)}</span></span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="catalogue-popover" align="start" aria-label={`Choose ${label.toLowerCase()}`} onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus() }}>
      <label className="catalogue-option-search" htmlFor={id}>
        <Search size={18} aria-hidden="true" />
        <input ref={input} id={id} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${label === 'Category' ? 'categories' : 'years'}`} aria-label={`Search ${label === 'Category' ? 'categories' : 'years'}`} autoComplete="off" onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); list.current?.querySelector<HTMLButtonElement>('button')?.focus() } }} />
      </label>
      <div className="catalogue-options" ref={list} role="group" aria-label={`${label} options`} data-lenis-prevent onKeyDown={moveFocus}>
        <button type="button" aria-pressed={!value} onClick={() => choose()}><span>{allLabel}</span>{!value && <Check size={17} aria-hidden="true" />}</button>
        {choices.map(option => <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => choose(option.value)}><span>{option.label}</span>{option.value === value && <Check size={17} aria-hidden="true" />}</button>)}
        {!choices.length && <p role="status">{query ? `No matching ${label === 'Category' ? 'categories' : 'years'}.` : `No ${label === 'Category' ? 'categories' : 'years'} available yet.`}</p>}
      </div>
    </PopoverContent>
  </Popover>
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
