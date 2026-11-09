import {createFileRoute,Link} from '@tanstack/react-router'
import {useState} from 'react'
import {AuthShell} from './login'
import {requestOtp,verifyOtp} from '../lib/api'
export const Route=createFileRoute('/otp-login')({component:OtpLogin})
function OtpLogin(){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('')
  try{const result=sent?await verifyOtp({data:{contact:email,code}}):await requestOtp({data:{contact:email}})
   if(!result.ok)setError(result.error)
   else if(sent)window.location.assign('/manage-profile')
   else setSent(true)
  }catch{setError('Could not sign in. Please try again.')}
  finally{setBusy(false)}
 }
 return <AuthShell title={sent?'Check your inbox.':'Sign in with a code.'} description="Use the email from your existing Halobox account. Your profiles and subscriptions stay connected.">
  <form onSubmit={submit} aria-busy={busy}>
   <div className="field"><label htmlFor="otp-email">Email address</label><input id="otp-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy||sent} required maxLength={254}/></div>
   {sent&&<div className="field"><label htmlFor="otp-code">6-digit sign-in code</label><input id="otp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required autoFocus disabled={busy}/></div>}
   {error&&<p className="tv-flow-message" role="alert">{error}</p>}
   <button className="btn btn-primary auth-btn" disabled={busy}>{busy?'Please wait…':sent?'Sign in':'Send sign-in code'}</button>
  </form>
  {sent&&<button type="button" className="btn btn-ghost" onClick={()=>{setSent(false);setCode('')}} disabled={busy}>Use another email or request a new code</button>}
  <p className="auth-alt"><Link to="/login">Sign in with a password</Link></p>
 </AuthShell>
}
