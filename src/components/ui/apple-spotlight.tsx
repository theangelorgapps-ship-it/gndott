import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bookmark,
  BookOpen,
  ChevronRight,
  Clapperboard,
  LoaderCircle,
  MonitorPlay,
  Radio,
  Search,
  Video,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { searchContent } from '@/lib/api'

interface Shortcut {
  label: string
  link: string
  icon: LucideIcon
}

type ResultKind = 'sermon' | 'show' | 'teaching' | 'video' | 'channel'
type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

interface SearchResult {
  kind: ResultKind
  label: string
  description: string
  link: string
}

const SITE_SHORTCUTS: Shortcut[] = [
  { label: 'Sermons', icon: Clapperboard, link: '/movies' },
  { label: 'Teachings', icon: BookOpen, link: '/teachings' },
  { label: 'Shows', icon: MonitorPlay, link: '/tv-shows' },
  { label: 'Videos', icon: Video, link: '/videos' },
  { label: 'Live TV', icon: Radio, link: '/live-tv' },
  { label: 'Watchlist', icon: Bookmark, link: '/watchlist' },
]

const RESULT_ICONS: Record<ResultKind, LucideIcon> = {
  sermon: Clapperboard,
  show: MonitorPlay,
  teaching: BookOpen,
  video: Video,
  channel: Radio,
}

const withYear = (label: string, releaseDate?: unknown) =>
  `${label}${releaseDate ? ` · ${String(releaseDate).slice(0, 4)}` : ''}`

const mapSearchResults = (response: any): SearchResult[] => [
  ...(response.movies ?? []).slice(0, 4).map((movie: any) => ({
    kind: 'sermon' as const,
    label: movie.name,
    description: withYear('Sermon', movie.release_date),
    link: `/movie/${movie.id}`,
  })),
  ...(response.tvshows ?? []).slice(0, 4).map((show: any) => ({
    kind: 'show' as const,
    label: show.name,
    description: withYear('Show', show.release_date),
    link: `/tv-show/${show.id}`,
  })),
  ...(response.teachings ?? []).slice(0, 4).map((teaching: any) => ({
    kind: 'teaching' as const,
    label: teaching.name,
    description: withYear('Teaching', teaching.release_date),
    link: `/teaching/${teaching.id}`,
  })),
  ...(response.videos ?? []).slice(0, 4).map((video: any) => ({
    kind: 'video' as const,
    label: video.name,
    description: withYear('Video', video.release_date),
    link: `/video/${video.id}`,
  })),
  ...(response.channels ?? []).slice(0, 2).map((channel: any) => ({
    kind: 'channel' as const,
    label: channel.name,
    description: 'Live TV channel',
    link: `/channel/${channel.id}`,
  })),
]

