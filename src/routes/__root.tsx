import { siteHead } from '@/lib/siteMetadata'
import { contentPath } from '@/lib/contentRoutes'
import type { ReactNode } from 'react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from '@tanstack/react-router'
import { Bookmark, BookOpen, ChevronDown, ChevronRight, Clapperboard, Clock3, Home, Menu, PlaySquare, Radio, ShoppingBag, Tv, UserRound, X } from 'lucide-react'
import { getSessionUser, getFooterData } from '../lib/api'
import { IconSearch } from '../components/Poster'
import { MotionRoot } from '../components/Motion'
import { LiquidGlassFilter, LiquidGlassLayers, MobileLiquidGlass } from '../components/ui/liquid-glass'
import { AppleSpotlight } from '@/components/ui/apple-spotlight'
import '../styles.css'
import '../tv-theme.css'
import '../header.css'
import '../catalogue.css'
import '../detail.css'
import '../player.css'
import '../auth-flow.css'
import '../liquid-glass.css'
import '../library.css'
import '../live-tv.css'
import '../responsive-glass.css' // Responsive glass and 4K refinements
import '../mobile-glass.css'
import '../subscription-checkout.css'
import '../refinements.css'
import '../player-chat-refinement.css'
import '../release2-experience.css'
import '../release2-visual.css'
import '../player-interaction.css'
import '../discovery.css'
import '../alerts.css'

export const Route = createRootRoute({
  head: ({ matches }) => ({
    ...siteHead(matches.at(-1)?.pathname || '/'),
    scripts: [
      {
        // Runs before first paint: if the intro hasn't played this session,
        // mask the page (CSS in styles.css) so the homepage never flashes
        // ahead of the preloader.
        children:
          "try{if(!sessionStorage.getItem('hb-intro-seen-v1'))document.documentElement.classList.add('hb-intro')}catch(e){}",
      },
    ],
  }),
  loader: async () => ({ user: await getSessionUser(), footer: await getFooterData() }),
  component: RootComponent,
})

