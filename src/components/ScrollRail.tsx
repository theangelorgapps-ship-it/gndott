import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** The glass stays at the viewport edges, not inside the scrolling track. */
export function ScrollRail({ children, label, style }: { children: ReactNode; label: string; style?: CSSProperties }) {
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  useEffect(() => {
    const node = track.current
    if (!node) return
    let frame = 0
    const measure = () => {
      frame = 0
      const start = node.scrollLeft > 3
      const end = node.scrollWidth - node.clientWidth - node.scrollLeft > 3
      setEdges(old => old.start === start && old.end === end ? old : { start, end })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    observer.observe(node)
    Array.from(node.children).forEach(child => observer.observe(child))
    node.addEventListener('scroll', schedule, { passive: true })
    measure()
    return () => { observer.disconnect(); node.removeEventListener('scroll', schedule); cancelAnimationFrame(frame) }
  }, [children])
  return <div className="rail-viewport" data-start={edges.start} data-end={edges.end}>
    <div ref={track} className="rail" tabIndex={0} role="region" aria-label={label} style={style}>{children}</div>
    <span className="rail-glass-edge rail-glass-start" aria-hidden="true" />
    <span className="rail-glass-edge rail-glass-end" aria-hidden="true" />
  </div>
}
