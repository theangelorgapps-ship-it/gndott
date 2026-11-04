import { createFileRoute } from '@tanstack/react-router'
import { getChannel } from '../lib/api'
import { LiveChannelCard, Rail, img, IconPlay } from '../components/Poster'

export const Route = createFileRoute('/channel/$id')({
  loader: async ({ params }) => await getChannel({ data: Number(params.id) }),
  component: ChannelDetail,
})

function ChannelDetail() {
  const data = Route.useLoaderData() as any
  if (!data) return <div className="empty">Channel not found.</div>
  const { channel, related } = data
  return (
    <div>
      <section className="detail-hero" style={{ backgroundImage: `url(${img(channel.poster_url)})` }}>
        <div className="detail-inner">
          <div className="chips" style={{ marginBottom: 12 }}>
            <span className="live-badge" style={{ position: 'static' }}>LIVE</span>
            {channel.category && <span className="chip">{channel.category}</span>}
            {channel.access && <span className="chip">{channel.access === 'free' ? 'Free' : 'Premium'}</span>}
          </div>
          <h1 className="hero-title">{channel.name}</h1>
          {channel.description && <p className="hero-desc">{String(channel.description).replace(/<[^>]*>/g, '')}</p>}
          <div className="hero-actions">
            <button className="btn btn-primary"><IconPlay /> Watch live</button>
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <Rail title="Suggested Channels" wide>
          {related.map((c: any) => <LiveChannelCard key={c.id} channel={c} />)}
        </Rail>
      )}
    </div>
  )
}
