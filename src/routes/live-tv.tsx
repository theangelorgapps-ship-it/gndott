import { createFileRoute } from '@tanstack/react-router'
import { getLiveTvHome } from '../lib/api'
import { HeroSlider, LiveChannelCard, Rail } from '../components/Poster'

export const Route = createFileRoute('/live-tv')({
  loader: async () => await getLiveTvHome(),
  component: LiveTv,
})

function LiveTv() {
  const { categories, channels, featured } = Route.useLoaderData() as any
  return (
    <div>
      <HeroSlider slides={featured} baseFor={() => '/channel'} live />
      {categories.map((cat: any) => {
        const list = channels.filter((c: any) => c.category_id === cat.id)
        if (!list.length) return null
        return (
          <Rail key={cat.id} title={cat.name} seeAll="/live-tv" wide>
            {list.map((c: any) => <LiveChannelCard key={c.id} channel={c} />)}
          </Rail>
        )
      })}
      {channels.filter((c: any) => !c.category_id).length > 0 && (
        <Rail title="More Channels" wide>
          {channels.filter((c: any) => !c.category_id).map((c: any) => <LiveChannelCard key={c.id} channel={c} />)}
        </Rail>
      )}
      {channels.length === 0 && <div className="empty">No live channels available yet.</div>}
    </div>
  )
}
