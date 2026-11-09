/** Pure source validation shared by admin and read paths. Ingest URLs never go to viewers. */
export function liveUrl(value: unknown, kind: 'hls' | 'rtmp' = 'hls'): string | null {
 if (typeof value !== 'string' || !value.trim() || value.length > 4096) return null
 try {
  const u = new URL(value.trim()), host = u.hostname.toLowerCase()
  if (!(kind === 'hls' ? u.protocol === 'https:' : ['rtmp:', 'rtmps:'].includes(u.protocol))) return null
  if (u.username || u.password || u.hash || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return null
  return u.href
 } catch { return null }
}
/** Only known player endpoints may run in the embedded live player. Never render pasted HTML. */
export function liveEmbedUrl(value: unknown): string | null {
 if (typeof value !== 'string' || value.length > 4096) return null
 const raw = value.trim()
 const url = liveUrl(raw)
 if (!url) return null
 const u = new URL(url)
 if (u.port && u.port !== '443') return null
 if (u.hostname === 'iframe.viewmedia.tv' && u.pathname === '/' && /^\d{1,6}$/.test(u.searchParams.get('channel') || '') && [...u.searchParams.keys()].every(k => k === 'channel')) return u.href
 if (['www.youtube.com', 'www.youtube-nocookie.com'].includes(u.hostname) && /^\/embed\/[a-zA-Z0-9_-]{11}$/.test(u.pathname)) return u.href
 if (u.hostname === 'player.vimeo.com' && /^\/video\/\d+$/.test(u.pathname)) return u.href
 return null
}
export function resolveLiveSource(settings: { hls_url?: string | null; embed_url?: string | null; source_kind?: string; ingest_url?: string | null } | null, mappings: { stream_type?: string; server_url?: string; server_url1?: string }[]) {
 if (settings?.source_kind === 'embed') return liveEmbedUrl(settings.embed_url)
 if (settings?.hls_url) return liveUrl(settings.hls_url)
 if (settings?.source_kind === 'rtmp') return null
 const candidates = mappings.flatMap(row => [row.server_url, row.server_url1].map(url => ({ url: liveUrl(url), type: row.stream_type })))
 // Prefer actual HLS manifests over stale rows containing an image/landing URL.
 return candidates.find(x => x.url && /\.m3u8(?:[?#]|$)/i.test(x.url))?.url ??
  candidates.find(x => x.url && /hls/i.test(x.type || '') && !/\.(png|jpe?g|webp|avif|gif|html?)(?:[?#]|$)/i.test(x.url))?.url ?? null
}
export function liveWindow(seekable: { length: number; start: (i: number) => number; end: (i: number) => number }) {
 if (!seekable.length) return null
 const i = seekable.length - 1, start = seekable.start(i), end = seekable.end(i)
 return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end, edge: Math.max(start, end - 2), dvr: end - start > 30 } : null
}
