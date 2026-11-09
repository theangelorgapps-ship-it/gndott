import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Mic2, Radio, X } from 'lucide-react'
import './first-visit-welcome.css'

const SEEN_KEY = 'halobox-welcome-v1'
const destinations = [
  { to: '/sermons', label: 'Sermons', description: 'A message for today', Icon: Mic2 },
  { to: '/teachings', label: 'Teachings', description: 'Go deeper in the Word', Icon: BookOpen },
  { to: '/live-tv', label: 'Live TV', description: 'Join us live', Icon: Radio },
]

/** First-visit guidance stays out of returning visitors' way. */
export function FirstVisitWelcome() {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) setOpen(true) } catch { /* Browse normally when storage is unavailable. */ }
  }, [])
  useEffect(() => {
    if (!open || !dialog.current) return
    const node = dialog.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    node.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      node.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])
  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* Storage is optional. */ }
    setOpen(false)
  }
  if (!open) return null
  return <dialog ref={dialog} className="first-visit-welcome" aria-labelledby="welcome-heading" aria-describedby="welcome-description" onCancel={event => { event.preventDefault(); dismiss() }}>
    <button type="button" className="welcome-close" aria-label="Close welcome" onClick={dismiss}><X size={22} /></button>
    <img className="welcome-crest" src="/goodnews-halo-logo.avif" width="72" height="72" alt="" />
    <p className="welcome-brand">HaloBox <span>With Prophet Uebert Angel</span></p>
    <h1 id="welcome-heading">Welcome. Make yourself at home.</h1>
    <p id="welcome-description">Find a message that speaks to you. Explore sermons, grow through teachings, or join us live.</p>
    <nav aria-label="Start exploring">{destinations.map(({ to, label, description, Icon }) => <Link key={to} to={to} onClick={dismiss}><Icon size={22} aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={18} aria-hidden="true" /></Link>)}</nav>
    <button type="button" className="welcome-browse" onClick={dismiss} autoFocus>Start exploring <ArrowRight size={18} aria-hidden="true" /></button>
    <Link className="welcome-sign-in" to="/login" onClick={dismiss}>Already have an account? Sign in</Link>
  </dialog>
}
