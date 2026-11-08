import { createStart, createMiddleware } from '@tanstack/react-start'
import { canonicalDocumentURL } from './lib/canonical-origin'

const canonicalOrigin = createMiddleware().server(({ request, next }) => {
  const destination = canonicalDocumentURL(request)
  return destination ? Response.redirect(destination, 307) : next()
})

export const startInstance = createStart(() => ({ requestMiddleware: [canonicalOrigin] }))
