import { cn } from '@/lib/utils'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Clapperboard,
  MonitorPlay,
  Radio,
  CalendarClock,
  ChevronRight,
  Search,
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { searchContent } from '@/lib/api'

interface Shortcut {
  label: string
  icon: React.ReactNode
  link: string
}

interface SearchResult {
  icon: React.ReactNode
  label: string
  description: string
  link: string
}

const SVGFilter = () => {
  return (
    <svg width="0" height="0" aria-hidden="true">
      <filter id="blob">
        <feGaussianBlur stdDeviation="10" in="SourceGraphic" />
        <feColorMatrix
          values="
      1 0 0 0 0
      0 1 0 0 0
      0 0 1 0 0
      0 0 0 18 -9
    "
          result="blob"
        />
        <feBlend in="SourceGraphic" in2="blob" />
      </filter>
    </svg>
  )
}

interface ShortcutButtonProps {
  icon: React.ReactNode
  link: string
  label: string
}

const ShortcutButton = ({ icon, link, label }: ShortcutButtonProps) => {
  const navigate = useNavigate()
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => navigate({ to: link as any })}
      onKeyDown={(e) => e.key === 'Enter' && navigate({ to: link as any })}
      className="rounded-full cursor-pointer hover:shadow-lg opacity-40 hover:opacity-100 transition-[opacity,shadow] duration-200"
    >
      <div className="size-16 aspect-square flex items-center justify-center">{icon}</div>
    </div>
  )
}

interface SpotlightPlaceholderProps {
  text: string
  className?: string
}

const SpotlightPlaceholder = ({ text, className }: SpotlightPlaceholderProps) => {
  return (
    <motion.div
      layout
      className={cn('absolute text-white/40 flex items-center pointer-events-none z-10', className)}
    >
      <AnimatePresence mode="popLayout">
        <motion.p
          layoutId={`placeholder-${text}`}
          key={`placeholder-${text}`}
          initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  )
}

interface SpotlightInputProps {
  placeholder: string
  hidePlaceholder: boolean
  value: string
  onChange: (value: string) => void
  placeholderClassName?: string
}

const SpotlightInput = ({
  placeholder,
  hidePlaceholder,
  value,
  onChange,
  placeholderClassName,
}: SpotlightInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex items-center w-full justify-start gap-3 px-6 h-16 text-white">
      <motion.div layoutId="search-icon">
        <Search />
      </motion.div>
      <div className="flex-1 relative text-2xl">
        {!hidePlaceholder && (
          <SpotlightPlaceholder text={placeholder} className={placeholderClassName} />
        )}

        <motion.input
          ref={inputRef}
          layout="position"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none ring-none text-white"
          aria-label="Search titles"
        />
      </div>
    </div>
  )
}

interface SearchResultCardProps extends SearchResult {
  isLast: boolean
  onNavigate: () => void
}

const SearchResultCard = ({ icon, label, description, isLast, onNavigate }: SearchResultCardProps) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate()}
      className="overflow-hidden w-full group/card cursor-pointer"
    >
      <div
        className={cn(
          'flex items-center text-white justify-start hover:bg-white/10 gap-3 py-2 px-3 rounded-xl w-full transition-colors duration-150',
          isLast && 'rounded-b-3xl',
        )}
      >
        <div className="size-8 [&_svg]:stroke-[1.5] [&_svg]:size-6 aspect-square flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex flex-col min-w-0">
          <p className="font-medium truncate">{label}</p>
          <p className="text-xs opacity-50">{description}</p>
        </div>
        <div className="flex-1 flex items-center justify-end opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
          <ChevronRight className="size-6" />
        </div>
      </div>
    </div>
  )
}

interface SearchResultsContainerProps {
  searchResults: SearchResult[]
  onHover: (index: number | null) => void
  onNavigate: (link: string) => void
}

