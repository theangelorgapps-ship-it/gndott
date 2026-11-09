import { useState } from 'react'
import { bunnySeekFrame } from './bunnySeek'

export function SeekPreview({ source, time, duration, percent, label }: { source: string | null; time: number; duration: number; percent: number; label: string }) {
  const frame = bunnySeekFrame(source, time, duration)
  const [loaded, setLoaded] = useState('')
  const [aspect, setAspect] = useState(16 / 9)
  return <div className="tv-seek-preview" style={{ left: `clamp(88px, ${percent}%, calc(100% - 88px))` }} aria-hidden="true">
    {frame && <div className="tv-seek-image" style={{ aspectRatio: aspect, display: loaded === frame.url ? undefined : 'none' }}>
      <img src={frame.url} alt="" style={{ left: `${-frame.column * 100}%`, top: `${-frame.row * 100}%` }}
        onLoad={event => { setAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight); setLoaded(frame.url) }} onError={() => setLoaded('')} />
    </div>}
    <span>{label}</span>
  </div>
}
