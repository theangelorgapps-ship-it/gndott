import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { register } from '../lib/api'
import { AuthShell } from './login'

export const Route = createFileRoute('/register')({
  component: Register,
})

function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await register({ data: { firstName, lastName, email, mobile, password } })
      if (res.ok) {
        window.location.href = '/manage-profile'
      } else {
        setError(res.error ?? 'Registration failed.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Sign up to Begin Your Adventure">
      <form onSubmit={onSubmit}>
        <div className="field"><input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus /></div>
        <div className="field"><input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div className="field"><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field field-phone">
          <span className="phone-prefix">+91</span>
          <input placeholder="e.g. 9723454740" value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" />
        </div>
        <div className="field"><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div className="field"><input type="password" placeholder="Confirm Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary auth-btn" disabled={busy}>
          {busy ? 'Signing up…' : 'Sign up'}
        </button>
      </form>
      <div className="auth-alt">
        Already have an account? <Link to="/login">Sign In</Link>
      </div>
      <p className="auth-terms">
        By signing, you agree to Streamit: Your Ultimate Entertainment Hub{' '}
        <Link to={'/page/terms-conditions' as any}>Terms &amp; Conditions</Link> of all services and{' '}
        <Link to={'/page/privacy-policy' as any}>Privacy Policy</Link> of all services and.
      </p>
    </AuthShell>
  )
}
