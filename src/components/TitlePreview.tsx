import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { youtubeId } from './Detail'

export function TitlePreview({ title, trailerUrl, bunnyLibraryId, bunnyTrailerId }: { title: string; trailerUrl?: string | null; bunnyLibraryId?: string | null; bunnyTrailerId?: string | null }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [eligible, setEligible] = useState(false)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const youtube = youtubeId(trailerUrl)
  const direct = /^https?:\/\/.*\.(mp4|webm|m4v)(?:[?#]|$)/i.test(trailerUrl ?? '') ? trailerUrl : null
  const bunny = bunnyLibraryId && bunnyTrailerId ? `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${bunnyTrailerId}?autoplay=true&muted=true&loop=true&preload=true` : null
  const src = bunny || (youtube ? `https://www.youtube.com/embed/${youtube}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtube}&rel=0` : null)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEligible(desktop.matches && !reduced.matches && !document.hidden)
    const stop = () => setPaused(true)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 })
    if (hostRef.current) observer.observe(hostRef.current)
    desktop.addEventListener('change', update)
    reduced.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('gndott:playback-open', stop)
    update()
    return () => { observer.disconnect(); desktop.removeEventListener('change', update); reduced.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('gndott:playback-open', stop) }
  }, [])
  const playing = eligible && visible && !paused && !failed
  if (!src && !direct) return null
  return (
    <>
    <div ref={hostRef} className="tv-title-preview">
      {playing && (src ? <iframe src={src} title={`Muted trailer preview for ${title}`} allow="autoplay; encrypted-media" tabIndex={-1} aria-hidden="true" /> : <video src={direct!} autoPlay muted playsInline loop onError={() => setFailed(true)} aria-hidden="true" />)}
    </div>
      {eligible && !failed && <button type="button" className="tv-preview-toggle tv-detail-utility" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play trailer preview' : 'Pause trailer preview'}>{paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} />}</button>}
    </>
  )
}
