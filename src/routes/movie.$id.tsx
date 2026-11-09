import { createFileRoute, redirect } from '@tanstack/react-router'
import { canonicalContentURL } from '../lib/contentRoutes'

/** Preserve saved URLs, filters and playback anchors. */
export const Route = createFileRoute('/movie/$id')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: canonicalContentURL(location), statusCode: 301 })
  },
})
