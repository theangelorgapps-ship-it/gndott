import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const ADMIN_URL = 'https://gndottadmin.theangelorgapps.workers.dev'

const LINKS = [
  { to: '/account-setting', label: 'Account Settings', icon: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z' },
  { to: '/watchlist', label: 'My Watchlist', icon: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z' },
  { to: '/pay-per-view-history', label: 'Rent Videos', icon: 'M4 5h16v11H4zM2 19h20v2H2z' },
  { to: '/payment-history', label: 'Payment History', icon: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1 4v2h6v-2z' },
  { to: '/profile-details', label: 'Profile Details', icon: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z' },
  { to: '/change-password', label: 'Change Password', icon: 'M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2zm-8-2a3 3 0 0 1 6 0v2H9V7z' },
]

export function AccountShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="account-shell">
      <aside className="account-side">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to as any} className={pathname.startsWith(l.to) ? 'active' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={l.icon} /></svg>
            {l.label}
          </Link>
        ))}
        <a href={ADMIN_URL} target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7zm-2 19a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1h-4z" /></svg>
          Admin Panel
        </a>
      </aside>
      <div className="account-main">
        <h1 className="account-title">{title}</h1>
        {children}
      </div>
    </div>
  )
}

export function NeedsAuth() {
  return (
    <div className="empty">
      <h2>Sign in required</h2>
      <p>Sign in to access your account area.</p>
      <Link to="/login" className="btn btn-primary">Sign in</Link>
    </div>
  )
}
