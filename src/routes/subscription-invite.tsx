import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect,useState } from 'react'
import { acceptMemberInvite } from '../lib/membership'
import { getSessionUser } from '../lib/api'
import '../subscription-sharing.css'
export const Route=createFileRoute('/subscription-invite')({loader:()=>getSessionUser(),component:Invitation})
function Invitation(){
 const user=Route.useLoaderData(),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[accepted,setAccepted]=useState(false)
 useEffect(()=>{
  const incoming=window.location.hash.slice(1)
  if(/^[-\w]{43}$/.test(incoming)){sessionStorage.setItem('halobox-subscription-invite',incoming);history.replaceState(null,'',window.location.pathname)}
  setToken(sessionStorage.getItem('halobox-subscription-invite')||'')
 },[])
 return <main className="subscription-invite"><h1>Join a shared subscription</h1><p>Use your own email login. Your profiles, watchlist and history stay private, and the subscription owner manages payment.</p>
 {!token&&<p role="alert">Open the complete invitation link shared by the owner.</p>}
 {token&&!user&&<><p>Sign in with the exact email address the owner invited, then return here to accept.</p><Link to="/login" search={{returnTo:'/subscription-invite'}} className="btn btn-primary">Sign in</Link><Link to="/register" className="btn btn-dark">Create an account</Link></>}
 {token&&user&&!accepted&&<><p>Signed in as {user.email}. The link can only be accepted by the invited email address.</p><button className="btn btn-primary" disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{await acceptMemberInvite({data:{token}});sessionStorage.removeItem('halobox-subscription-invite');setAccepted(true);setMessage('You have joined the shared subscription.')}catch(error){setMessage(error instanceof Error?error.message:'Unable to accept this invitation.')}finally{setBusy(false)}}}>{busy?'Joining…':'Accept invitation'}</button></>}
 {message&&<p role="status">{message}</p>}{accepted&&<Link to="/account-setting" className="btn btn-primary">View your account</Link>}
 </main>
}
