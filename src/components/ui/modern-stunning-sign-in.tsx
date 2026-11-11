'use client'

// Adapted from the supplied HextaUI modern-stunning-sign-in reference.
// The visual shell is reusable; all actions are supplied by the real Halobox auth routes.
import type {ReactNode} from 'react'
import {Link} from '@tanstack/react-router'

export function SignIn1({title,description,children}:{title:ReactNode;description?:string;children:ReactNode}) {
 return <div className="auth-card halobox-sign-in">
  <Link to="/" className="tv-auth-brand" aria-label="GoodNews Halobox home">
   <img src="/halo-ring-logo.avif?v=2" alt="" width="56" height="56" />
   <span><small>GoodNews</small><strong>Halobox</strong></span>
  </Link>
  <h1>{title}</h1>
  {description&&<p className="tv-auth-description">{description}</p>}
  {children}
 </div>
}
export default SignIn1
