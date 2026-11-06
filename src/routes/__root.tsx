import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState, useNavigate } from '@tanstack/react-router'
import { Bookmark, Clapperboard, Home, Menu, Radio, X } from 'lucide-react'
import { getSessionUser, getFooterData } from '../lib/api'
import { IconSearch, IconCrown } from '../components/Poster'
import { MotionRoot } from '../components/Motion'
import { GlassButton } from '@/components/ui/glass-button'
import { LiquidButton } from '@/components/ui/liquid-glass-button'
import { AppleSpotlight } from '@/components/ui/apple-spotlight'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Streamit: Sermons, Shows & Teachings' },
      { name: 'description', content: 'Watch sermons, shows, teachings, live TV and videos on Streamit.' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' },
    ],
  }),
  loader: async () => ({ user: await getSessionUser(), footer: await getFooterData() }),
  component: RootComponent,
})

const BARE_ROUTES = ['/login', '/register', '/forgot-password', '/manage-profile']
const NAV_ITEMS = [
  { label: 'Home', to: '/', aliases: ['/'] },
  { label: 'Sermons', to: '/movies', aliases: ['/movies', '/movie'] },
  { label: 'Teachings', to: '/teachings', aliases: ['/teachings', '/teaching'] },
  { label: 'Shows', to: '/tv-shows', aliases: ['/tv-shows', '/tv-show'] },
  { label: 'Videos', to: '/videos', aliases: ['/videos', '/video'] },
  { label: 'Live TV', to: '/live-tv', aliases: ['/live-tv', '/channel'] },
  { label: 'Watchlist', to: '/watchlist', aliases: ['/watchlist'] },
]

function IconBell({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
}

function destinationActive(pathname: string, item: typeof NAV_ITEMS[number]) {
  if (item.to === '/') return pathname === '/'
  return item.aliases.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function RootComponent() {
  const { user, footer } = Route.useLoaderData()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const isAdmin = pathname.startsWith('/admin')
  const isBare = BARE_ROUTES.some((route) => pathname.startsWith(route))

  useEffect(() => {
    const lenis = (window as any).__lenis
    if (lenis) lenis.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      menuPanelRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus({ preventScroll: true })
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        return
      }
      if (event.key !== 'Tab' || !menuPanelRef.current) return
      const focusable = Array.from(menuPanelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]):not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !menuPanelRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [menuOpen])

  if (isAdmin || isBare) return <RootDocument><Outlet /></RootDocument>

  const openSearch = () => {
    setMenuOpen(false)
    setSpotlightOpen(true)
  }
  const toggleMenu = () => {
    setSpotlightOpen(false)
    setMenuOpen((open) => !open)
  }

  return (
    <RootDocument>
      <header className={`site-header${pathname === '/' ? ' on-hero' : ''}`}>
        <div className="site-header-bar">
          <Link to="/" className="brand" aria-label="Streamit home">
            <img src="/default-image.jpg" alt="Streamit" />
            <span className="brand-word">Streamit</span>
          </Link>
          <nav className="main-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={destinationActive(pathname, item) ? 'active' : ''}>
                {item.label === 'Live TV' && <span className="live-nav-dot" aria-hidden="true" />}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-btn-plain header-search" aria-label="Search" aria-haspopup="dialog" aria-controls="catalogue-search-dialog" aria-expanded={spotlightOpen} onClick={openSearch}><IconSearch /></button>
            {user && <Link to="/notifications" className="icon-btn-plain header-notifications" aria-label="Notifications"><IconBell /></Link>}
            <GlassButton size="sm" className="subscribe-glass" contentClassName="flex items-center gap-2 subscribe-glass-text" onClick={() => navigate({ to: '/subscription-plan' })}>
              <IconCrown /> {user ? 'UPGRADE' : 'SUBSCRIBE'}
            </GlassButton>
            {user ? (
              <Link to="/account-setting" className="avatar-link" aria-label="Account"><img className="avatar" src="/default-image.jpg" alt={user.first_name ?? 'Profile'} /></Link>
            ) : (
              <LiquidButton size="sm" className="login-liquid" onClick={() => navigate({ to: '/login' })}>Login</LiquidButton>
            )}
            <button type="button" className="icon-btn-plain mobile-menu-trigger" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="mobile-navigation-sheet" aria-expanded={menuOpen} onClick={toggleMenu}>
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <div ref={menuPanelRef} id="mobile-navigation-sheet" className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-label="Site menu" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu-head">
              <span>Browse Streamit</span>
              <button type="button" className="icon-btn-plain" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button>
            </div>
            <button type="button" className="mobile-menu-search" onClick={openSearch}><IconSearch /> Search the catalogue</button>
            <nav className="mobile-menu-nav" aria-label="Mobile navigation">
              {NAV_ITEMS.map((item) => <Link key={item.to} to={item.to} className={destinationActive(pathname, item) ? 'active' : ''}>{item.label}</Link>)}
            </nav>
          </div>
        </div>
      )}

      <nav className="mobile-dock" aria-label="Quick navigation">
        <Link to="/" className={pathname === '/' ? 'active' : ''}><Home size={19} /><span>Home</span></Link>
        <Link to="/movies" className={destinationActive(pathname, NAV_ITEMS[1]) ? 'active' : ''}><Clapperboard size={19} /><span>Sermons</span></Link>
        <Link to="/live-tv" className={destinationActive(pathname, NAV_ITEMS[5]) ? 'active' : ''}><Radio size={19} /><span>Live TV</span></Link>
        <Link to="/watchlist" className={pathname.startsWith('/watchlist') ? 'active' : ''}><Bookmark size={19} /><span>Watchlist</span></Link>
        <button type="button" className={menuOpen ? 'active' : ''} aria-label="Open menu" aria-expanded={menuOpen} onClick={toggleMenu}><Menu size={19} /><span>Menu</span></button>
      </nav>

      <AppleSpotlight isOpen={spotlightOpen} handleClose={() => setSpotlightOpen(false)} />
      <main key={pathname} className="page-enter"><Outlet /></main>
      <SiteFooter footer={footer} />
      <MotionRoot />
    </RootDocument>
  )
}