const BARE_ROUTES = ['/login', '/register', '/forgot-password', '/otp-login', '/manage-profile']
// Preloader chunk only downloads on the first visit of a session.
const SitePreloader = lazy(() => import('../components/ui/stack-loader').then((m) => ({ default: m.SitePreloader })))
const MENU_ICONS = [Home, Clapperboard, BookOpen, Tv, PlaySquare, Radio]
const NAV_ITEMS = [
  { label: 'Home', to: '/', aliases: ['/'] },
  { label: 'Sermons', to: '/sermons', aliases: ['/sermons', '/sermon', '/movies', '/movie'] },
  { label: 'Teaching Series', to: '/teachings', aliases: ['/teachings', '/teaching'] },
  { label: 'Shows', to: '/shows', aliases: ['/shows', '/tv-shows', '/tv-show'] },
  { label: 'Videos', to: '/videos', aliases: ['/videos', '/video'] },
  { label: 'Live TV', to: '/live-tv', aliases: ['/live-tv', '/channel'] },
  { label: 'Watchlist', to: '/watchlist', aliases: ['/watchlist'] },
]
const STORE_ITEM = { label: 'Store', to: '/shop', aliases: ['/shop'] }
const WATCH_ITEMS = NAV_ITEMS.slice(1, 5)
const LIBRARY_ROUTES = ['/account-setting', '/watchlist', '/continue-watching']

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
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)
  const watchRef = useRef<HTMLDivElement>(null)
  const watchButton = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuPanelRef = useRef<HTMLDialogElement>(null)
  const isAdmin = pathname.startsWith('/admin')
  const isBare = BARE_ROUTES.some((route) => pathname.startsWith(route))

  useEffect(() => {
    setMenuOpen(false)
    setWatchOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!watchOpen) return
    watchRef.current?.querySelector<HTMLElement>('.watch-submenu nav a')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => { if (!watchRef.current?.contains(event.target as Node)) setWatchOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setWatchOpen(false); watchButton.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [watchOpen])

  useEffect(() => {
    if (isAdmin || isBare) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMenuOpen(false)
        setSpotlightOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isAdmin, isBare])

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1181px)')
    const closeOnWide = () => { if (wide.matches) setMenuOpen(false) }
    wide.addEventListener('change', closeOnWide)
    return () => wide.removeEventListener('change', closeOnWide)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const dialog = menuPanelRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    dialog.addEventListener('keydown', containFocus)
    return () => {
      dialog.removeEventListener('keydown', containFocus)
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [menuOpen])

  if (isAdmin || isBare) return <RootDocument><Outlet /></RootDocument>

  const openSearch = () => {
    setMenuOpen(false)
    setWatchOpen(false)
    setSpotlightOpen(true)
  }
  const toggleMenu = () => {
    setSpotlightOpen(false)
    setMenuOpen((open) => !open)
  }

  return (
    <RootDocument>
      <Suspense fallback={null}><SitePreloader /></Suspense>
      <header className={`site-header${pathname === '/' ? ' on-hero' : ''}`}>
        <div className="site-header-blur" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i} className="site-header-blur-layer" />)}</div>
        <div className="site-header-bar">
          <Link to="/" className="brand" aria-label="GoodNews Halobox home">
            <img src="/halo-ring-logo.avif?v=2" alt="GoodNews Halobox" width="48" height="48" />
            <span className="brand-word"><span>GoodNews</span><strong>Halobox</strong></span>
          </Link>
          <nav className="main-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={destinationActive(pathname, item) ? 'active' : ''} aria-current={destinationActive(pathname, item) ? 'page' : undefined}>
                {item.label === 'Live TV' && <span className="live-nav-dot" aria-hidden="true" />}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-btn-plain header-search" aria-label="Search" aria-haspopup="dialog" aria-expanded={spotlightOpen} aria-controls="catalogue-search-dialog" onClick={openSearch}><IconSearch size={19} /></button>
            {user && <Link to="/notifications" className="icon-btn-plain header-notifications" aria-label="Notifications"><IconBell /></Link>}
            {user ? <Link to="/account-setting" className="header-login">Account</Link> : <Link to="/login" className="header-login">Login</Link>}
            <Link to="/account-setting" className={`header-library${LIBRARY_ROUTES.includes(pathname) ? ' active' : ''}`} aria-label="Library" aria-current={LIBRARY_ROUTES.includes(pathname) ? 'page' : undefined}><Bookmark size={21} aria-hidden="true" /></Link>
            <Link to={user ? '/account-setting' : '/login'} className="header-profile" aria-label={user ? 'Your account' : 'Sign in'}><UserRound size={21} aria-hidden="true" /></Link>
            <Link to="/shop" className="header-subscribe">Store</Link>
            <button type="button" className="icon-btn-plain mobile-menu-trigger" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="mobile-navigation-sheet" aria-expanded={menuOpen} onClick={toggleMenu}>
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <dialog ref={menuPanelRef} id="mobile-navigation-sheet" className="mobile-menu-sheet" aria-labelledby="mobile-menu-title" data-lenis-prevent
          onCancel={(event) => { event.preventDefault(); setMenuOpen(false) }}
          onClick={(event) => { if (event.target === event.currentTarget) setMenuOpen(false) }}>
          <div className="mobile-menu-head">
            <div><p>GoodNews Halobox</p><h2 id="mobile-menu-title">Explore</h2></div>
            <button type="button" className="mobile-menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={22} aria-hidden="true" /></button>
          </div>
          <div className="mobile-menu-body">
            <button type="button" className="mobile-menu-search" aria-haspopup="dialog" aria-controls="catalogue-search-dialog" onClick={openSearch}><IconSearch size={21} /><span>Search messages, shows and more</span></button>
            <nav className="mobile-menu-nav" aria-label="Mobile navigation" onClick={(event) => { if (event.target instanceof Element && event.target.closest('a')) setMenuOpen(false) }}>
              {NAV_ITEMS.slice(0, 6).map((item, index) => {
                const Icon = MENU_ICONS[index]
                const active = destinationActive(pathname, item)
                return <Link key={item.to} to={item.to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon size={23} className="mobile-menu-icon" aria-hidden="true" /><span>{item.label}</span>{item.to === '/live-tv' ? <span className="mobile-menu-live">Live</span> : <ChevronRight size={17} className="mobile-menu-chevron" aria-hidden="true" />}</Link>
              })}
            </nav>
            <p className="mobile-menu-section-label">Your library</p>
            <nav className="mobile-menu-library" aria-label="Your library" onClick={() => setMenuOpen(false)}>
              <Link to="/continue-watching"><Clock3 size={22} aria-hidden="true" /><span>Continue watching</span></Link>
              <Link to="/watchlist"><Bookmark size={22} aria-hidden="true" /><span>Watchlist</span></Link>
            </nav>
            <Link to={user ? '/account-setting' : '/login'} className="mobile-menu-account" onClick={() => setMenuOpen(false)}>
              <span className="mobile-menu-avatar"><UserRound size={23} aria-hidden="true" /></span>
              <span><strong>{user ? 'Your account' : 'Make yourself at home'}</strong><small>{user ? 'Profiles, settings and membership' : 'Sign in for your library and recommendations'}</small></span><ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="mobile-menu-footer"><Link to="/subscription-plan" onClick={() => setMenuOpen(false)}>{user ? 'Explore membership' : 'Explore plans'}<ChevronRight size={18} aria-hidden="true" /></Link></div>
        </dialog>
      )}

      <div ref={watchRef} className={`mobile-navigation${pathname === '/search' ? ' is-search-page' : ''}`}>
        {watchOpen && <div className="watch-submenu" role="region" aria-label="Watch categories" id="watch-submenu">
          <div className="watch-submenu-head"><strong>Watch</strong><button type="button" aria-label="Close Watch menu" onClick={() => { setWatchOpen(false); watchButton.current?.focus() }}><ChevronDown size={22} /></button></div>
          <nav aria-label="Watch">{WATCH_ITEMS.map(item => <Link key={item.to} to={item.to} aria-current={destinationActive(pathname, item) ? 'page' : undefined} onClick={() => setWatchOpen(false)}><img className="watch-category-icon" src={`/images/watch-icons${item.to}.avif?v=20261108-r2`} width="56" height="56" alt="" aria-hidden="true" decoding="async" /><span>{item.label}</span></Link>)}</nav>
        </div>}
        <MobileLiquidGlass asChild><nav className="mobile-dock liquid-glass" aria-label="Quick navigation">
          <Link to="/" className={pathname === '/' ? 'active' : ''} aria-current={pathname === '/' ? 'page' : undefined}><Home size={23} /><span>Home</span></Link>
          <button ref={watchButton} type="button" className={watchOpen || WATCH_ITEMS.some(item => destinationActive(pathname, item)) ? 'active' : ''} aria-expanded={watchOpen} aria-controls="watch-submenu" onClick={() => setWatchOpen(open => !open)}><Tv size={23} /><span>Watch</span></button>
          <Link to="/live-tv" className={destinationActive(pathname, NAV_ITEMS[5]) ? 'active' : ''} aria-current={destinationActive(pathname, NAV_ITEMS[5]) ? 'page' : undefined}><Radio size={23} /><span>Live TV</span></Link>
          <Link to="/shop" className={destinationActive(pathname, STORE_ITEM) ? 'active' : ''} aria-current={destinationActive(pathname, STORE_ITEM) ? 'page' : undefined}><ShoppingBag size={23} aria-hidden="true" /><span>Store</span></Link>
        </nav></MobileLiquidGlass>
        <MobileLiquidGlass asChild interactive><button type="button" className={`mobile-search-circle liquid-glass${spotlightOpen ? ' active' : ''}`} aria-label="Search" aria-haspopup="dialog" aria-expanded={spotlightOpen} aria-controls="catalogue-search-dialog" onClick={openSearch}><IconSearch size={27} /></button></MobileLiquidGlass>
      </div>

      <AppleSpotlight isOpen={spotlightOpen} handleClose={() => setSpotlightOpen(false)} />
      <main key={pathname} className={`page-enter${pathname === '/shop' || pathname.startsWith('/shop/') ? ' page-store' : ''}`}><Outlet /></main>
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
  'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.8.3c-.4.1-1.4.1-2.3 1-.7.7-.9 2.3-.9 2.3S.8 9.1.8 11v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.3 7.6.3s4.6 0 7.8-.4c.4-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8V11c0-1.9-.2-3.8-.2-3.8M9.7 15V8.4l6.2 3.3z',
  'M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L5.8 22H2.7l7.3-8.3L1.2 2h6.5l4.4 5.9zm-1.1 18h1.7L7.1 3.9H5.3z',
]

