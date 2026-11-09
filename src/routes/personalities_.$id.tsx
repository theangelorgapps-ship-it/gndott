import { contentIdFromPath } from '@/lib/contentRoutes'
import { createFileRoute } from '@tanstack/react-router'
import { getPersonalityDetail } from '../lib/people'
import { PersonalityPage } from '../components/Personality'

export const Route = createFileRoute('/personalities_/$id')({
  loader: async ({ params }) => await getPersonalityDetail({ data: contentIdFromPath(params.id) }),
  component: CastDetail,
})

function CastDetail() {
  const data = Route.useLoaderData()
  if (!data) return <div className="empty">Personality not found.</div>
  return <PersonalityPage detail={data} />
}
