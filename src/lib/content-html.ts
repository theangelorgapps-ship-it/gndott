import sanitizeHtml from 'sanitize-html'

/** Public HTML is cleaned at read time as well as in the admin, including older saved pages. */
export function sanitizePublicContentHtml(value: unknown): string {
  return sanitizeHtml(typeof value === 'string' ? value : '', {
    allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'hr', 'a'],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], ol: ['start'] },
    allowedSchemes: ['https', 'http', 'mailto'], allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  })
}
