import { createFileRoute, Link } from '@tanstack/react-router'
import { getContinueWatching } from '../lib/api'
import { ResumeCard } from '../components/ResumeCard'
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
      {data.needsProfile ? <div className="empty"><p>Choose a profile to see where you left off.</p><Link to="/manage-profile" className="btn btn-primary">Choose profile</Link></div> : data.items.length === 0 ? (
        <div className="empty">You have not started watching anything yet.</div>
      ) : (
        <div className="resume-grid">
          {data.items.map((m: any) => (
            <ResumeCard key={m.cw_id} item={m} />
          ))}
        </div>
      )}
    </AccountShell>
  )
}
