import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { addProfile, updateProfile, deleteProfile } from '../lib/api'
import { getViewerState, selectViewerProfile } from '../lib/viewer'
import type { ViewerProfile } from '../lib/viewer.server'
import { img } from '../components/Poster'
import { FlowLoadError, NeedsAuth } from '../components/Account'

export const Route = createFileRoute('/manage-profile')({
  loader: () => getViewerState(),
  errorComponent: ({ reset }) => <FlowLoadError title="Your profiles could not load." reset={reset} />,
  pendingComponent: () => <div className="tv-flow-empty" role="status">Loading your profiles…</div>,
  component: ManageProfile,
})

function ProfileAvatar({ profile }: { profile: ViewerProfile }) {
  const [failed, setFailed] = useState(false)
  return profile.avatar && !failed
    ? <img src={img(profile.avatar)} alt="" onError={() => setFailed(true)} />
    : <span className="tv-profile-initial" aria-hidden="true">{profile.name.trim().slice(0, 1).toUpperCase() || 'P'}</span>
}

function ProfileForm({ initial, onClose }: { initial?: ViewerProfile; onClose: (saved: boolean) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [isChild, setIsChild] = useState(!!initial?.is_child_profile)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  return <dialog ref={dialog} className="tv-profile-dialog" aria-labelledby="profile-form-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(false) }} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(false) }}>
    <form className="profile-form" aria-busy={busy} onSubmit={async (event) => {
      event.preventDefault()
      if (busy || !name.trim()) return
      setBusy(true); setError(null)
      try {
        const result = initial
          ? await updateProfile({ data: { id: initial.id, name: name.trim(), isChild } })
          : await addProfile({ data: { name: name.trim(), isChild } })
        if (result.ok) onClose(true)
        else setError(result.error ?? 'Could not save this profile. Please try again.')
      } catch { setError('Could not save this profile. Check your connection and try again.') }
      finally { setBusy(false) }
    }}>
      <h2 id="profile-form-title">{initial ? 'Edit profile' : 'Add a profile'}</h2>
      <label htmlFor="profile-name">Profile name</label>
      <input id="profile-name" type="text" autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} disabled={busy} required autoFocus />
      <label className="profile-child-toggle"><input type="checkbox" checked={isChild} onChange={(event) => setIsChild(event.target.checked)} disabled={busy} />Child profile label</label>
      <p className="tv-form-hint">This label does not restrict the available catalogue.</p>
      {error && <p className="tv-flow-message" role="alert">{error}</p>}
      <div className="profile-form-actions"><button type="button" className="btn btn-dark" disabled={busy} onClick={() => onClose(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  </dialog>
}

function ManageProfile() {
  const state = Route.useLoaderData()
  const router = useRouter()
  const [manage, setManage] = useState(false)
  const [editing, setEditing] = useState<ViewerProfile | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  if (!state) return <NeedsAuth />
  const { profiles, viewer } = state
  const busy = busyId !== null || refreshing
  async function refresh() {
    setRefreshing(true)
    try { await router.invalidate(); setError(null) }
    catch { setError('Could not refresh your profiles. Please try again.') }
    finally { setRefreshing(false) }
  }
  async function choose(profile: ViewerProfile) {
    if (busy) return
    setBusyId(profile.id); setError(null)
    try {
      const result = await selectViewerProfile({ data: { profileId: profile.id } })
      if (result.ok) window.location.assign('/')
      else { setError(result.error); setBusyId(null) }
    } catch { setError('Could not switch profiles. Check your connection and try again.'); setBusyId(null) }
  }
  return <main className="profile-gate tv-profile-gate">
    <Link to="/" className="tv-auth-back"><ArrowLeft size={18} aria-hidden="true" /> Browse GoodNews Halobox</Link>
    <header><p className="tv-auth-brand">GoodNews Halobox</p><h1>{manage ? 'Make it yours.' : 'Who’s watching?'}</h1><p className="tv-auth-description">{manage ? 'Create and manage the profiles on your account.' : 'Choose a profile for your recommendations and watch history.'}</p></header>
    <div className="profile-gate-grid">
      {profiles.map((profile) => <div key={profile.id} className="profile-gate-item-wrap">
        <button type="button" className={`profile-gate-item ${viewer.profileId === profile.id ? 'is-current' : ''}`} disabled={busy} onClick={() => manage ? setEditing(profile) : choose(profile)} aria-label={`${manage ? 'Edit' : 'Watch as'} ${profile.name}`}>
          <ProfileAvatar profile={profile} />
          <span>{busyId === profile.id && !manage ? 'Switching…' : profile.name}</span>
          {manage ? <Pencil size={16} aria-hidden="true" /> : viewer.profileId === profile.id && <span className="tv-profile-current"><Check size={13} aria-hidden="true" />Current</span>}
          {!!profile.is_child_profile && <small>Child profile label</small>}
        </button>
        {manage && profiles.length > 1 && <button type="button" className="tv-profile-delete" disabled={busy} aria-label={`Delete profile ${profile.name}`} onClick={async () => {
          if (!window.confirm(`Delete profile “${profile.name}”?`)) return
          setBusyId(profile.id); setError(null)
          try { const result = await deleteProfile({ data: { id: profile.id } }); if (result.ok) await refresh(); else setError(result.error ?? 'Could not delete the profile.') }
          catch { setError('Could not delete this profile. Please try again.') }
          finally { setBusyId(null) }
        }}><Trash2 size={16} aria-hidden="true" /></button>}
      </div>)}
      {(manage || profiles.length === 0) && profiles.length < 5 && <button type="button" className="profile-gate-item profile-add" disabled={busy} onClick={() => setAdding(true)}><span className="profile-add-plus"><Plus size={32} aria-hidden="true" /></span><span>Add profile</span></button>}
    </div>
    {profiles.length === 0 && <p className="tv-auth-description">Create your first profile to start watching.</p>}
    {error && <div className="tv-profile-error"><p className="tv-flow-message" role="alert">{error}</p><button type="button" className="tv-text-button" disabled={busy} onClick={refresh}>Refresh profiles</button><Link to="/login">Sign in again</Link></div>}
    <div className="tv-profile-actions">{profiles.length > 0 && <button type="button" className="btn btn-dark" disabled={busy} onClick={() => setManage(!manage)}>{manage ? 'Done' : 'Manage profiles'}</button>}<Link to="/account-setting" className="tv-text-button">Account settings</Link></div>
    {(adding || editing) && <ProfileForm initial={editing ?? undefined} onClose={(saved) => { setAdding(false); setEditing(null); if (saved) void refresh() }} />}
  </main>
}
