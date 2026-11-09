// HaloBox preloader — liquid-glass logo reveal.
// The halo ring mark condenses out of a glass droplet (21st.dev Glass Reveal,
// WebGL2, self-contained), holds, then the overlay fades. Session-guarded so it
// only plays once per visit and never slows repeat navigation.

import { useCallback, useEffect, useRef, useState } from 'react'
import { GlassIconReveal } from './liquid-glass-logo-reveal'

const INTRO_SEEN_KEY = 'hb-intro-seen-v1'
const BG = '#050505'

// The reveal runs present (2.4s in the dark look) + settle tail (~1.1s) once
// the logo texture is ready; the buffer covers image load + SDF build.
const REVEAL_MS = 4200
const REVEAL_MS_REDUCED = 900
const FADE_MS = 600

function GlassLogoIntro({ onComplete }: { onComplete?: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const doneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    const holdMs = reduceMotion ? REVEAL_MS_REDUCED : REVEAL_MS

    const fadeTimer = window.setTimeout(() => {
      // Reveal the page underneath as the overlay fades out.
      document.documentElement.classList.remove('hb-intro')
      setLeaving(true)
    }, holdMs)
    const doneTimer = window.setTimeout(() => {
      if (doneRef.current) return
      doneRef.current = true
      onCompleteRef.current?.()
    }, holdMs + FADE_MS + 50)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  return (
    <section
      aria-hidden="true"
      className="hb-preloader fixed inset-0 z-[999] h-screen w-full transition-opacity ease-out"
      style={{
        backgroundColor: BG,
        opacity: leaving ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* The reveal replays on click by default; the preloader owns the screen,
          so its clicks stay inert. */}
      <div className="pointer-events-none absolute inset-0">
        <GlassIconReveal
          logo="/halo-ring-mark.png"
          label="HaloBox"
          look="dark"
          background={BG}
          logoColor="#ffffff"
          originalColors
          loop={false}
          tileSize={320}
          className="h-full w-full"
        />
      </div>

      <p className="absolute bottom-[6vh] left-1/2 w-[94vw] -translate-x-1/2 text-center text-[10px] font-medium uppercase tracking-[0.28em] whitespace-nowrap text-white/55 sm:text-[11px]">
        Sermons, Shows &amp; Teaching Series — with Prophet Uebert Angel
      </p>
    </section>
  )
}

/** Session-guarded preloader: plays once per browser session, then never again. */
export function SitePreloader() {
  const [show, setShow] = useState(false)

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // ignore
    }
    setShow(false)
  }, [])

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(INTRO_SEEN_KEY)) setShow(true)
    } catch {
      // storage unavailable — skip the intro rather than risk replay loops
    }
  }, [])

  // Safety net: if the lazy chunk or the WebGL engine ever fails, the
  // first-visit mask must still lift so the page is never stuck hidden.
  useEffect(() => {
    if (!show) return
    const bail = window.setTimeout(() => {
      document.documentElement.classList.remove('hb-intro')
      handleComplete()
    }, 10000)
    return () => window.clearTimeout(bail)
  }, [show, handleComplete])

  if (!show) return null
  return <GlassLogoIntro onComplete={handleComplete} />
}
