import { useEffect } from 'react'
import Lenis from 'lenis'

const REDUCED = '(prefers-reduced-motion: reduce)'

/**
 * Premium motion wiring for the whole app:
 * - Lenis smooth scrolling (lerp-based, skipped when reduced motion is on)
 * - `.scrolled` class on the sticky header once the page leaves the top
 * - IntersectionObserver-driven `.reveal -> .in` entrances with a light stagger
 */
export function MotionRoot() {
  useEffect(() => {
    if (window.matchMedia(REDUCED).matches) return

    const lenis = new Lenis({
      lerp: 0.11,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      anchors: true,
    })
    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const header = document.querySelector('.site-header')
    const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 24)
    lenis.on('scroll', onScroll)
    onScroll()

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.01 },
    )
    const tagSections = () => {
      // tag once for styling…
      document
        .querySelectorAll<HTMLElement>('.section:not(.reveal), .page-head:not(.reveal)')
        .forEach((el) => el.classList.add('reveal'))
      // …but (re)observe every unrevealed section on each pass: survives
      // StrictMode double-mount where the first observer gets disconnected
      document.querySelectorAll<HTMLElement>('.reveal:not(.in)').forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.5) {
          el.classList.add('in')
        } else {
          io.observe(el) // no-op when already observed by this observer
        }
      })
    }
    tagSections()
    const mo = new MutationObserver(tagSections)
    mo.observe(document.body, { childList: true, subtree: true })

    // expose for programmatic scrolls (route changes, anchors, tests)
    ;(window as any).__lenis = lenis

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      io.disconnect()
      mo.disconnect()
      delete (window as any).__lenis
    }
  }, [])
  return null
}
