import { useState } from 'react'
import { contentIdFromPath } from '@/lib/contentRoutes'
import { createFileRoute } from '@tanstack/react-router'
import { getLiveChannel } from '../lib/liveTv'
import { LiveChannelCard, Rail, img, IconPlay } from '../components/Poster'
import { PlaybackDialog } from '../components/TitleDetail'
import { LiveDiscussion } from '../components/LiveDiscussion'

export const Route = createFileRoute('/channel/$id')({
  loader: async ({ params }) => getLiveChannel({ data: contentIdFromPath(params.id) }),
  component: ChannelDetail,
  errorComponent: ({ error, reset }) => <section className="section live-access"><h1>Live TV</h1><p>{error instanceof Error ? error.message : 'Unable to load Live TV.'}</p><a className="btn btn-primary" href="/login">Sign in</a> <a href="/subscription-plan">View plans</a> <a href="/live-tv">All channels</a><button onClick={reset}>Try again</button></section>,
})
function ChannelDetail() {
  const { channel, related, streamUrl, viewerId, isAdmin, unavailable } = Route.useLoaderData()
  const [watching, setWatching] = useState(false)
  return <div className="live-channel">
    <section className="live-channel-hero" aria-labelledby="live-channel-title">
      {channel.poster_url && <img className="live-channel-artwork" src={img(channel.poster_url)} alt="" fetchPriority="high" />}
      <div className="live-channel-shade" aria-hidden="true" />
      <div className="detail-inner">
        <div className="chips"><span className="live-badge">LIVE TV</span><span className="chip">{channel.access === 'free' ? 'Free' : 'Premium'}</span></div>
        <h1 id="live-channel-title" className="hero-title">{channel.name}</h1>
        {channel.description && <p className="hero-desc">{String(channel.description).replace(/<[^>]*>/g, '')}</p>}
        <div className="hero-actions"><button className="btn btn-primary" disabled={!streamUrl} onClick={() => setWatching(true)}><IconPlay /> Watch live</button>{isAdmin && <a className="btn btn-ghost" href="/admin/live-tv">Manage Live TV</a>}</div>
        {unavailable && <p className="live-channel-status" role="status">{unavailable}</p>}
      </div>
    </section>
    {!watching && <section className="section live-channel-discussion"><LiveDiscussion key={channel.id} channelId={channel.id} /></section>}
    {watching && streamUrl && <PlaybackDialog onClose={() => setWatching(false)} playback={{ contentId: channel.id, contentType: 'video', title: channel.name, poster: channel.poster_url, description: channel.description, directVideoUrl: streamUrl, viewerId, live: true, liveDiscussion: <LiveDiscussion key={channel.id} channelId={channel.id} /> }} />}
    {related.length > 0 && <Rail title="Suggested Channels" wide>{related.map(c => <LiveChannelCard key={c.id} channel={c} />)}</Rail>}
  </div>
}
