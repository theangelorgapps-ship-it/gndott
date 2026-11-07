import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { login, getSocialConfig, googleSignIn } from '../lib/api'

export const Route = createFileRoute('/login')({ component: Login })

export function AuthShell({ children, title, description }: { children: ReactNode; title: ReactNode; description?: string }) {
  return <main className="auth-wrap tv-auth">
    <Link to="/" className="tv-auth-back"><ArrowLeft size={18} aria-hidden="true" /> Browse GoodNews Halobox</Link>
    <div className="auth-card">
      <Link to="/" className="tv-auth-brand" aria-label="GoodNews Halobox home">GoodNews Halobox</Link>
      <h1>{title}</h1>
      {description && <p className="tv-auth-description">{description}</p>}
      {children}
    </div>
  </main>
}

function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const [clientId, setClientId] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const button = useRef<HTMLDivElement>(null)
  const errorCallback = useRef(onError)
  errorCallback.current = onError
  useEffect(() => {
    let cancelled = false
    setUnavailable(false)
    getSocialConfig().then((config) => { if (!cancelled) setClientId(config?.googleClientId ?? null) })
      .catch(() => { if (!cancelled) setUnavailable(true) })
    return () => { cancelled = true }
  }, [attempt])
  useEffect(() => {
    if (!clientId || !button.current) return
    let cancelled = false
    const googleWindow = window as any
    const render = () => {
      if (cancelled || !button.current) return
      googleWindow.google?.accounts.id.initialize({ client_id: clientId, callback: async (response: { credential: string }) => {
        try {
          const result = await googleSignIn({ data: { credential: response.credential } })
          if (result.ok) window.location.assign('/manage-profile')
          else errorCallback.current(result.error ?? 'Google sign-in failed. Please try again.')
        } catch { errorCallback.current('Google sign-in could not finish. Please try again.') }
      } })
      googleWindow.google?.accounts.id.renderButton(button.current, { theme: 'filled_black', size: 'large', width: 300 })
    }
    const failed = () => { if (!cancelled) setUnavailable(true) }
    if (googleWindow.google?.accounts) { render(); return () => { cancelled = true } }
    let script = document.querySelector<HTMLScriptElement>('script[data-gndott-google]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.dataset.gndottGoogle = 'true'
      document.head.appendChild(script)
    }
    script.addEventListener('load', render)
    script.addEventListener('error', failed)
    return () => { cancelled = true; script?.removeEventListener('load', render); script?.removeEventListener('error', failed) }
  }, [clientId, attempt])
  return <>
    {clientId && <div className="tv-google-button" ref={button} hidden={unavailable} />}
    {unavailable && <div className="tv-auth-provider-note"><p>Google sign-in is unavailable.</p><button type="button" className="tv-text-button" onClick={() => {
      document.querySelector('script[data-gndott-google]')?.remove()
      setUnavailable(false)
      setAttempt((value) => value + 1)
    }}>Try again</button></div>}
  </>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try {
      const result = await login({ data: { email: email.trim(), password } })
      if (result.ok) window.location.assign('/manage-profile')
      else { setError(result.error ?? 'Sign-in failed. Please try again.'); setBusy(false) }
    } catch { setError('Could not sign in. Check your connection and try again.'); setBusy(false) }
  }

  return <AuthShell title="Welcome back." description="Sign in, choose your profile, and pick up where you left off.">
    <form onSubmit={submit} aria-busy={busy}>
      <div className="field"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} required autoFocus /></div>
      <div className="field"><label htmlFor="login-password">Password</label><div className="field-pw">
        <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} required />
        <button type="button" className="pw-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
      </div></div>
      <div className="auth-row"><Link to="/forgot-password">Forgot password?</Link></div>
      {error && <p className="tv-flow-message" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary auth-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="auth-alt">New to GoodNews Halobox? <Link to="/register">Create an account</Link></p>
    <div className="auth-or"><span>Other ways to sign in</span></div>
    <div className="tv-auth-alternatives"><GoogleButton onError={setError} /><Link to="/otp-login" className="btn btn-dark">Sign in with a code</Link></div>
  </AuthShell>
}
