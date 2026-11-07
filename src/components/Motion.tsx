import { useEffect } from 'react'

/** Keep wheel, trackpad, touch and keyboard on one native scroll surface.
 * Scripted momentum must not compete with rails or modal scroll restoration. */
export function MotionRoot() {
  useEffect(() => {
    const onScroll = () => document.querySelector('.site-header')?.classList.toggle('scrolled', window.scrollY > 16)
    document.querySelectorAll('.reveal').forEach(element => element.classList.add('in'))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return null
}
