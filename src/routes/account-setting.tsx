import { SubscriptionControls } from '../components/SubscriptionControls'
import { ProfilePhoto } from '../components/ProfilePhoto'
import { AccountLibrary } from '../components/AccountLibrary'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Bookmark, Clock3, Crown, Mail, Monitor } from 'lucide-react'
import { getAccountData } from '../lib/api'
import { AccountShell, FlowLoadError, NeedsAuth } from '../components/Account'

export const Route = createFileRoute('/account-setting')({
  loader: () => getAccountData(),
  errorComponent: ({ reset }) => <FlowLoadError title="Your account could not load." reset={reset} />,
  pendingComponent: () => <div className="tv-flow-empty" role="status">Loading your account…</div>,
  component: AccountSetting,
})

function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return 'Not added'
  const digits = String(mobile).replace(/\D/g, '')
  return digits.length >= 4 ? '•'.repeat(digits.length - 3) + digits.slice(-3) : 'Not added'
}

function AccountSetting() {
  const data = Route.useLoaderData()
  if (!data?.user) return <NeedsAuth />
  const { user, subscription, devices } = data
  const active = subscription?.status === 'active'
  const recordedDevices = devices.filter((device) => device.device_name || device.platform)
  return <AccountShell title="Your account.">
    <ProfilePhoto/>
    <AccountLibrary />
    <div className="tv-library-shortcuts">
      <Link to="/continue-watching"><Clock3 size={23} aria-hidden="true" /><span><strong>Continue watching</strong><small>Pick up where you left off</small></span><ArrowRight size={20} aria-hidden="true" /></Link>
      <Link to="/watchlist"><Bookmark size={23} aria-hidden="true" /><span><strong>Your watchlist</strong><small>Titles saved for later</small></span><ArrowRight size={20} aria-hidden="true" /></Link>
    </div>
    <div className="acct-grid">
      <section className="acct-card" aria-labelledby="account-plan"><div className="acct-card-head"><span className="acct-ico"><Crown size={25} aria-hidden="true" /></span><div><h2 id="account-plan">{active ? subscription.name : 'Find your next great watch.'}</h2><p>{active ? 'Your current subscription' : 'Explore the available streaming plans.'}</p></div></div>
        {active && subscription.end_date && <p className="acct-expiry">Access until {String(subscription.end_date).slice(0, 10)}</p>}
        <Link to="/subscription-plan" className="btn btn-primary">{active ? 'View plans' : 'Explore plans'}</Link>
        <SubscriptionControls/>
        <Link to="/payment-history" className="tv-account-inline">View payment history<ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section className="acct-card" aria-labelledby="account-contact"><div className="acct-card-head"><span className="acct-ico"><Mail size={24} aria-hidden="true" /></span><div><h2 id="account-contact">Personal details</h2><p>Your registered contact information</p></div></div>
        <dl className="tv-account-details"><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Mobile number</dt><dd>{maskMobile(user.mobile)}</dd></div></dl>
        <Link to="/profile-details" className="btn btn-dark">Update details</Link>
      </section>
    </div>
    <section className="acct-card tv-device-card" aria-labelledby="account-devices"><div className="acct-card-head"><span className="acct-ico"><Monitor size={24} aria-hidden="true" /></span><div><h2 id="account-devices">Devices</h2><p>This browser and the devices recorded on your account.</p></div></div>
      <div className="device-row"><Monitor size={22} aria-hidden="true" /><div className="device-info"><strong>This web browser</strong><span>Your current session</span></div><span className="device-badge">Current</span></div>
      {recordedDevices.length > 0 && <><h3 className="acct-sub">Recorded devices</h3>{recordedDevices.map((device) => <div className="device-row" key={device.id}><div className="device-info"><strong>{device.device_name ?? device.platform ?? 'Device'}</strong>{device.last_activity && <span>Last activity: {device.last_activity}</span>}</div></div>)}</>}
    </section>
  </AccountShell>
}
