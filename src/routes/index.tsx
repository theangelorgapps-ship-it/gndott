import { createFileRoute, Link } from '@tanstack/react-router'
import { getDashboard, getHomeAds } from '../lib/api'
import { PosterCard, Top10Card, Rail, HeroSlider, img } from '../components/Poster'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [dash, homeAds] = await Promise.all([getDashboard(), getHomeAds()])
    return { ...dash, homeAds }
  },
  component: Home,
})

function HomeAds({ ads }: { ads: any[] }) {
  if (!ads?.length) return null
  return (
    <section className="section">
      {ads.map((ad: any) => {
        const src = ad.url_type === 'url' ? ad.media : img(ad.media)
        const inner = ad.type === 'video'
          ? <video className="home-ad" src={src} autoPlay muted loop playsInline />
          : <img className="home-ad" src={src} alt={ad.name ?? 'Sponsored'} loading="lazy" />
        return (
          <div key={ad.id} className="home-ad-wrap">
            <span className="ad-badge" style={{ position: 'absolute' }}>Sponsored</span>
            {ad.redirect_url ? <a href={ad.redirect_url} target="_blank" rel="noreferrer">{inner}</a> : inner}
          </div>
        )
      })}
    </section>
  )
}

function baseFor(item: any) {
  return item.type === 'teaching' ? '/teaching' : item.type === 'tvshow' ? '/tv-show' : '/movie'
}

function Home() {
  const data = Route.useLoaderData()
  const slides = (data.top10.length ? data.top10 : data.popularMovies).slice(0, 3)

  return (
    <div>
      <HeroSlider slides={slides} baseFor={baseFor} genres={data.genres} />

      <HomeAds ads={(data as any).homeAds} />

      {data.top10.length > 0 && (
        <Rail title="Top 10">
          {data.top10.map((m: any, i: number) => (
            <Top10Card key={m.id} item={m} rank={i + 1} base={baseFor(m)} />
          ))}
        </Rail>
      )}

      {data.latest.length > 0 && (
        <Rail title="New Released Sermons" seeAll="/movies">
          {data.latest.map((m: any) => <PosterCard key={m.id} item={m} base={baseFor(m)} />)}
        </Rail>
      )}

      {data.payPerView?.length > 0 && (
        <Rail title="Pay Per View" seeAll="/movies">
          {data.payPerView.map((m: any) => <PosterCard key={m.id} item={m} base={baseFor(m)} />)}
        </Rail>
      )}

      {data.popularMovies.length > 0 && (
        <Rail title="Popular Sermons" seeAll="/movies">
          {data.popularMovies.map((m: any) => <PosterCard key={m.id} item={m} base={baseFor(m)} />)}
        </Rail>
      )}

      {data.channels.length > 0 && (
        <Rail title="Top Channels" seeAll="/live-tv">
          {data.channels.map((c: any) => (
            <Link key={c.id} to={`/channel/${c.id}` as any} className="c-circle">
              <img src={img(c.poster_url)} alt={c.name} loading="lazy" />
              <div className="c-name">{c.name}</div>
            </Link>
          ))}
        </Rail>
      )}

      {data.popularTvShows.length > 0 && (
        <Rail title="Popular Shows" seeAll="/tv-shows">
          {data.popularTvShows.map((m: any) => <PosterCard key={m.id} item={m} base={baseFor(m)} />)}
        </Rail>
      )}

      {data.cast?.length > 0 && (
        <Rail title="Popular Personalities">
          {data.cast.map((c: any) => (
            <div key={c.id} className="c-circle">
              <img src={img(c.file_url)} alt={c.name} loading="lazy" />
              <div className="c-name">{c.name}</div>
              <div className="c-sub">{c.designation ?? 'Actor'}</div>
            </div>
          ))}
        </Rail>
      )}

      {data.free.length > 0 && (
        <Rail title="Free Sermons" seeAll="/movies">
          {data.free.map((m: any) => <PosterCard key={m.id} item={m} base={baseFor(m)} />)}
        </Rail>
      )}

      {data.genres.length > 0 && (
        <Rail title="Genres">
          {data.genres.map((g: any) => (
            <Link key={g.id} to="/search" search={{ q: g.name } as any} className="c-circle">
              <img src={DEFAULT_GENRE_IMG} alt={g.name} loading="lazy" />
              <div className="c-name">{g.name}</div>
            </Link>
          ))}
        </Rail>
      )}

      {data.comingSoon.length > 0 && (
        <Rail title="Coming Soon" seeAll="/coming-soon">
          {data.comingSoon.map((m: any) => <PosterCard key={m.id} item={m} base={baseFor(m)} />)}
        </Rail>
      )}

      {data.mostWatched?.length > 0 && (
        <Rail title="Most Watched Videos" seeAll="/videos">
          {data.mostWatched.map((m: any) => <PosterCard key={m.id} item={m} base="/video" />)}
        </Rail>
      )}
    </div>
  )
}

const DEFAULT_GENRE_IMG = '/default-image.jpg'
