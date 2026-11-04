import { createFileRoute } from '@tanstack/react-router'
import { getContinueWatching } from '../lib/api'
import { PosterCard } from '../components/Poster'
import { AccountShell, NeedsAuth } from '../components/Account'

export const Route = createFileRoute('/continue-watching')({
  loader: async () => await getContinueWatching(),
  component: ContinueWatching,
})

function ContinueWatching() {
  const data = Route.useLoaderData() as any
  if (data.needsAuth) return <NeedsAuth />
  return (
    <AccountShell title="Continue Watching">
      {data.items.length === 0 ? (
        <div className="empty">You have not started watching anything yet.</div>
      ) : (
        <div className="grid" style={{ padding: 0 }}>
          {data.items.map((m: any) => (
            <PosterCard key={m.cw_id} item={m} base={m.type === 'tvshow' ? '/tv-show' : '/movie'} />
          ))}
        </div>
      )}
    </AccountShell>
  )
}
