import {contentIdFromPath} from '@/lib/contentRoutes'
import { createFileRoute } from '@tanstack/react-router'
import { getCastDetail } from '../lib/api'
import { PosterCard, img } from '../components/Poster'

export const Route = createFileRoute('/cast/$id')({
  loader: async ({ params }) => await getCastDetail({ data: contentIdFromPath(params.id) }),
  component: CastDetail,
})

function CastDetail() {
  const data = Route.useLoaderData() as any
  if (!data) return <div className="empty">Personality not found.</div>
  const { person, works } = data
  return (
    <div>
      <div className="cast-hero">
        <img className="cast-hero-img" src={img(person.file_url)} alt={person.name} />
        <div>
          <h1 className="cast-hero-name">{person.name}</h1>
          {person.designation && <div className="cast-hero-role">{person.designation}</div>}
          <div className="cast-hero-meta">
            {person.place_of_birth && <span>{person.place_of_birth}</span>}
            {person.dob && <span>{person.dob}</span>}
          </div>
          {person.bio && <p className="cast-hero-bio">{person.bio}</p>}
        </div>
      </div>
      {works.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Known For</h2></div>
          <div className="grid" style={{ padding: 0 }}>
            {works.map((w: any) => (
              <PosterCard key={w.id} item={w} base={w.type === 'teaching' ? '/teaching' : w.type === 'tvshow' ? '/tv-show' : '/movie'} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
