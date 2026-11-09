import { createFileRoute, Link } from '@tanstack/react-router'
import { getWatchlist } from '../lib/api'
import { PosterCard } from '../components/Poster'
import { AccountShell, NeedsAuth } from '../components/Account'

export const Route = createFileRoute('/watchlist')({
  loader: async () => await getWatchlist(),
  component: Watchlist,
})

function Watchlist() {
  const data = Route.useLoaderData() as any
  if (data.needsAuth) return <NeedsAuth />
  return (
    <AccountShell title="My Watchlist">
      {data.needsProfile ? <div className="empty"><p>Choose a profile to see your saved titles.</p><Link to="/manage-profile" className="btn btn-primary">Choose profile</Link></div> : data.items.length === 0 ? (
        <div className="empty">Nothing saved yet. Browse titles and tap the plus button to save them here.</div>
      ) : (
        <div className="grid" style={{ padding: 0 }}>
          {data.items.map((m: any) => (
            <PosterCard key={m.id} item={m} base={m.type === 'teaching' ? '/teaching' : m.type === 'tvshow' ? '/tv-show' : '/movie'} />
          ))}
        </div>
      )}
    </AccountShell>
  )
}
