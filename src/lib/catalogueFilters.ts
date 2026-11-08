export type CatalogueCategory = { id: number; name: string }
export type CatalogueSearch = { q?: string; category?: number; year?: number }
export type FilterableTitle = { name?: string | null; description?: string | null; release_date?: string | null; categories?: CatalogueCategory[] }

export function parseCategory(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !/^\d+$/.test(value)) return undefined
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}
export function parseYear(value: unknown): number | undefined {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9]\d{3}$/.test(String(value))) return undefined
  return Number(value)
}

/** Laravel's editorial catalogue date preserves historical years. Its created_at
 * timestamps all start in 2026 and must not replace the original catalogue year. */
export function catalogueYear(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const date = value.trim()
  if (/^\d{4}$/.test(date)) return parseYear(date)
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(date)
  if (!parts || !parseYear(parts[1])) return undefined
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3])
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return month >= 1 && month <= 12 && day >= 1 && day <= days ? year : undefined
}

export function parseCatalogueSearch(search: Record<string, unknown>): CatalogueSearch {
  const q = typeof search.q === 'string' ? search.q.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
  return { q: q || undefined, category: parseCategory(search.category), year: parseYear(search.year) }
}

export function catalogueCategories(items: { categories?: CatalogueCategory[] }[]): CatalogueCategory[] {
  const categories = new Map<number, CatalogueCategory>()
  for (const item of items) for (const category of item.categories ?? []) {
    if (parseCategory(category.id) && typeof category.name === 'string' && category.name.trim()) categories.set(category.id, { id: category.id, name: category.name.trim() })
  }
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name))
}
export function catalogueYears(items: FilterableTitle[]): number[] {
  return [...new Set(items.map(item => catalogueYear(item.release_date)).filter((year): year is number => year !== undefined))].sort((a, b) => b - a)
}

function searchable(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp);/gi, ' ').replace(/\s+/g, ' ')
}

/** All selected filters combine with AND. Each word can match a different title field. */
export function filterCatalogue<T extends FilterableTitle>(items: T[], search: CatalogueSearch | number = {}): T[] {
  const { q, category, year } = typeof search === 'number' ? { category: search } : search
  const words = searchable(q ?? '').trim().split(/\s+/).filter(Boolean)
  return items.filter(item => {
    if (category && !item.categories?.some(entry => entry.id === category)) return false
    if (year && catalogueYear(item.release_date) !== year) return false
    if (!words.length) return true
    const haystack = searchable([item.name, item.description, ...(item.categories ?? []).map(entry => entry.name)].filter(Boolean).join(' '))
    return words.every(word => haystack.includes(word))
  })
}
