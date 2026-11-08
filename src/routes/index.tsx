import { PersonalityCard } from '../components/Personality'
import { LiquidGlassLayers } from '@/components/ui/liquid-glass'
import { contentPath } from '@/lib/contentRoutes'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getDashboard, getHomeAds, getContinueWatching } from '../lib/api'
import { ResumeCard } from '../components/ResumeCard'
import { PosterCard, Top10Card, Rail, HeroSlider, RecommendationGroups, contentBase, img } from '../components/Poster'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [dash, homeAds, continuing] = await Promise.all([getDashboard(), getHomeAds(), getContinueWatching()])
    return { ...dash, homeAds, continuing }
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
          ? <video className="home-ad" src={src} controls muted playsInline preload="none" />
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
    <div className="tv-home">
      <HeroSlider slides={slides} baseFor={(item) => contentBase(item.type)} bunnyLibraryId={data.bunnyLibraryId} />
      {data.continuing?.items?.length > 0 && <Rail title="Continue Watching" seeAll="/continue-watching">{data.continuing.items.map((item: any) => <ResumeCard key={item.cw_id} item={item} />)}</Rail>}
      {data.top10.length > 0 && <Rail title="Top 10">{data.top10.map((item: any, index: number) => <Top10Card key={item.id} item={item} rank={index + 1} base={contentBase(item.type)} />)}</Rail>}
      <RecommendationGroups recommendations={data.recommendations} fallback={data.popularMovies} recentFallback={data.latest} />
      <HomeAds ads={data.homeAds} />
      {data.latest.length > 0 && <Rail title="New Released Sermons" seeAll="/sermons">{data.latest.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.payPerView?.length > 0 && <Rail title="Pay Per View" seeAll="/sermons">{data.payPerView.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.popularMovies.length > 0 && <Rail title="Popular Sermons" seeAll="/sermons">{data.popularMovies.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.channels.length > 0 && (
        <Rail title="Top Channels" seeAll="/live-tv">
          {data.channels.map((channel: any) => <Link key={channel.id} to={contentPath(channel,'/channel') as any} className="c-circle"><img src={img(channel.poster_url)} alt={channel.name} loading="lazy" /><div className="c-name">{channel.name}</div></Link>)}
        </Rail>
      )}
      {data.popularTvShows.length > 0 && <Rail title="Popular Shows" seeAll="/shows">{data.popularTvShows.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.cast?.length > 0 && (
        <Rail title="Popular Personalities">
          {data.cast.map((person: any) => <PersonalityCard key={person.id} person={person} />)}
        </Rail>
      )}
      {data.free.length > 0 && <Rail title="Free Sermons" seeAll="/sermons">{data.free.map((item: any) => <PosterCard key={item.id} item={item} base={contentBase(item.type)} />)}</Rail>}
      {data.genres.length > 0 && (
        <Rail title="Categories">
          {data.genres.map((genre: any) => <Link key={genre.id} to="/search" search={{ q: '', type: 'all', genre: Number(genre.id) }} className="home-genre-link liquid-glass"><LiquidGlassLayers /><span>{genre.name}</span></Link>)}
        </Rail>
      )}
      {data.mostWatched?.length > 0 && <Rail title="Most Watched Videos" seeAll="/videos">{data.mostWatched.map((item: any) => <PosterCard key={item.id} item={item} base="/video" />)}</Rail>}
    </div>
  )
}
