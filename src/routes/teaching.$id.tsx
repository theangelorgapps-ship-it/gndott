import { createFileRoute } from '@tanstack/react-router'
import { getTvShow } from '../lib/api'
import { ShowDetail } from '../components/ShowDetail'

export const Route = createFileRoute('/teaching/$id')({
  loader: async ({ params }) => await getTvShow({ data: Number(params.id) }),
  component: TeachingDetail,
})

function TeachingDetail() {
  const data = Route.useLoaderData()
  return <ShowDetail data={data} kind="teaching" />
}
