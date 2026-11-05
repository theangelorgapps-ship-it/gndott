import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router'
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
      { title: 'Streamit: Your Ultimate Entertainment Hub' },
      { name: 'description', content: 'Watch movies, TV shows, live TV and videos on Streamit.' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      },
    ],
  }),
  loader: async () => ({ user: await getSessionUser(), footer: await getFooterData() }),
  component: RootComponent,
})

const BARE_ROUTES = ['/login', '/register', '/forgot-password', '/manage-profile']

function IconBell({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function IconDownload({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

function IconChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function RootComponent() {
  const { user, footer } = Route.useLoaderData()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const isAdmin = pathname.startsWith('/admin')
  const isBare = BARE_ROUTES.some((r) => pathname.startsWith(r))
  if (isAdmin || isBare) {
    return (
      <RootDocument>
        <Outlet />
      </RootDocument>
    )
  }
  const allContentActive = ['/movies', '/tv-shows', '/videos', '/movie', '/tv-show', '/video'].some((p) => pathname.startsWith(p))

  // keep Lenis in sync on navigation: jump to top through Lenis itself
  useEffect(() => {
    const lenis = (window as any).__lenis
    if (lenis) lenis.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [pathname])

  return (
    <RootDocument>
      <header className={`site-header${pathname === '/' ? ' on-hero' : ''}`}>
        <Link to="/" className="brand" aria-label="Streamit home">
          <img src="/default-image.jpg" alt="Streamit" />
        </Link>
        <nav className="main-nav">
          <Link to="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
          <div className={`nav-drop${allContentActive ? ' active' : ''}`}>
            <span className="nav-drop-label">All Content <IconChevronDown /></span>
            <div className="nav-drop-menu">
              <Link to="/movies">Movies</Link>
              <Link to="/tv-shows">TV Shows</Link>
              <Link to="/videos">Videos</Link>
            </div>
          </div>
          <Link to="/coming-soon" className={pathname.startsWith('/coming-soon') ? 'active' : ''}>Coming Soon</Link>
          <Link to="/live-tv" className={pathname.startsWith('/live-tv') ? 'active' : ''}>Live TV</Link>
        </nav>
        <div className="header-actions">
          <button type="button" className="icon-btn-plain" aria-label="Search" onClick={() => setSpotlightOpen(true)}>
            <IconSearch />
          </button>
          {user && (
            <Link to="/notifications" className="icon-btn-plain" aria-label="Notifications">
              <IconBell />
            </Link>
          )}
          <span className="icon-btn-dark" aria-label="Downloads">
            <IconDownload />
          </span>
          <span className="lang-pill">
            <svg width="16" height="11" viewBox="0 0 20 14" aria-hidden="true" style={{ borderRadius: 2 }}>
              <rect width="20" height="14" fill="#b22234" />
              {[1, 3, 5, 7, 9, 11].map((i) => <rect key={i} y={i} width="20" height="1" fill="#fff" />)}
              <rect width="9" height="7.6" fill="#3c3b6e" />
            </svg>
            EN <IconChevronDown />
          </span>
          <GlassButton
            size="sm"
            className="subscribe-glass"
            contentClassName="flex items-center gap-2 subscribe-glass-text"
            onClick={() => navigate({ to: '/subscription-plan' })}
          >
            <IconCrown /> {user ? 'UPGRADE' : 'SUBSCRIBE'}
          </GlassButton>
          {user ? (
            <Link to="/account-setting" className="avatar-link" aria-label="Account">
              <img className="avatar" src="/default-image.jpg" alt={user.first_name ?? 'Profile'} />
            </Link>
          ) : (
            <LiquidButton
              size="sm"
              className="login-liquid"
              onClick={() => navigate({ to: '/login' })}
            >
              Login
            </LiquidButton>
          )}
        </div>
      </header>
      <AppleSpotlight isOpen={spotlightOpen} handleClose={() => setSpotlightOpen(false)} />
      <main key={pathname} className="page-enter">
        <Outlet />
      </main>
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
  return (
    <span className="social-ico">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={d} />
      </svg>
    </span>
  )
}

const SOCIALS = [
  'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12', // facebook
  'M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1-3.2 0-3.6 0-4.8-.1-3.3-.1-4.8-1.7-4.9-4.9-.1-1.3-.1-1.6-.1-4.8s0-3.6.1-4.8C2.3 4 3.9 2.4 7.2 2.3c1.2-.1 1.6-.1 4.8-.1M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4m5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4', // instagram
  'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.8.3c-.4.1-1.4.1-2.3 1-.7.7-.9 2.3-.9 2.3S.8 9.1.8 11v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.3 7.6.3s4.6 0 7.8-.4c.4-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8V11c0-1.9-.2-3.8-.2-3.8M9.7 15V8.4l6.2 3.3z', // youtube
  'M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L5.8 22H2.7l7.3-8.3L1.2 2h6.5l4.4 5.9zm-1.1 18h1.7L7.1 3.9H5.3z', // x
]

function SiteFooter({ footer }: { footer: { premium: any[]; latest: any[] } }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <img src="/default-image.jpg" alt="Streamit" />
          <p className="tagline">
            Streamit: Your Ultimate Destination for Unlimited Movies and Shows!
          </p>
          <p className="contact">
            <span>hello@iqonic.design</span>
            <span>+15265897485</span>
          </p>
          <div className="socials">
            {SOCIALS.map((d, i) => <SocialIcon key={i} d={d} />)}
          </div>
        </div>
        <div className="footer-col">
          <h4>Premium shows</h4>
          {footer.premium.map((m: any) => (
            <Link key={m.id} to={`/tv-show/${m.id}` as any}>› {m.name}</Link>
          ))}
        </div>
        <div className="footer-col">
          <h4>Latest Released</h4>
          {footer.latest.map((m: any) => (
            <Link key={m.id} to={`/movie/${m.id}` as any}>› {m.name}</Link>
          ))}
        </div>
        <div className="footer-col">
          <h4>Download Our App</h4>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            Download our app for instant access to the best movies and shows!
          </p>
          <div className="store-badges">
            <img src="/play_store.png" alt="Get it on Google Play" />
            <img src="/app_store.png" alt="Download on the App Store" />
          </div>
        </div>
      </div>
      <div className="footer-legal">
        {LEGAL.map((l) => (
          <Link key={l.slug} to={`/page/${l.slug}` as any}>{l.label}</Link>
        ))}
        <Link to="/faq">FAQ</Link>
      </div>
      <div className="footer-copy">© 2026 Streamit: Your Ultimate Entertainment Hub. All Rights Reserved.</div>
    </footer>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