const LEGAL = [
  { label: 'Privacy Policy', slug: 'privacy-policy' },
  { label: 'Terms & Conditions', slug: 'terms-conditions' },
  { label: 'Help And Support', slug: 'help-and-support' },
  { label: 'Refund And Cancellation Policy', slug: 'refund-and-cancellation-policy' },
  { label: 'Data Deletion Request', slug: 'data-deletation-request' },
  { label: 'About Us', slug: 'about-us' },
]

function SocialIcon({ d }: { d: string }) {
  return <span className="social-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg></span>
}

const SOCIALS = [
  'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12',
  'M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-.1 1.3-.1 1.6-.1 4.8-.1-1.6-.1-1.6-.1-4.9-.1-1.3-.1-1.6-.1-4.8-.1-3.2 0-4.8-.1-3.6 0-.1-4.8-1.6-1.3-.1-1.6-4.9-4.9C2.3 4 3.9 2.4 7.2 2.3c1.2-.1 1.6-.1 4.8-.1M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4m5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4',
  'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.8.3c-.4.1-1.4.1-2.3 1-.7.7-.9 2.3-.9 2.3S.8 9.1.8 11v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.3 7.6.3s4.6 0 7.8-.4c.4-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8V11c0-1.9-.2-3.8-.2-3.8M9.7 15V8.4l6.2 3.3z',
  'M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L5.8 22H2.7l7.3-8.3L1.2 2h6.5l4.4 5.9zm-1.1 18h1.7L7.1 3.9H5.3z',
]

function SiteFooter({ footer }: { footer: { premium: any[]; latest: any[] } }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <img src="/default-image.jpg" alt="Streamit" />
          <p className="tagline">Streamit: Your Ultimate Destination for Unlimited Sermons, Shows and Teachings!</p>
          <p className="contact"><span>hello@iqonic.design</span><span>+15265897485</span></p>
          <div className="socials">{SOCIALS.map((d, i) => <SocialIcon key={i} d={d} />)}</div>
        </div>
        <div className="footer-col"><h4>Premium Shows</h4>{footer.premium.map((item: any) => <Link key={item.id} to={`/tv-show/${item.id}` as any}>› {item.name}</Link>)}</div>
        <div className="footer-col"><h4>Latest Released</h4>{footer.latest.map((item: any) => <Link key={item.id} to={`/movie/${item.id}` as any}>› {item.name}</Link>)}</div>
        <div className="footer-col">
          <h4>Download Our App</h4>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>Download our app for instant access to the best sermons, shows and teachings!</p>
          <div className="store-badges"><img src="/play_store.png" alt="Get it on Google Play" /><img src="/app_store.png" alt="Download on the App Store" /></div>
        </div>
      </div>
      <div className="footer-legal">{LEGAL.map((item) => <Link key={item.slug} to={`/page/${item.slug}` as any}>{item.label}</Link>)}<Link to="/faq">FAQ</Link></div>
      <div className="footer-copy">© 2026 Streamit: Sermons, Shows & Teachings. All Rights Reserved.</div>
    </footer>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>
}
