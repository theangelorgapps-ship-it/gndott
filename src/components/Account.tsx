import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Bookmark, Clock3, CreditCard, ExternalLink, KeyRound, LogOut, MonitorPlay, Settings2, UserRound, UsersRound } from 'lucide-react'
import { getSessionUser, logout } from '../lib/api'
import { getViewer } from '../lib/viewer'
import type { ActiveViewer } from '../lib/viewer.server'

export const ADMIN_URL = 'https://fort.halobox.tv'
const LINKS = [
  { to: '/account-setting', label: 'Account settings', Icon: Settings2 },
  { to: '/continue-watching', label: 'Your viewing', Icon: Clock3 },
  { to: '/watchlist', label: 'Saved list', Icon: Bookmark },
  { to: '/pay-per-view-history', label: 'My rentals', Icon: MonitorPlay },
  { to: '/payment-history', label: 'Payment history', Icon: CreditCard },
  { to: '/profile-details', label: 'Personal details', Icon: UserRound },
  { to: '/change-password', label: 'Change password', Icon: KeyRound },
] as const

export function AccountShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [viewer, setViewer] = useState<ActiveViewer | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [user, activeViewer] = await Promise.all([getSessionUser(), getViewer()])
      setViewer(activeViewer); setIsAdmin(user?.user_type === 'admin')
    } catch { setError('Your profile could not load. Please try again.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); window.addEventListener('halobox-profile-updated',load); return()=>window.removeEventListener('halobox-profile-updated',load) }, [load])
  async function signOut() {
    if (signingOut) return
    setSigningOut(true); setError(null)
    try {
      const result = await logout()
      if (result.ok) window.location.assign('/login')
      else { setError('Could not sign out. Please try again.'); setSigningOut(false) }
    } catch { setError('Could not sign out. Check your connection and try again.'); setSigningOut(false) }
  }
  return <div className="account-shell tv-account">
    <aside className="account-side" aria-label="Your account">
      <div className="tv-account-profile">
        <span className="tv-account-avatar" aria-hidden="true">{viewer?.avatar ? <img src={viewer.avatar} alt=""/> : viewer?.profileName?.slice(0, 1).toUpperCase() || <UserRound size={24} />}</span>
        <div><small>Watching as</small><strong>{loading ? 'Loading profile…' : viewer?.profileName ?? 'Choose a profile'}</strong></div>
      </div>
      <Link to="/manage-profile" className="tv-account-switch"><UsersRound size={17} aria-hidden="true" />{viewer?.profileId ? 'Switch profile' : 'Choose your profile'}</Link>
      <nav aria-label="Account destinations">{LINKS.map(({ to, label, Icon }) => <Link key={to} to={to} className={pathname.startsWith(to) ? 'active' : ''} aria-current={pathname.startsWith(to) ? 'page' : undefined}><Icon size={18} aria-hidden="true" />{label}</Link>)}</nav>
      {isAdmin && <a href={ADMIN_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} aria-hidden="true" />Admin panel</a>}
      <button type="button" className="tv-account-signout" disabled={signingOut} onClick={signOut}><LogOut size={18} aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}</button>
      {error && <div className="tv-account-error"><p role="alert">{error}</p><button type="button" className="tv-text-button" disabled={loading || signingOut} onClick={load}>Reload profile</button></div>}
    </aside>
    <main className="account-main"><p className="tv-account-eyebrow">GoodNews Halobox · Your space</p><h1 className="account-title">{title}</h1>{children}</main>
  </div>
}

export function NeedsAuth() {
  return <main className="tv-flow-empty"><UserRound size={36} aria-hidden="true" /><h1>Your space on GoodNews Halobox.</h1><p>Sign in to choose a profile, find your saved titles and continue watching.</p><div className="tv-flow-actions"><Link to="/login" className="btn btn-primary">Sign in</Link><Link to="/" className="btn btn-dark">Browse titles</Link></div></main>
}

export function FlowLoadError({ title, reset }: { title: string; reset: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return <main className="tv-flow-empty"><h1>{title}</h1><p role={failed ? 'alert' : undefined}>{failed ? 'Still unable to connect. Please try again in a moment.' : 'Check your connection, then try again.'}</p><div className="tv-flow-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
    setBusy(true); setFailed(false)
    try { await router.invalidate(); reset() } catch { setFailed(true) } finally { setBusy(false) }
  }}>{busy ? 'Trying again…' : 'Try again'}</button><Link to="/" className="btn btn-dark">Browse titles</Link></div></main>
}
