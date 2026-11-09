import { contentIdFromPath } from '../lib/contentRoutes'
import { createFileRoute } from '@tanstack/react-router'
import { getTvShow } from '../lib/api'
import { ShowDetail } from '../components/ShowDetail'

export const Route = createFileRoute('/teachings_/$id')({
  loader: async ({ params }) => await getTvShow({ data: contentIdFromPath(params.id) }),
  component: TeachingDetail,
})

function TeachingDetail() {
  const data = Route.useLoaderData()
  return <ShowDetail data={data} kind="teaching" />
}
