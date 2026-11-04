import { createFileRoute } from '@tanstack/react-router'
import { getAccountData } from '../lib/api'
import { AccountShell, NeedsAuth } from '../components/Account'

export const Route = createFileRoute('/profile-details')({
  loader: async () => await getAccountData(),
  component: ProfileDetails,
})

function ProfileDetails() {
  const data = Route.useLoaderData() as any
  if (!data) return <NeedsAuth />
  const { user } = data
  return (
    <AccountShell title="Profile Details">
      <div className="acct-card" style={{ maxWidth: 620 }}>
        <div className="profile-rows">
          <div className="profile-row"><span>First Name</span><strong>{user.first_name ?? '—'}</strong></div>
          <div className="profile-row"><span>Last Name</span><strong>{user.last_name ?? '—'}</strong></div>
          <div className="profile-row"><span>Email</span><strong>{user.email}</strong></div>
          <div className="profile-row"><span>Mobile</span><strong>{user.mobile ?? '—'}</strong></div>
          <div className="profile-row"><span>Account Type</span><strong style={{ textTransform: 'capitalize' }}>{user.user_type}</strong></div>
          <div className="profile-row"><span>Member Since</span><strong>{String(user.created_at ?? '').slice(0, 10)}</strong></div>
        </div>
      </div>
    </AccountShell>
  )
}
