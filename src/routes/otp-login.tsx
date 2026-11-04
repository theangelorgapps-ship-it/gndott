import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from './login'

export const Route = createFileRoute('/otp-login')({
  component: OtpLogin,
})

function OtpLogin() {
  const [mobile, setMobile] = useState('')
  const [sent, setSent] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <AuthShell title="Login With OTP">
      {sent ? (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, textAlign: 'center' }}>
            SMS delivery is not configured on this deployment, so no OTP was sent.
            Use email sign-in instead.
          </p>
          <div className="auth-alt"><Link to="/login">Back to Sign In</Link></div>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, textAlign: 'center', marginTop: 0 }}>
            Enter your registered mobile number to receive a one-time passcode.
          </p>
          <form onSubmit={onSubmit}>
            <div className="field field-phone">
              <span className="phone-prefix">+91</span>
              <input placeholder="e.g. 9723454740" value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" required autoFocus />
            </div>
            <button className="btn btn-primary auth-btn">Send OTP</button>
          </form>
          <div className="auth-alt">
            <Link to="/login">Sign in with email</Link>
          </div>
        </>
      )}
    </AuthShell>
  )
}
