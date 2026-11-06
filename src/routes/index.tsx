import { createFileRoute, Link } from '@tanstack/react-router'
import { getDashboard, getHomeAds } from '../lib/api'
import { PosterCard, Top10Card, Rail, HeroSlider, RecommendationGroups, contentBase, img } from '../components/Poster'

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
        return <div key={ad.id} className="home-ad-wrap"><span className="ad-badge" style={{ position: 'absolute' }}>Sponsored</span>{ad.redirect_url ? <a href={ad.redirect_url} target="_blank" rel="noreferrer">{inner}</a> : inner}</div>
      })}
    </section>
  )
}

function Home() {
  const data = Route.useLoaderData() as any
  const slides = (data.top10.length ? data.top10 : data.popularMovies).slice(0, 3)
  return (
    <div>
      <HeroSlider slides={slides} baseFor={(item) => contentBase(item.type)} genres={data.genres} bunnyLibraryId={data.bunnyLibraryId} />
      <HomeAds ads={data.homeAds} />
      <RecommendationGroups recommendations={data.recommendations} fallback={data.popularMovies} recentFallback={data.latest} />

      {data.top10.length > 0 && <Rail title="Top 10">{data.top10.map((item: any, index: number) => <Top10Card key={item.id} item={item} rank={index + 1} base={contentBase(item.type)} />)}</Rail>}
      {data.latest.length > 0 && <Rail title="New Released Sermons" seeAll="/movies">{data.latest.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.payPerView?.length > 0 && <Rail title="Pay Per View" seeAll="/movies">{data.payPerView.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.popularMovies.length > 0 && <Rail title="Popular Sermons" seeAll="/movies">{data.popularMovies.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.channels.length > 0 && (
        <Rail title="Top Channels" seeAll="/live-tv">
          {data.channels.map((channel: any) => <Link key={channel.id} to={`/channel/${channel.id}` as any} className="c-circle"><img src={img(channel.poster_url)} alt={channel.name} loading="lazy" /><div className="c-name">{channel.name}</div></Link>)}
        </Rail>
      )}
      {data.popularTvShows.length > 0 && <Rail title="Popular Shows" seeAll="/tv-shows">{data.popularTvShows.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.cast?.length > 0 && (
        <Rail title="Popular Personalities">
          {data.cast.map((person: any) => <div key={person.id} className="c-circle"><img src={img(person.file_url)} alt={person.name} loading="lazy" /><div className="c-name">{person.name}</div><div className="c-sub">{person.designation ?? 'Actor'}</div></div>)}
        </Rail>
      )}
      {data.free.length > 0 && <Rail title="Free Sermons" seeAll="/movies">{data.free.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.genres.length > 0 && (
        <Rail title="Genres">
          {data.genres.map((genre: any) => <Link key={genre.id} to="/search" search={{ q: genre.name } as any} className="c-circle"><img src={DEFAULT_GENRE_IMG} alt={genre.name} loading="lazy" /><div className="c-name">{genre.name}</div></Link>)}
        </Rail>
      )}
      {data.mostWatched?.length > 0 && <Rail title="Most Watched Videos" seeAll="/videos">{data.mostWatched.map((item: any) => <PosterCard key={item.id} item={item} base="/video" />)}</Rail>}
    </div>
  )
}

const DEFAULT_GENRE_IMG = '/default-image.jpg'
