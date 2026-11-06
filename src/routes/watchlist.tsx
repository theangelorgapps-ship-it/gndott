import { createFileRoute } from '@tanstack/react-router'
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
      {data.items.length === 0 ? (
        <div className="empty">Nothing saved yet. Browse movies and tap the bookmark to add them here.</div>
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
