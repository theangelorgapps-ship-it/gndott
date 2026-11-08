import {createFileRoute,Link} from '@tanstack/react-router'
import {useState,type ReactNode} from 'react'
import {ArrowLeft,Eye,EyeOff} from 'lucide-react'
import {login} from '../lib/api'
import {SocialSignIn} from '../components/SocialSignIn'
import {SignIn1} from '../components/ui/modern-stunning-sign-in'
import '../sign-in.css'

const notices:Record<string,string>={
 'link-required':'An account already uses this email. Enter its password once to connect your sign-in securely. Your profiles and subscriptions will stay on that account.',
 'not-configured':'This sign-in option is not available yet. Please use your email and password.',
 failed:'Sign-in could not finish. Please try again or use your email and password.',
 cancelled:'Sign-in was cancelled. You can try again whenever you are ready.',
}
export const Route=createFileRoute('/login')({validateSearch:(search:Record<string,unknown>):{auth?:string}=>({auth:typeof search.auth==='string'&&search.auth in notices?search.auth:undefined}),component:Login})
export function AuthShell({children,title,description}:{children:ReactNode;title:ReactNode;description?:string}){
 return <main className="auth-wrap tv-auth halobox-auth">
  <Link to="/" className="tv-auth-back"><ArrowLeft size={18} aria-hidden="true"/> Browse GoodNews Halobox</Link>
  <SignIn1 title={title} description={description}>{children}</SignIn1>
 </main>
}
function Login(){
 const {auth}=Route.useSearch()
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false)
 const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false)
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError(null)
  try{const result=await login({data:{email:email.trim(),password}});if(result.ok)window.location.assign('/manage-profile');else{setError(result.error);setBusy(false)}}
  catch{setError('Could not sign in. Check your connection and try again.');setBusy(false)}
 }
 return <AuthShell title="Welcome back." description="Your place of hope. Sign in to continue.">
  {auth&&<p className="tv-flow-message" role="status">{notices[auth]}</p>}
  <form onSubmit={submit} aria-busy={busy}>
   <div className="field"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={event=>setEmail(event.target.value)} disabled={busy} required maxLength={254}/></div>
   <div className="field"><label htmlFor="login-password">Password</label><div className="field-pw"><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} disabled={busy} required maxLength={1024}/><button type="button" className="pw-eye" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></div>
   <div className="auth-row"><Link to="/forgot-password">Forgot password?</Link></div>
   {error&&<p className="tv-flow-message" role="alert">{error}</p>}
   <button type="submit" className="btn btn-primary auth-btn" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
  </form>
  <div className="auth-or"><span>Or continue with</span></div><SocialSignIn/>
  <p className="auth-alt">New to GoodNews Halobox? <Link to="/register">Create an account</Link></p>
 </AuthShell>
}
