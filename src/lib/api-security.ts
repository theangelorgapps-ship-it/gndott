/** Public API policy, separate from UI gating so it can be exercised offline. */
export function playbackFields<T extends Record<string, any>>(item: T, entitled = false, parentDenied = false): T {
  if (!parentDenied && ((item.movie_access ?? item.access) !== 'paid' || entitled)) return item
  return { ...item, bunny_video_url: null, video_url_input: null, video_url: null, video_url_output: null, download_url: null }
}
export function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('Choose a valid item.')
  return value
}
export function profileInput(value: { id?: number; name: string; isChild?: boolean }) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80 || (value.isChild !== undefined && typeof value.isChild !== 'boolean')) throw new Error('Use a profile name of 1–80 characters.')
  if (value.id !== undefined) positiveId(value.id)
  return { ...value, name: value.name.trim() }
}
export function publicHttpsUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid media URL.')
  const url = new URL(value)
  // URLs must also match an active administrator-configured ad before any fetch.
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !url.hostname.includes('.') || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) throw new Error('Invalid media URL.')
  return url.href
}
export async function readVastMedia(url: string, transport: typeof fetch = fetch) {
  const response = await transport(publicHttpsUrl(url), { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Halobox-VAST/1.0', Accept: 'application/xml,text/xml' } })
  if (!response.ok || !response.body || Number(response.headers.get('content-length') ?? 0) > 262144) throw new Error('Unavailable ad.')
  const reader = response.body.getReader()
  let total = 0, xml = ''
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > 262144) throw new Error('Unavailable ad.')
      xml += decoder.decode(value, { stream: true })
    }
    xml += decoder.decode()
  } finally { await reader.cancel() }
  const media = xml.match(/<MediaFile[^>]*type="video\/(?:mp4|webm)"[^>]*>\s*(?:<!\[CDATA\[)?(https:\/\/[^<\]]+)/i)
    ?? xml.match(/<MediaFile[^>]*>\s*(?:<!\[CDATA\[)?(https:\/\/[^<\]]+\.mp4[^<\]]*)/i)
  if (!media) return { ok: false as const, error: 'No playable media in VAST tag.' }
  return { ok: true as const, mediaUrl: publicHttpsUrl(media[1].trim()), duration: xml.match(/<Duration>([^<]+)<\/Duration>/)?.[1] ?? null }
}
