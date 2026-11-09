import { useEffect, useId, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { CatalogueTitle } from '../lib/catalogue'
import { filterCatalogue, parseCatalogueSearch, type CatalogueCategory, type CatalogueSearch } from '../lib/catalogueFilters'
import { HeroSlider, PosterCard, Rail } from './Poster'
import { ChoicePicker } from './ui/choice-picker'
import { CatalogueFilterBar } from './ui/catalogue-filter-bar'

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
  base: '/movie' | '/teaching' | '/tv-show' | '/video'
  data: { heroes?: CatalogueTitle[]; suggestions?: CatalogueTitle[]; personalized?: boolean; items: CatalogueTitle[]; categories: CatalogueCategory[]; years: number[] }
  search: CatalogueSearch
  onSearchChange: (search: CatalogueSearch) => void
}) {
  const searchId = useId()
  const [draft, setDraft] = useState(search.q ?? '')
  useEffect(() => setDraft(search.q ?? ''), [search.q])
  const filtered = useMemo(() => filterCatalogue(data.items, search), [data.items, search])
  const slides = data.heroes ?? []
  const hasFilters = !!(search.q || search.category || search.year || search.sort)
  const category = data.categories.find(item => item.id === search.category)
  const update = (next: Partial<CatalogueSearch>) => onSearchChange(parseCatalogueSearch({ ...search, q: draft, ...next }))
  const clear = () => { setDraft(''); onSearchChange({}) }
  const plural = title.toLowerCase()

  return <div className="catalogue-page">
    {!!slides.length && <HeroSlider slides={slides} baseFor={() => base} ctaLabel="Watch now" />}
    <section className={`section catalogue-section${slides.length ? '' : ' catalogue-section-no-hero'}`} aria-label={title}>
      <div className="section-head"><h2>{title}</h2></div>
      <CatalogueFilterBar label={title} category={String(search.category ?? '')}
        categories={[{ value: '', label: 'All categories' }, ...data.categories.map(item => ({ value: String(item.id), label: item.name }))]}
        onCategoryChange={value => update({ category: value ? Number(value) : undefined })}
        activeCount={[search.category, search.year, search.sort].filter(Boolean).length} onReset={clear}>
        <SearchableFilter label="Category" allLabel="All categories" value={search.category} options={data.categories.map(item => ({ value: item.id, label: item.name }))} onSelect={category => update({ category })} />
        <SearchableFilter label="Year" allLabel="All years" value={search.year} options={data.years.map(year => ({ value: year, label: String(year) }))} onSelect={year => update({ year })} />
        <ChoicePicker label="Relevance" value={search.sort ?? ''} options={[{ value: '', label: 'Relevance' }, { value: 'newest', label: 'New to old' }, { value: 'oldest', label: 'Old to new' }]} onChange={sort => update({ sort: sort === 'newest' || sort === 'oldest' ? sort : undefined })} />
      </CatalogueFilterBar>
      <form className="catalogue-toolbar catalogue-toolbar-search" role="search" aria-label={`Search and filter ${plural}`} onSubmit={event => { event.preventDefault(); update({ q: draft }) }}>
        <div className="catalogue-search beam-search">
          <label className="catalogue-sr-only" htmlFor={searchId}>{`Search ${plural}`}</label>
          <input id={searchId} type="search" value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Search ${plural}`} maxLength={120} autoComplete="off" />
          {draft && <button type="button" className="catalogue-search-clear" aria-label="Clear search" onClick={() => { setDraft(''); update({ q: undefined }) }}><X size={17} aria-hidden="true" /></button>}
          <button type="submit" className="catalogue-search-submit" aria-label={`Search ${plural}`}><Search size={21} aria-hidden="true" /></button>
        </div>
      </form>
      {hasFilters && <button type="button" className="catalogue-reset" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button>}
    {!hasFilters && !!data.suggestions?.length && <div className="catalogue-suggestions">
      <Rail title={data.personalized ? `${title} for You` : `Featured ${title}`}>
        {data.suggestions.map(item => <PosterCard key={`${item.type}-${item.id}`} item={item} base={base} />)}
      </Rail>
      <p>{data.personalized ? 'Based on what you watch and save on this profile.' : 'A selection of popular and recent titles to get you started.'}</p>
    </div>}
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
