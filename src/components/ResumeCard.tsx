import { contentPath } from '@/lib/contentRoutes'
import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { contentBase, img } from './Poster'

export function ResumeCard({ item }: { item: any }) {
  const remaining = Math.max(1, Math.ceil((item.duration - item.position) / 60))
  return <Link to={contentPath(item,contentBase(item.type)) as any} hash={item.episode_id ? `watch-episode-${item.episode_id}` : 'watch'} className="resume-card" aria-label={`Continue ${item.name}${item.episode_name ? `: ${item.episode_name}` : ''}, ${remaining} minutes remaining`}>
    <div className="resume-art"><img src={img(item.thumbnail_url || item.poster_url)} alt="" width={480} height={270} loading="lazy" /><span className="resume-play"><Play size={22} fill="currentColor" aria-hidden="true" /></span><span className="resume-progress"><span style={{ width: `${Math.min(100, item.position / item.duration * 100)}%` }} /></span></div>
    <strong>{item.name}</strong><span>{item.episode_name || 'Continue watching'} · {remaining} min left</span>
  </Link>
}
