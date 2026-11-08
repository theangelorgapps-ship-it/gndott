export const STORE_ORIGIN = 'https://uebertangel.org'
export type StoreProduct = {
  extensions?: { halobox_bridge?: { physical: boolean } };
  id: number; name: string; slug: string; description: string; short_description: string; permalink: string;
  type: string; is_purchasable: boolean; is_in_stock: boolean; has_options: boolean;
  prices: { price: string; regular_price: string; currency_code: string; currency_minor_unit: number };
  images: { id: number; src: string; alt: string }[];
  categories: { id: number; name: string; slug: string }[];
  attributes: { name: string; taxonomy: string | null; has_variations: boolean; terms: { name: string; slug: string }[] }[];
  variations: { id: number; attributes: { name: string; value: string }[] }[];
}
export function storeText(value: unknown): string {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
    const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
  }).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}
export function storeMoney(amount: string | number, currency = 'GBP', minor = 2) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(amount) / 10 ** minor)
}
export function productPath(p: Pick<StoreProduct, 'slug'|'id'>) { return `/shop/${p.slug}-${p.id}` }
export function isPhysicalProduct(p: StoreProduct) {
  return p.is_purchasable && ['simple','variable'].includes(p.type) && p.images?.length > 0 && p.extensions?.halobox_bridge?.physical === true
}
