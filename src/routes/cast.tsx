import { createFileRoute } from '@tanstack/react-router'
import { getCastCrewList } from '../lib/api'
import { CircleCard } from '../components/Poster'

export const Route = createFileRoute('/cast')({
  loader: async () => await getCastCrewList(),
  component: CastList,
})

function CastList() {
  const people = Route.useLoaderData() as any[]
  return (
    <div>
      <h1 className="page-title-center" style={{ margin: '34px 0 34px' }}>Your Favourite Personality List</h1>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cast-grid">
          {people.map((p) => (
            <CircleCard key={p.id} name={p.name} image={p.file_url} to={`/cast/${p.id}`} />
          ))}
        </div>
        {people.length === 0 && <div className="empty">No personalities available yet.</div>}
      </section>
    </div>
  )
}
