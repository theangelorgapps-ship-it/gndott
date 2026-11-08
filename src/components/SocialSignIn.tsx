import {useEffect,useState} from 'react'
import {getSocialConfig} from '../lib/api'

// Familiar provider marks, kept as small vector UI icons instead of third-party image requests.
function GoogleMark(){return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-1 6.6-2.4l-3.2-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9Z"/></svg>}
function AppleMark(){return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16.5 1.5c.2 1.7-.5 3.1-1.4 4.1-.9 1-2.3 1.7-3.7 1.6-.2-1.6.5-3.1 1.5-4.1.9-1 2.4-1.7 3.6-1.6Zm4.4 16c-.6 1.5-.9 2.2-1.7 3.4-1.1 1.6-2.6 3.5-4.4 3-1.5-.4-2.4-.4-3.9 0-1.7.4-3.3-1.3-4.4-2.9C3.4 16.4 3 10.5 5 8.3c1.4-1.5 3.2-1.8 4.8-1.4 1.6.4 2.3.4 3.8 0 1.7-.5 3.9-.2 5.3 1.5-4.6 2.6-3.8 8.1 2 9.1Z" transform="translate(0 -1) scale(.94)"/></svg>}
export function SocialSignIn(){
 const [config,setConfig]=useState<{googleEnabled:boolean;appleEnabled:boolean}|null>(null)
 const [failed,setFailed]=useState(false)
 useEffect(()=>{let active=true;getSocialConfig().then(value=>{if(active)setConfig(value)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[])
 return <div className="social-sign-in">
  {(['google','apple'] as const).map(provider=>{
   const enabled=!!config?.[`${provider}Enabled`]
   const label=`Continue with ${provider==='google'?'Google':'Apple'}`
   const contents=<>{provider==='google'?<GoogleMark/>:<AppleMark/>}<span>{label}</span>{config&&!enabled&&<small>Unavailable</small>}</>
   return enabled?<a key={provider} className="social-sign-in-button" href={`/auth/${provider}`}>{contents}</a>:<button key={provider} className="social-sign-in-button" type="button" disabled aria-label={`${label}, ${config?'currently unavailable':'loading'}`}>{contents}</button>
  })}
  {failed&&<p className="tv-auth-provider-note" role="status">Other sign-in options could not load. You can still use your email and password.</p>}
 </div>
}
