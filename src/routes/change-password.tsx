import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { changePassword } from '../lib/api'
import { AccountShell, NeedsAuth } from '../components/Account'

export const Route = createFileRoute('/change-password')({
  component: ChangePassword,
})

function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next.length < 8) return setMsg({ ok: false, text: 'New password must be at least 8 characters.' })
    if (next !== confirm) return setMsg({ ok: false, text: 'New passwords do not match.' })
    setBusy(true)
    try {
      const res = await changePassword({ data: { current, next } })
      if (res.ok) {
        setMsg({ ok: true, text: 'Password updated successfully.' })
        setCurrent(''); setNext(''); setConfirm('')
      } else {
        setMsg({ ok: false, text: res.error ?? 'Could not change password.' })
      }
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message ?? 'Could not change password.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountShell title="Change Password">
      <div className="acct-card" style={{ maxWidth: 520 }}>
        <form onSubmit={onSubmit}>
          <div className="field"><input type="password" placeholder="Current Password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
          <div className="field"><input type="password" placeholder="New Password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
          <div className="field"><input type="password" placeholder="Confirm New Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
          {msg && <div className="error" style={msg.ok ? { color: 'var(--success)' } : undefined}>{msg.text}</div>}
          <button className="btn btn-primary auth-btn" disabled={busy}>{busy ? 'Saving…' : 'Update Password'}</button>
        </form>
      </div>
    </AccountShell>
  )
}
