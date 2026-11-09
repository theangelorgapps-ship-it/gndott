import { createFileRoute, redirect } from '@tanstack/react-router'

/** Keep saved links and filter URLs working after the listing rename. */
export const Route = createFileRoute('/tv-shows')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: '/shows' + location.searchStr + (location.hash ? '#' + location.hash.replace(/^#/, '') : ''), statusCode: 301 })
  },
})
