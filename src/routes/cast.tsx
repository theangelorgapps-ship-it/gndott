import { createFileRoute, redirect } from '@tanstack/react-router'

/** Personalities moved to /personalities; keep old /cast URLs working. */
export const Route = createFileRoute('/cast')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: '/personalities' + location.searchStr + (location.hash ? '#' + location.hash.replace(/^#/, '') : ''), statusCode: 301 })
  },
})
