import { useCallback, useEffect, useRef, useState } from 'react'
import type { GlassIconReveal } from './ui/liquid-glass-logo-reveal'

const SEEN_KEY = 'halobox-intro-v1'

/** One short entrance per browser session. The shader is loaded only when needed. */
export function BrandOpener() {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [Reveal, setReveal] = useState<typeof GlassIconReveal | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const readyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const finishing = useRef(false)
  const reduced = useRef(false)
  const eligible = useRef<boolean | null>(null)
  const finish = useCallback(() => {
    if (finishing.current) return
    finishing.current = true
    setLeaving(true)
    exitTimer.current = setTimeout(() => setOpen(false), reduced.current ? 0 : 320)
  }, [])
  const ready = useCallback(() => {
    if (readyTimer.current || finishing.current) return
    readyTimer.current = setTimeout(finish, reduced.current ? 700 : 3400)
  }, [finish])

  useEffect(() => {
    if (eligible.current === null) {
      const force = new URLSearchParams(location.search).get('intro') === '1'
      try { eligible.current = force || !sessionStorage.getItem(SEEN_KEY); if (eligible.current) sessionStorage.setItem(SEEN_KEY, '1') } catch { eligible.current = true }
    }
    if (!eligible.current) return
    finishing.current = false
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches
    setOpen(true)
    let live = true
    if (reduced.current) ready()
    else void import('./ui/liquid-glass-logo-reveal').then(module => {
      if (live) setReveal(() => module.GlassIconReveal)
    }).catch(() => { if (live) ready() })
    const deadline = setTimeout(finish, 6000)
    return () => { live = false; clearTimeout(deadline); clearTimeout(readyTimer.current); clearTimeout(exitTimer.current); readyTimer.current = undefined; exitTimer.current = undefined }
  }, [finish, ready])

  useEffect(() => {
    if (!open || !dialog.current) return
    const node = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node.showModal()
    return () => { node.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [open])

  if (!open) return null
  return <dialog ref={dialog} className={`brand-opener${leaving ? ' is-leaving' : ''}`} aria-label="Welcome to GoodNews Halobox" onCancel={event => { event.preventDefault(); finish() }}>
    <button className="brand-opener-skip" type="button" onClick={finish} autoFocus>Skip intro</button>
    <div className="brand-opener-center">
      {Reveal ? <Reveal className="brand-opener-reveal" logo="/halo-ring-logo.avif?v=2" label="GoodNews Halobox" look="dark" background="#000000" originalColors iconPlate={false} loop={false} tileSize={300} logoScale={.78} finalScale={1} onReady={ready} /> : <div className="brand-opener-reveal brand-opener-static"><img src="/halo-ring-logo.avif?v=2" alt="" /></div>}
      <p><span>GoodNews</span><strong>Halobox</strong></p>
    </div>
  </dialog>
}
