import { createFileRoute, Link } from '@tanstack/react-router'
import { getProfiles } from '../lib/api'
import { img } from '../components/Poster'

export const Route = createFileRoute('/manage-profile')({
  loader: async () => await getProfiles(),
  component: ManageProfile,
})

function ManageProfile() {
  const profiles = Route.useLoaderData() as any
  return (
    <div className="profile-gate">
      <h1>Who's Watching ?</h1>
      <div className="profile-gate-grid">
        {(profiles ?? []).map((p: any) => (
          <Link key={p.id} to="/" className="profile-gate-item">
            <img src={img(p.avatar)} alt={p.name} />
            <span>{p.name}</span>
          </Link>
        ))}
        {(!profiles || profiles.length === 0) && (
          <Link to="/login" className="profile-gate-item">
            <img src="/default-image.jpg" alt="Sign in" />
            <span>Sign in</span>
          </Link>
        )}
      </div>
      <Link to="/account-setting" className="btn btn-dark profile-gate-btn">Manage Profile</Link>
    </div>
  )
}
