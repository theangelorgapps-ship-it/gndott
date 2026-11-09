import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bookmark, Search } from 'lucide-react'
import { getViewingHistory, type ViewingQuery } from '../lib/playback'
import { LibraryTabs } from './LibraryTabs'
import { ResumeCard } from './ResumeCard'
import '../viewing-library.css'

const categories = [{ value: 'all', label: 'All' }, { value: 'movie', label: 'Sermons' }, { value: 'teaching', label: 'Teachings' }, { value: 'tvshow', label: 'Shows' }, { value: 'video', label: 'Videos' }] as const
const tabs = [{ value: 'continue', label: 'Continue Watching' }, { value: 'history', label: 'Watch History' }] as const
export function ViewingLibrary() {
  const [tab, setTab] = useState<'continue' | 'history'>('continue')
  const [category, setCategory] = useState<ViewingQuery['category']>('all')
  const [search, setSearch] = useState(''), [query, setQuery] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof getViewingHistory>> | null>(null)
  const [loading, setLoading] = useState(true), [more, setMore] = useState(false), [error, setError] = useState('')
  const request = useRef(0)
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 180); return () => window.clearTimeout(timer) }, [search])
  const load = useCallback(async (offset = 0) => {
    const current = ++request.current
    setError('')
    if (offset) setMore(true)
    else { setLoading(true); setMore(false); setResult(null) }
    try {
      const data = await getViewingHistory({ data: { tab, category, search: query, offset } })
      if (request.current === current) setResult(previous => offset && previous ? { ...data, items: [...previous.items, ...data.items.filter(item => !previous.items.some(old => old.cw_id === item.cw_id))] } : data)
    } catch { if (request.current === current) setError('Your viewing could not load. Please try again.') }
    finally { if (request.current === current) { setLoading(false); setMore(false) } }
  }, [tab, category, query])
  useEffect(() => {
    void load()
    const refresh = () => { void load() }
    window.addEventListener('halobox-profile-updated', refresh)
    return () => { request.current++; window.removeEventListener('halobox-profile-updated', refresh) }
  }, [load])
  return <section className="viewing-library" aria-label="Your viewing">
    <div className="viewing-library-heading"><p>Pick up where you left off or revisit something you watched.</p><Link to="/watchlist" className="viewing-saved-link"><Bookmark size={17} aria-hidden="true" />Saved list</Link></div>
    <LibraryTabs label="Viewing activity" tabs={[...tabs]} active={tab} onChange={setTab}>
      <div className="viewing-controls"><div className="viewing-categories" role="group" aria-label="Filter by category">{categories.map(item => <button key={item.value} type="button" aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
        <label className="viewing-search"><Search size={17} aria-hidden="true"/><input type="search" aria-label="Search your viewing" placeholder="Search titles" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} /></label>
      </div>
      {loading ? <p className="viewing-message" role="status">Loading your viewing…</p> : result?.needsAuth ? <div className="viewing-message"><p>Sign in to see your viewing activity.</p><Link to="/login" className="btn btn-primary">Sign in</Link></div> : result?.needsProfile ? <div className="viewing-message"><p>Choose a profile to see your viewing activity.</p><Link to="/manage-profile" className="btn btn-primary">Choose profile</Link></div> : <>
        {!!result?.items.length && <div className="resume-grid">{result.items.map(item => <ResumeCard key={item.cw_id} item={item} history={tab === 'history'} />)}</div>}
        {!error && result?.items.length === 0 && <p className="viewing-message">{query || category !== 'all' ? 'No titles match your search and category.' : tab === 'history' ? 'Your watched titles will appear here when you start watching.' : 'You’re all caught up. Start a title to continue it here.'}</p>}
        {result?.nextOffset != null && !error && <button className="viewing-more" type="button" disabled={more} onClick={() => void load(result.nextOffset!)}>{more ? 'Loading…' : 'Load more'}</button>}
      </>}
      {error && <div className="viewing-message"><p role="alert">{error}</p><button type="button" className="viewing-more" onClick={() => void load()}>Try again</button></div>}
    </LibraryTabs>
  </section>
}
