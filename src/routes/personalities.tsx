import { createFileRoute } from '@tanstack/react-router'
import { getPersonalities } from '../lib/people'
import { PersonalityCard } from '../components/Personality'

export const Route = createFileRoute('/personalities')({
  loader: async () => await getPersonalities(),
  component: CastList,
})

function CastList() {
  const people = Route.useLoaderData() as any[]
  return (
    <div>
      <h1 className="page-title-center" style={{ margin: '34px 0 34px' }}>Personalities</h1>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cast-grid">
          {people.map((p) => (
            <PersonalityCard key={p.id} person={p} />
          ))}
        </div>
        {people.length === 0 && <div className="empty">No personalities available yet.</div>}
      </section>
    </div>
  )
}
