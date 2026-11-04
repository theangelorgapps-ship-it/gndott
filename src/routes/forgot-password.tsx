import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from './login'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPassword,
})

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // No mail server is configured on this deployment; show the same
    // confirmation UI the Laravel app shows after submitting.
    setSent(true)
  }

  return (
    <AuthShell title="Forgot Password">
      {sent ? (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, textAlign: 'center' }}>
            If an account exists for <strong style={{ color: 'var(--text)' }}>{email}</strong>, a password
            reset link has been sent. Email delivery is not configured on this deployment.
          </p>
          <div className="auth-alt"><Link to="/login">Back to Sign In</Link></div>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, textAlign: 'center', marginTop: 0 }}>
            Enter your registered email address and we'll send you a link to reset your password.
          </p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <button className="btn btn-primary auth-btn">Send Reset Link</button>
          </form>
          <div className="auth-alt">
            Remembered it? <Link to="/login">Sign In</Link>
          </div>
        </>
      )}
    </AuthShell>
  )
}
