import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from './login'
import { authClient } from '../lib/auth-client'
export const Route = createFileRoute('/forgot-password')({ component: ForgotPassword })
function ForgotPassword() {
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [password, setPassword] = useState('')
  const [sent, setSent] = useState(false), [done, setDone] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = sent
        ? await authClient.emailOtp.resetPassword({ email: email.trim().toLowerCase(), otp: code, password })
        : await authClient.emailOtp.requestPasswordReset({ email: email.trim().toLowerCase() })
      if (result.error) setError(result.error.status === 503 ? 'Email recovery is temporarily unavailable. Please contact support.' : sent ? 'The code is invalid or expired, or the password does not meet the requirements.' : 'Unable to request a code. Please try again later.')
      else if (sent) { setDone(true); setPassword(''); setCode('') }
      else setSent(true)
    } catch { setError('Unable to reset your password. Please try again later.') }
    finally { setBusy(false) }
  }
  return <AuthShell title={done ? 'Your password is updated.' : sent ? 'Check your inbox.' : 'Reset your password.'} description={done ? 'Sign in again with your new password. Your profiles and subscriptions are unchanged.' : 'Use the email connected to your Halobox account.'}>
    {done ? <Link className="btn btn-primary auth-btn" to="/login">Back to sign in</Link> : <form onSubmit={submit} aria-busy={busy}>
      <div className="field"><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy || sent} required /></div>
      {sent && <><p className="tv-flow-message" role="status">If an eligible account matches this email, a reset code has been sent. It expires in 5 minutes.</p><div className="field"><label htmlFor="reset-code">6-digit reset code</label><input id="reset-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required disabled={busy} /></div><div className="field"><label htmlFor="reset-password">New password</label><input id="reset-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /><small>Use 8–72 characters. Some characters use more than one byte.</small></div></>}
      {error && <p className="tv-flow-message" role="alert">{error}</p>}
      <button className="btn btn-primary auth-btn" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Update password' : 'Send reset code'}</button>
      {sent && <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => { setSent(false); setCode(''); setPassword(''); setError('') }}>Use another email or request a new code</button>}
    </form>}
    {!done && <p className="auth-alt"><Link to="/login">Back to sign in</Link> · <a href="mailto:Hello@halobox.tv?subject=Halobox%20account%20access">Contact support</a></p>}
  </AuthShell>
}
