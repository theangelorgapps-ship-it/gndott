/** Move browser pages only. Existing server callbacks/webhooks remain reachable. */
export function canonicalDocumentURL(request: Request): string | null {
  const url = new URL(request.url)
  if (!['GET', 'HEAD'].includes(request.method) || !request.headers.get('accept')?.includes('text/html')) return null
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_server/') || url.pathname.startsWith('/auth/')) return null
  if (!["gndott.theangelorgapps.workers.dev", "www.halobox.tv"].includes(url.hostname)) return null
  url.protocol = 'https:'
  url.host = "halobox.tv"
  return url.href
}
