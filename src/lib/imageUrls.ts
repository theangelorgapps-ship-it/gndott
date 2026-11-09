import manifest from './img-manifest.json'

export const DEFAULT_IMG = '/default-image.avif'
const MANIFEST = manifest as Record<string,string>

/** Only the store's public upload directory may be fetched by the artwork proxy. */
export function allowedExternalArtwork(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['uebertangel.org','www.uebertangel.org'].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash) return null
    if (!url.pathname.startsWith('/wp-content/uploads/') || !/\.(png|jpe?g|webp|avif)$/i.test(url.pathname) || /%2f|%5c|%2e/i.test(url.pathname)) return null
    return url
  } catch { return null }
}

export function img(url: string | null | undefined): string {
  if (!url) return DEFAULT_IMG
  if (MANIFEST[url]) return MANIFEST[url]
  if (url.startsWith('/media/')) return url
  if (url.startsWith('/images/') && url.endsWith('.avif')) return url
  const external = allowedExternalArtwork(url)
  if (external) return `/media/external?url=${encodeURIComponent(external.href)}`
  if (/^https?:\/\//.test(url) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) return url
  const base = url.split('/').pop()?.split('?')[0] ?? url
  const stem = base.replace(/\.(png|jpe?g|webp|avif)$/i,'')
  return MANIFEST[base] ?? MANIFEST[stem] ?? DEFAULT_IMG
}
