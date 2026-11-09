import { contentPath } from '@/lib/contentRoutes'
import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { contentBase, img } from './Poster'

export function ResumeCard({ item, history = false }: { item: any; history?: boolean }) {
  const remaining = Math.max(1, Math.ceil((item.duration - item.position) / 60))
  const completed = item.completed ?? item.position / item.duration >= .9
  const date = item.watched_at ? new Date(item.watched_at) : null
  const timestamp = date && Number.isFinite(date.getTime()) ? date : null
  return <Link to={contentPath(item,contentBase(item.type)) as any} hash={item.episode_id ? `watch-episode-${item.episode_id}` : 'watch'} className="resume-card" aria-label={`${history && completed ? 'Watch again' : 'Continue'} ${item.name}${item.episode_name ? `: ${item.episode_name}` : ''}${completed ? '' : `, ${remaining} minutes remaining`}`}>
    <div className="resume-art"><img src={img(item.thumbnail_url || item.poster_url)} alt="" width={480} height={270} loading="lazy" /><span className="resume-play"><Play size={22} fill="currentColor" aria-hidden="true" /></span><span className="resume-progress"><span style={{ width: `${item.duration > 0 ? Math.max(0, Math.min(100, item.position / item.duration * 100)) : 0}%` }} /></span></div>
    <strong>{item.name}</strong><span>{item.episode_name && `${item.episode_name} · `}{history && completed ? 'Completed' : `${remaining} min left`}</span>{history && timestamp && <time dateTime={timestamp.toISOString()}>Watched {timestamp.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}
  </Link>
}