const SearchResultsContainer = ({ searchResults, onHover, onNavigate }: SearchResultsContainerProps) => {
  return (
    <motion.div
      layout
      onMouseLeave={() => onHover(null)}
      className="px-2 border-t border-white/10 flex flex-col max-h-96 overflow-y-auto w-full py-2"
    >
      {searchResults.map((result, index) => (
        <motion.div
          key={`search-result-${result.link}-${index}`}
          onMouseEnter={() => onHover(index)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            delay: index * 0.05,
            duration: 0.2,
            ease: 'easeOut',
          }}
        >
          <SearchResultCard
            icon={result.icon}
            label={result.label}
            description={result.description}
            link={result.link}
            isLast={index === searchResults.length - 1}
            onNavigate={() => onNavigate(result.link)}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}

const SITE_SHORTCUTS: Shortcut[] = [
  { label: 'Movies', icon: <Clapperboard />, link: '/movies' },
  { label: 'TV Shows', icon: <MonitorPlay />, link: '/tv-shows' },
  { label: 'Live TV', icon: <Radio />, link: '/live-tv' },
  { label: 'Coming Soon', icon: <CalendarClock />, link: '/coming-soon' },
]

interface AppleSpotlightProps {
  shortcuts?: Shortcut[]
  isOpen?: boolean
  handleClose?: () => void
}

const AppleSpotlight = ({
  shortcuts = SITE_SHORTCUTS,
  isOpen = true,
  handleClose = () => {},
}: AppleSpotlightProps) => {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [hoveredSearchResult, setHoveredSearchResult] = useState<number | null>(null)
  const [hoveredShortcut, setHoveredShortcut] = useState<number | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  // live search against the catalogue
  useEffect(() => {
    const q = searchValue.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const r = await searchContent({ data: q })
        if (cancelled) return
        const mapped: SearchResult[] = [
          ...r.movies.slice(0, 4).map((m: any) => ({
            icon: <Clapperboard />,
            label: m.name,
            description: `Movie${m.release_date ? ` · ${String(m.release_date).slice(0, 4)}` : ''}`,
            link: `/movie/${m.id}`,
          })),
          ...r.tvshows.slice(0, 4).map((m: any) => ({
            icon: <MonitorPlay />,
            label: m.name,
            description: `TV Show${m.release_date ? ` · ${String(m.release_date).slice(0, 4)}` : ''}`,
            link: `/tv-show/${m.id}`,
          })),
          ...r.channels.slice(0, 2).map((c: any) => ({
            icon: <Radio />,
            label: c.name,
            description: 'Live TV channel',
            link: `/channel/${c.id}`,
          })),
        ]
        setResults(mapped)
      } catch {
        if (!cancelled) setResults([])
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [searchValue])

  const go = (link: string) => {
    handleClose()
    navigate({ to: link as any })
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{
            opacity: 0,
            filter: 'blur(20px) url(#blob)',
            scaleX: 1.3,
            scaleY: 1.1,
            y: -10,
          }}
          animate={{
            opacity: 1,
            filter: 'blur(0px) url(#blob)',
            scaleX: 1,
            scaleY: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            filter: 'blur(20px) url(#blob)',
            scaleX: 1.3,
            scaleY: 1.1,
            y: 10,
          }}
          transition={{
            stiffness: 550,
            damping: 50,
            type: 'spring',
          }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <SVGFilter />

          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
              setHovered(false)
              setHoveredShortcut(null)
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ filter: 'url(#blob)' }}
            className={cn(
              'w-full flex items-center justify-end gap-4 z-20 group px-4',
              '[&>div]:bg-[#131c24]/95 [&>div]:text-white [&>div]:rounded-full [&>div]:backdrop-blur-xl',
              '[&_svg]:size-7 [&_svg]:stroke-[1.4]',
              'max-w-3xl',
            )}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                layoutId="search-input-container"
                transition={{
                  layout: {
                    duration: 0.5,
                    type: 'spring',
                    bounce: 0.2,
                  },
                }}
                style={{
                  borderRadius: '30px',
                }}
                className="h-full w-full flex flex-col items-center justify-start z-10 relative shadow-2xl overflow-hidden border border-white/10"
              >
                <SpotlightInput
                  placeholder={
                    hoveredShortcut !== null
                      ? shortcuts[hoveredShortcut].label
                      : hoveredSearchResult !== null
                        ? results[hoveredSearchResult]?.label ?? 'Search'
                        : 'Search movies, shows, live TV…'
                  }
                  placeholderClassName={
                    hoveredSearchResult !== null ? 'text-white' : 'text-white/40'
                  }
                  hidePlaceholder={!(hoveredSearchResult !== null || !searchValue)}
                  value={searchValue}
                  onChange={setSearchValue}
                />

                {searchValue && results.length > 0 && (
                  <SearchResultsContainer
                    searchResults={results}
                    onHover={setHoveredSearchResult}
                    onNavigate={go}
                  />
                )}
                {searchValue && results.length === 0 && (
                  <div className="px-6 py-4 text-white/40 text-sm w-full border-t border-white/10">
                    No titles match “{searchValue}”
                  </div>
                )}
              </motion.div>
              {hovered &&
                !searchValue &&
                shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={`shortcut-${index}`}
                    onMouseEnter={() => setHoveredShortcut(index)}
                    layout
                    initial={{ scale: 0.7, x: -1 * (64 * (index + 1)) }}
                    animate={{ scale: 1, x: 0 }}
                    exit={{
                      scale: 0.7,
                      x:
                        1 *
                        (16 * (shortcuts.length - index - 1) + 64 * (shortcuts.length - index - 1)),
                    }}
                    transition={{
                      duration: 0.8,
                      type: 'spring',
                      bounce: 0.2,
                      delay: index * 0.05,
                    }}
                    className="rounded-full cursor-pointer"
                  >
                    <ShortcutButton icon={shortcut.icon} link={shortcut.link} label={shortcut.label} />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { AppleSpotlight }
