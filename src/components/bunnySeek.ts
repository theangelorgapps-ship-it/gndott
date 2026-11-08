// Bunny's generated seek sheets: https://bunny.net/docs/stream/storage-structure
// Retain the playback URL's signing query; never strip a token or bypass access.
export function bunnySeekFrame(source: string | null, time: number, duration: number) {
  if (!source || !Number.isFinite(time) || !Number.isFinite(duration) || !(duration > 0)) return null
  try {
    const url = new URL(source)
    const folder = url.pathname.match(/^\/(?:[a-f0-9]{8}-[a-f0-9-]{27})\//i)?.[0]
    if (!url.hostname.endsWith('.b-cdn.net') || !folder || url.protocol !== 'https:') return null
    const interval = duration < 10 ? 1 : 2
    const index = Math.floor(Math.min(Math.max(0, time), Math.max(0, duration - .001)) / interval)
    url.pathname = `${folder}seek/_${Math.floor(index / 36)}.jpg`
    url.hash = ''
    return { url: url.href, column: index % 6, row: Math.floor(index % 36 / 6) }
  } catch { return null }
}
