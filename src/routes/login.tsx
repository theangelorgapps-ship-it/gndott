import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { login, getSocialConfig, googleSignIn } from '../lib/api'

export const Route = createFileRoute('/login')({
  component: Login,
})

export function AuthShell({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="auth-logo" src="/default-image.jpg" alt="Streamit" />
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  )
}

function GoogleButton({ onError, onNotice }: { onError: (msg: string) => void; onNotice: (msg: string) => void }) {
  const [clientId, setClientId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getSocialConfig().then((cfg: any) => { setClientId(cfg?.googleClientId ?? null); setLoaded(true) })
  }, [])

  useEffect(() => {
    if (!clientId || !btnRef.current) return
    const w = window as any
    const render = () => {
      w.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: any) => {
          const res: any = await googleSignIn({ data: { credential: resp.credential } })
          if (res?.ok) window.location.href = '/manage-profile'
          else onError(res?.error ?? 'Google sign-in failed.')
        },
      })
      w.google?.accounts.id.renderButton(btnRef.current, { theme: 'filled_black', size: 'large', width: 300 })
    }
    if (w.google?.accounts) render()
    else {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = render
      document.head.appendChild(s)
    }
  }, [clientId])

  if (!loaded) return null
  if (!clientId)
    return (
      <button className="btn btn-dark" onClick={() => onNotice('Google sign-in requires a Google Client ID configured by the administrator in Settings → App Config.')}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z"/>
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.2-7-5.1l-3.9 3C4.7 21.3 8.1 24 12 24z"/>
          <path fill="#FBBC05" d="M5 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3l-3.9-3C.4 8.3 0 10.1 0 12s.4 3.7 1.1 5.3z"/>
          <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 2.9.8l2.8-2.7C18 1 15.2 0 12 0 8.1 0 4.7 2.7 3.4 6.7l3.9 3c1-2.9 3.8-5 4.7-5z"/>
        </svg>
        Sign in with Google
      </button>
    )
  return <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center' }} />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await login({ data: { email, password } })
      if (res.ok) {
        window.location.href = '/manage-profile'
      } else {
        setError(res.error ?? 'Login failed.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={<>Welcome Back to Streamit: Your Ultimate Entertainment Hub!</>}>
      <form onSubmit={onSubmit}>
        <div className="field">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field field-pw">
          <input type={showPw ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label="Show password">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <div className="auth-row">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember Me
          </label>
          <Link to="/forgot-password">Forgot Password?</Link>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && <div className="error" style={{ background: 'rgba(33,150,243,0.12)', color: 'var(--info)' }}>{notice}</div>}
        <button className="btn btn-primary auth-btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <div className="auth-alt">
        Don't have an account? <Link to="/register">Sign up</Link>
      </div>
      <div className="auth-or"><span>Or</span></div>
      <div className="auth-socials">
        <GoogleButton onError={(m) => { setNotice(null); setError(m) }} onNotice={(m) => { setError(null); setNotice(m) }} />
        <button className="btn btn-dark" onClick={() => { setNotice(null); setError(null); setNotice('Apple sign-in requires an Apple Services ID configured by the administrator.') }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.7 12.8c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-3.8zM14.9 5.4c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.7-1.3z"/>
          </svg>
          Sign in with Apple
        </button>
        <Link to="/otp-login" className="btn btn-dark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" />
          </svg>
          Login With OTP
        </Link>
      </div>
      <div className="demo-box">
        <h3>Demo Accounts</h3>
        <div className="demo-cred">
          john@gmail.com<br />12345678
        </div>
        <div className="auth-alt" style={{ marginBottom: 0 }}>
          <a href="https://gndottadmin.theangelorgapps.workers.dev" className="admin-link">Admin Panel</a>
        </div>
      </div>
    </AuthShell>
  )
}
