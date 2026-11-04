import { createFileRoute, Link } from '@tanstack/react-router'
import { getAccountData } from '../lib/api'
import { AccountShell, NeedsAuth } from '../components/Account'
import { IconCrown } from '../components/Poster'

export const Route = createFileRoute('/account-setting')({
  loader: async () => await getAccountData(),
  component: AccountSetting,
})

function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return 'Not set'
  const digits = String(mobile).replace(/\D/g, '')
  if (digits.length < 4) return mobile!
  return '*'.repeat(Math.max(digits.length - 3, 0)) + digits.slice(-3)
}

function AccountSetting() {
  const data = Route.useLoaderData() as any
  if (!data) return <NeedsAuth />
  const { user, subscription, devices } = data
  const active = subscription && subscription.status === 'active'
  return (
    <AccountShell title="Account Setting">
      <div className="acct-grid">
        <div className="acct-card">
          <div className="acct-card-head">
            <span className="acct-ico gold"><IconCrown size={26} /></span>
            <div>
              <h2>{active ? subscription.name : 'No Active Plan'}</h2>
              <p>{active ? 'Premium streaming experience' : 'You do not have an active subscription.'}</p>
            </div>
          </div>
          {active && subscription.end_date && (
            <div className="acct-expiry">Expiring on {String(subscription.end_date).slice(0, 10)}</div>
          )}
          <div className="acct-actions">
            <Link to="/subscription-plan" className="btn btn-gold">{active ? 'Upgrade' : 'Subscribe'}</Link>
            {active && <button className="btn btn-primary">Cancel</button>}
          </div>
        </div>
        <div className="acct-card">
          <div className="acct-card-head">
            <span className="acct-ico red">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M12 18h.01" strokeLinecap="round" /></svg>
            </span>
            <div>
              <h2>Contact Info</h2>
              <p>Your registered details</p>
            </div>
          </div>
          <div className="acct-info-box">
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Mobile:</strong> {maskMobile(user.mobile)}</div>
          </div>
          <Link to="/profile-details" className="btn btn-primary" style={{ width: '100%' }}>Update Details</Link>
        </div>
      </div>

      <div className="acct-card" style={{ marginTop: 22 }}>
        <div className="acct-card-head">
          <span className="acct-ico red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="15" height="11" rx="1.5" /><path d="M6 19h7M18 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6" strokeLinecap="round" /></svg>
          </span>
          <div>
            <h2>Active Devices</h2>
            <p>Manage your logged-in devices</p>
          </div>
        </div>
        <div className="device-row">
          <span className="device-badge">Current Device</span>
          <div className="device-info">
            <strong>Web Browser</strong>
            <span>This session</span>
          </div>
        </div>
        {devices.filter((d: any) => d.device_name || d.platform).length > 0 && (
          <>
            <h3 className="acct-sub">Other Devices</h3>
            {devices.filter((d: any) => d.device_name || d.platform).map((d: any) => (
              <div className="device-row" key={d.id}>
                <div className="device-info">
                  <strong>{d.device_name ?? d.platform ?? 'Device'}</strong>
                  <span>{d.last_activity ?? ''}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </AccountShell>
  )
}
