import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getProfiles, addProfile, updateProfile, deleteProfile } from '../lib/api'
import { img } from '../components/Poster'

export const Route = createFileRoute('/manage-profile')({
  loader: async () => await getProfiles(),
  component: ManageProfile,
})

function ProfileForm({
  initial,
  onClose,
}: {
  initial?: { id: number; name: string; is_child_profile: number }
  onClose: (saved: boolean) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [isChild, setIsChild] = useState(!!initial?.is_child_profile)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="profile-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setMsg(null)
        const res: any = initial
          ? await updateProfile({ data: { id: initial.id, name, isChild } })
          : await addProfile({ data: { name, isChild } })
        setBusy(false)
        if (res?.ok) onClose(true)
        else setMsg(res?.error ?? 'Could not save profile.')
      }}
    >
      <h3>{initial ? 'Edit Profile' : 'Add Profile'}</h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Profile name"
        maxLength={40}
        required
        autoFocus
      />
      <label className="profile-child-toggle">
        <input type="checkbox" checked={isChild} onChange={(e) => setIsChild(e.target.checked)} />
        Child profile
      </label>
      {msg && <p className="form-msg">{msg}</p>}
      <div className="profile-form-actions">
        <button type="button" className="btn btn-dark" onClick={() => onClose(false)}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function ManageProfile() {
  const profiles = (Route.useLoaderData() as any) ?? []
  const router = useRouter()
  const [manage, setManage] = useState(false)
  const [editing, setEditing] = useState<{ id: number; name: string; is_child_profile: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const closeForm = (saved: boolean) => {
    setEditing(null); setAdding(false)
    if (saved) router.invalidate()
  }

  return (
    <div className="profile-gate">
      <h1>Who's Watching ?</h1>
      <div className="profile-gate-grid">
        {profiles.map((p: any) => (
          <div key={p.id} className="profile-gate-item-wrap">
            {manage ? (
              <button className="profile-gate-item" onClick={() => setEditing(p)}>
                <img src={img(p.avatar)} alt={p.name} />
                <span>{p.name}</span>
                {!!p.is_child_profile && <em className="profile-kid">KIDS</em>}
              </button>
            ) : (
              <Link to="/" className="profile-gate-item">
                <img src={img(p.avatar)} alt={p.name} />
                <span>{p.name}</span>
                {!!p.is_child_profile && <em className="profile-kid">KIDS</em>}
              </Link>
            )}
            {manage && profiles.length > 1 && (
              <button
                className="profile-delete"
                aria-label={`Delete profile ${p.name}`}
                onClick={async () => {
                  if (!confirm(`Delete profile "${p.name}"?`)) return
                  const res: any = await deleteProfile({ data: { id: p.id } })
                  if (res?.ok) router.invalidate()
                  else setMsg(res?.error ?? 'Could not delete profile.')
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {profiles.length === 0 && (
          <Link to="/login" className="profile-gate-item">
            <img src="/default-image.jpg" alt="Sign in" />
            <span>Sign in</span>
          </Link>
        )}
        {manage && profiles.length < 5 && (
          <button className="profile-gate-item profile-add" onClick={() => setAdding(true)}>
            <span className="profile-add-plus">+</span>
            <span>Add Profile</span>
          </button>
        )}
      </div>
      {msg && <p className="form-msg">{msg}</p>}
      {profiles.length > 0 && (
        <button className="btn btn-dark profile-gate-btn" onClick={() => setManage((m) => !m)}>
          {manage ? 'Done' : 'Manage Profiles'}
        </button>
      )}
      {(adding || editing) && (
        <div className="profile-modal" onClick={(e) => { if (e.target === e.currentTarget) closeForm(false) }}>
          <ProfileForm initial={editing ?? undefined} onClose={closeForm} />
        </div>
      )}
    </div>
  )
}
