import { createFileRoute, Link } from '@tanstack/react-router'
import { getGenresPage } from '../lib/api'
import { img } from '../components/Poster'

export const Route = createFileRoute('/genres')({
  loader: async () => await getGenresPage(),
  component: Genres,
})

function Genres() {
  const genres = Route.useLoaderData() as any[]
  return (
    <div>
      <h1 className="page-title-center" style={{ margin: '34px 0 30px' }}>All Categories</h1>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="genre-grid">
          {genres.map((g) => (
            <Link key={g.id} to="/search" search={{ q: '', type: 'all', genre: Number(g.id) }} className="genre-card"
              style={{ backgroundImage: `url(${img(g.file_url)})` }}>
              <span className="g-name">{g.name}</span>
            </Link>
          ))}
        </div>
        {genres.length === 0 && <div className="empty">No categories available yet.</div>}
      </section>
    </div>
  )
}
