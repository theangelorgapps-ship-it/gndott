import { createFileRoute } from '@tanstack/react-router'
import { getPage } from '../lib/api'

export const Route = createFileRoute('/page/$slug')({
  loader: async ({ params }) => await getPage({ data: params.slug }),
  component: StaticPage,
})

function StaticPage() {
  const page = Route.useLoaderData() as any
  if (!page) return <div className="empty">Page not found.</div>
  return (
    <div className="static-page">
      <h1 className="page-title-center" style={{ margin: '34px 0 26px' }}>{page.name}</h1>
      <div className="page-content" dangerouslySetInnerHTML={{ __html: page.description ?? '' }} />
    </div>
  )
}
