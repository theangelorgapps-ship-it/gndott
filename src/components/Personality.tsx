import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ExternalLink, Share2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { getPersonalityDetail } from '../lib/people'
import { contentPath } from '../lib/contentRoutes'
import { personalityBirthDate, personalityRole, safePersonalityLink, type Personality as Person, type PersonalityDetail } from '../lib/personalityData'
import { img } from '../lib/imageUrls'
import { PosterCard, contentBase, plainText } from './Poster'
import '../people-locations.css'

export function PersonalityCard({ person }: { person: Person }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="c-circle personality-card" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`About ${person.name}`}>
      {person.file_url ? <img src={img(person.file_url)} alt="" loading="lazy" /> : <span className="personality-avatar" aria-hidden="true">{person.name.slice(0, 1)}</span>}
      <span className="c-name">{person.name}</span>
      {personalityRole(person) && <span className="c-sub">{personalityRole(person)}</span>}
    </button>
    {open && <PersonalityModal person={person} onClose={() => setOpen(false)} />}
  </>
}

export function PersonalityModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [detail, setDetail] = useState<PersonalityDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading')
  const [attempt, setAttempt] = useState(0)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    let active = true
    setState('loading')
    getPersonalityDetail({ data: person.id }).then(result => {
      if (!active) return
      setDetail(result)
      setState(result ? 'ready' : 'missing')
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [person.id, attempt])

  return createPortal(
    <dialog ref={dialog} className="personality-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); close.current() }}
      onClose={event => {
        // An effect cleanup can queue this event before React reopens the dialog.
        if (!event.currentTarget.open) close.current()
      }}
      onClick={event => { if (event.target === event.currentTarget) close.current() }}>
      <div className="personality-dialog-content">
        <button type="button" autoFocus className="personality-close" aria-label="Close personality" onClick={() => close.current()}><ChevronLeft size={28} /></button>
        <PersonalityProfile detail={detail ?? { person, works: [], links: [] }} titleId={titleId} onNavigate={() => close.current()} />
        {state === 'loading' && <p className="personality-load" role="status">Loading biography…</p>}
        {state === 'missing' && <p className="personality-load" role="status">This personality is no longer available.</p>}
        {state === 'error' && <div className="personality-load" role="alert"><p>Could not load this biography.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
      </div>
    </dialog>, document.body,
  )
}

export function PersonalityProfile({ detail, titleId, onNavigate }: { detail: PersonalityDetail; titleId?: string; onNavigate?: () => void }) {
  const { person, works, links } = detail
  const [shareMessage, setShareMessage] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const birthDate = personalityBirthDate(person.dob)
  const biography = plainText(person.bio)

  async function share() {
    const url = new URL(contentPath(person, '/cast'), window.location.origin).href
    try {
      if (navigator.share) await navigator.share({ title: person.name, url })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setShareMessage('Link copied.') }
      else { setShareUrl(url); setShareMessage('Copy the link below.') }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') { setShareUrl(url); setShareMessage('Copy the link below.') }
    }
  }

  return <article className="personality-profile">
    <header className="personality-portrait">
      {person.file_url ? <img src={img(person.file_url)} alt={person.name} /> : <div className="personality-portrait-placeholder" aria-hidden="true">{person.name.slice(0, 1)}</div>}
      <div className="personality-portrait-shade" />
      <div className="personality-heading">
        <h1 id={titleId}>{person.name}</h1>
        {personalityRole(person) && <p>{personalityRole(person)}</p>}
        <div className="personality-actions">
          {links.map(link => {
            const url = safePersonalityLink(link)
            const label = ({ facebook: 'Facebook', instagram: 'Instagram', x: 'X', website: 'Website' } as Record<string, string>)[link.provider]
            return url && label ? <a key={link.provider} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on ${label}`}>{label}<ExternalLink size={14} aria-hidden="true" /></a> : null
          })}
          <button type="button" onClick={share}><Share2 size={17} aria-hidden="true" /> Share</button>
        </div>
        {shareMessage && <p className="personality-share-status" role="status">{shareMessage}</p>}
        {shareUrl && <label className="personality-share-url">Share link<input readOnly value={shareUrl} onFocus={event => event.target.select()} /></label>}
      </div>
    </header>
    <div className="personality-information">
      {biography && <p className="personality-biography">{biography}</p>}
      {(birthDate || person.place_of_birth) && <dl className="personality-facts">
        {birthDate && <div><dt>Born</dt><dd>{birthDate}</dd></div>}
        {person.place_of_birth && <div><dt>Birthplace</dt><dd>{person.place_of_birth}</dd></div>}
      </dl>}
      {works.length > 0 && <section className="personality-works" aria-label={`Featuring ${person.name}`}>
        <h2>Featuring {person.name}</h2>
        <div className="personality-work-grid" onClick={event => { if ((event.target as HTMLElement).closest('a')) onNavigate?.() }}>
          {works.map(work => <PosterCard key={`${work.type}:${work.id}`} item={work} base={contentBase(work.type)} />)}
        </div>
      </section>}
    </div>
  </article>
}

export function PersonalityPage({ detail }: { detail: PersonalityDetail }) {
  return <div className="personality-page"><Link className="personality-page-back" to="/cast"><ChevronLeft size={20} /> Personalities</Link><PersonalityProfile detail={detail} /></div>
}