function SiteFooter({ footer }: { footer: { premium: any[]; latest: any[] } }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <img src="/halo-ring-logo.avif?v=2" alt="GoodNews Halobox" width="48" height="48" />
          <p className="tagline">GoodNews Halobox: Your Ultimate Destination for Unlimited Sermons, Shows and Teachings!</p>
          <div className="contact halo-contact"><a href="mailto:Hello@halobox.tv">Hello@halobox.tv</a><a href="tel:+14488770344">🇺🇸 +1 448 877 0344</a><a href="tel:+441244727242">🇬🇧 +44 1244 727242</a><a href="tel:+2638677211645">🇿🇼 +263 8677 211 645</a><a href="tel:+27872654913">🇿🇦 +27 872 654 913</a></div>
          <div className="socials">{SOCIALS.map((d, i) => <SocialIcon key={i} d={d} />)}</div>
        </div>
        <div className="footer-col"><h4>Premium Shows</h4>{footer.premium.map((item: any) => <Link key={item.id} to={contentPath(item,'/tv-show') as any} hash="watch">› {item.name}</Link>)}</div>
        <div className="footer-col"><h4>Latest Released</h4>{footer.latest.map((item: any) => <Link key={item.id} to={contentPath(item,'/movie') as any} hash="watch">› {item.name}</Link>)}</div>
        <div className="footer-col">
          <h4>Download Our App</h4>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>Download our app for instant access to the best sermons, shows and teachings!</p>
          <div className="store-badges"><img src="/play_store.avif" alt="Get it on Google Play" /><img src="/app_store.avif" alt="Download on the App Store" /></div>
        </div>
      </div>
      <div className="footer-legal">{LEGAL.map((item) => <Link key={item.slug} to={`/page/${item.slug}` as any}>{item.label}</Link>)}<Link to="/faq">FAQ</Link></div>
      <div className="footer-copy">© 2026 GoodNews Halobox: Sermons, Shows & Teachings. All Rights Reserved.</div>
    </footer>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><head><HeadContent /></head><body><LiquidGlassFilter />{children}<Scripts /></body></html>
}