interface AppleSpotlightProps {
  shortcuts?: Shortcut[]
  isOpen?: boolean
  handleClose?: () => void
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

const AppleSpotlight = ({
  shortcuts = SITE_SHORTCUTS,
  isOpen = true,
  handleClose = () => {},
}: AppleSpotlightProps) => {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const instanceId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(handleClose)
  closeRef.current = handleClose

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [activeIndex, setActiveIndex] = useState(-1)

  const titleId = `${instanceId}-title`
  const descriptionId = `${instanceId}-description`
  const resultsId = `${instanceId}-results`
  const activeResult = activeIndex >= 0 ? results[activeIndex] : undefined

  const go = (link: string) => {
    closeRef.current()
    navigate({ to: link as any })
  }

  // Opening always starts a fresh search. Closing releases the page and restores trigger focus.
  useEffect(() => {
    setQuery('')
    setResults([])
    setStatus('idle')
    setActiveIndex(-1)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        event.preventDefault()
        inputRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const focused = document.activeElement
      if (event.shiftKey && (focused === first || !panelRef.current.contains(focused))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [isOpen])

  // Live catalogue search with stale-response and post-close protection.
  useEffect(() => {
    const searchTerm = query.trim()
    if (!isOpen || !searchTerm) {
      setResults([])
      setStatus('idle')
      setActiveIndex(-1)
      return
    }

    let cancelled = false
    setResults([])
    setStatus('loading')
    setActiveIndex(-1)

    const timer = window.setTimeout(async () => {
      try {
        const response = await searchContent({ data: searchTerm })
        if (cancelled) return
        const mapped = mapSearchResults(response)
        setResults(mapped)
        setStatus('ready')
        setActiveIndex(mapped.length > 0 ? 0 : -1)
      } catch {
        if (cancelled) return
        setResults([])
        setStatus('error')
        setActiveIndex(-1)
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isOpen, query])

  useEffect(() => {
    if (!isOpen || !activeResult) return
    document
      .getElementById(`${instanceId}-result-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, activeResult, instanceId, isOpen])

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (status !== 'ready' || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current < 0 ? 0 : (current + 1) % results.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current < 0 ? results.length - 1 : (current - 1 + results.length) % results.length))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(results.length - 1)
    } else if (event.key === 'Enter' && activeResult) {
      event.preventDefault()
      go(activeResult.link)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="spotlight-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeRef.current()
          }}
        >
          <motion.div
            ref={panelRef}
            id="catalogue-search-dialog"
            className="spotlight-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
          >
            <div className="spotlight-header">
              <div className="spotlight-heading">
                <h2 id={titleId}>Search the catalogue</h2>
                <p id={descriptionId}>
                  Find Sermons, Shows, Teachings and Videos, or browse Live TV and your Watchlist.
                </p>
              </div>
              <button
                type="button"
                className="spotlight-close"
                aria-label="Close catalogue search"
                onClick={() => closeRef.current()}
              >
                <X size={18} aria-hidden="true" />
                <span>Close</span>
              </button>
            </div>

            <div className="spotlight-search-wrap">
              <Search className="spotlight-search-icon" size={21} aria-hidden="true" />
              <input
                ref={inputRef}
                className="spotlight-search-input"
                type="search"
                role="combobox"
                aria-label="Search Sermons, Shows, Teachings and Videos"
                aria-autocomplete="list"
                aria-expanded={status === 'ready' && results.length > 0}
                aria-controls={resultsId}
                aria-activedescendant={activeResult ? `${instanceId}-result-${activeIndex}` : undefined}
                aria-keyshortcuts="ArrowDown ArrowUp Home End Enter"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search Sermons, Shows, Teachings and Videos…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>

            <div className="spotlight-content">
              <section className="spotlight-categories" aria-labelledby={`${instanceId}-categories`}>
                <h3 id={`${instanceId}-categories`}>Browse by category</h3>
                <div className="spotlight-shortcuts">
                  {shortcuts.map((shortcut) => {
                    const ShortcutIcon = shortcut.icon
                    return (
                      <button
                        key={shortcut.link}
                        type="button"
                        className="spotlight-shortcut"
                        onClick={() => go(shortcut.link)}
                      >
                        <ShortcutIcon size={20} strokeWidth={1.8} aria-hidden="true" />
                        <span>{shortcut.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {status === 'loading' && (
                <div className="spotlight-state" role="status">
                  <LoaderCircle className="spotlight-loading-icon" size={20} aria-hidden="true" />
                  <span>Searching Sermons, Shows, Teachings and Videos…</span>
                </div>
              )}

              {status === 'error' && (
                <div className="spotlight-state" role="status">
                  Search is unavailable right now. Please try again in a moment.
                </div>
              )}

              {status === 'ready' && results.length === 0 && (
                <div className="spotlight-state" role="status">
                  No catalogue titles match “{query.trim()}”. Try another title or choose a category above.
                </div>
              )}

              {status === 'ready' && results.length > 0 && (
                <div className="spotlight-results">
                  <p className="spotlight-result-count" role="status">
                    {results.length} catalogue {results.length === 1 ? 'result' : 'results'}
                  </p>
                  <div id={resultsId} role="listbox" aria-label="Catalogue search results">
                    {results.map((result, index) => {
                      const ResultIcon = RESULT_ICONS[result.kind]
                      const isActive = activeIndex === index
                      return (
                        <button
                          id={`${instanceId}-result-${index}`}
                          key={`${result.kind}-${result.link}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          tabIndex={-1}
                          className="spotlight-result"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => go(result.link)}
                        >
                          <span className="spotlight-result-icon">
                            <ResultIcon size={20} strokeWidth={1.8} aria-hidden="true" />
                          </span>
                          <span className="spotlight-result-copy">
                            <span className="spotlight-result-title">{result.label}</span>
                            <span className="spotlight-result-description">{result.description}</span>
                          </span>
                          <ChevronRight className="spotlight-result-arrow" size={18} aria-hidden="true" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="spotlight-footer" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
              <span><kbd>Home</kbd><kbd>End</kbd> Jump</span>
              <span><kbd>Enter</kbd> Open</span>
              <span><kbd>Esc</kbd> Close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { AppleSpotlight }
