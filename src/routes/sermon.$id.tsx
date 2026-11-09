import { createFileRoute, redirect } from '@tanstack/react-router'
import { canonicalContentURL } from '../lib/contentRoutes'

/** Sermon details live at /sermons/<slug-id>; keep old /sermon URLs working. */
export const Route = createFileRoute('/sermon/$id')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: canonicalContentURL(location), statusCode: 301 })
  },
})
