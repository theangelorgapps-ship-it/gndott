import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from './login'
import { requestOtp, verifyOtp } from '../lib/api'

export const Route = createFileRoute('/otp-login')({
  component: OtpLogin,
})

function OtpLogin() {
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const res: any = await requestOtp({ data: { contact } })
    setBusy(false)
    if (res?.ok) { setSent(true); setDevCode(res.devCode ?? null) }
    else setMsg(res?.error ?? 'Could not send OTP.')
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const res: any = await verifyOtp({ data: { contact, code } })
    setBusy(false)
    if (res?.ok) { router.navigate({ to: '/' }); router.invalidate() }
    else setMsg(res?.error ?? 'Invalid code.')
  }

  return (
    <AuthShell title="Login With OTP">
      {sent ? (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, textAlign: 'center' }}>
            Enter the 6-digit code we sent to <strong>{contact}</strong>.
          </p>
          {devCode && (
            <p className="form-msg" style={{ textAlign: 'center' }}>
              Demo code (no SMS provider configured): <strong style={{ letterSpacing: 3 }}>{devCode}</strong>
            </p>
          )}
          <form onSubmit={onVerify}>
            <div className="field">
              <input
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                required
                autoFocus
                style={{ textAlign: 'center', letterSpacing: 6, fontSize: 20 }}
              />
            </div>
            {msg && <p className="form-msg">{msg}</p>}
            <button className="btn btn-primary auth-btn" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Verify & Sign In'}
            </button>
          </form>
          <div className="auth-alt">
            <button className="linklike" onClick={() => { setSent(false); setCode(''); setMsg(null) }}>Use a different number/email</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, textAlign: 'center', marginTop: 0 }}>
            Enter your registered email or mobile number to receive a one-time passcode.
          </p>
          <form onSubmit={onSend}>
            <div className="field">
              <input placeholder="Email or mobile number" value={contact} onChange={(e) => setContact(e.target.value)} required autoFocus />
            </div>
            {msg && <p className="form-msg">{msg}</p>}
            <button className="btn btn-primary auth-btn" disabled={busy || !contact.trim()}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
          <div className="auth-alt">
            <Link to="/login">Sign in with email</Link>
          </div>
        </>
      )}
    </AuthShell>
  )
}
