/** Production origins are explicit and realm-specific; request Host is never authority. */
export function authBaseURL(requestURL: string, configured: unknown, realm: 'viewer' | 'admin') {
  const request = new URL(requestURL)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(request.hostname)
  if (local) return request.origin
  const allowed = realm === 'viewer'
    ? ['https://halobox.tv', 'https://gndott.theangelorgapps.workers.dev']
    : ['https://fort.halobox.tv', 'https://gndottadmin.theangelorgapps.workers.dev']
  const value = typeof configured === 'string' && configured ? configured : allowed[1]
  const url = new URL(value)
  if (!allowed.includes(url.origin) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Authentication origin is not configured.')
  }
  return url.origin
}
