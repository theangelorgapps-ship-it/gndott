export type CatalogueCategory = { id: number; name: string }
export function parseCategory(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !/^\d+$/.test(value)) return undefined
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}
export function catalogueCategories(items: { categories?: CatalogueCategory[] }[]): CatalogueCategory[] {
  const categories = new Map<number, CatalogueCategory>()
  for (const item of items) for (const category of item.categories ?? []) {
    if (parseCategory(category.id) && category.name.trim()) categories.set(category.id, category)
  }
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name))
}
export function filterCatalogue<T extends { categories?: CatalogueCategory[] }>(items: T[], category?: number): T[] {
  return category ? items.filter(item => item.categories?.some(entry => entry.id === category)) : items
}
