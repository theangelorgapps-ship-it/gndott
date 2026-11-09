import { createFileRoute, redirect } from '@tanstack/react-router'
import { canonicalContentURL } from '../lib/contentRoutes'

/** Personality details live at /personalities/<slug-id>; keep old /cast URLs working. */
export const Route = createFileRoute('/cast/$id')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: canonicalContentURL(location), statusCode: 301 })
  },
})
