import { createFileRoute } from '@tanstack/react-router'
import {
  getDashboard, getHomeAds, getMovies, getTvShows, getTeachings, getVideos,
  getLiveTvHome, getLiveChannels, getChannel, getTrending, getComingSoon,
  getGenres, getGenresPage, getGenreContent, getCastCrewList, getCastDetail,
  getMovie, getTvShow, getVideo, searchContent, getFaqs, getPage,
  getPlansPage, getCheckoutInfo, validateCoupon, getSessionUser,
  getWatchlist, toggleWatchlist, getContinueWatching, getAccountData,
  getProfiles, addProfile, updateProfile, deleteProfile,
  getPaymentHistory, getRentHistory, getNotificationsFeed, getRecommendations,
  getSocialConfig, getReviews, submitReview, login, logout, register,
  requestOtp, verifyOtp, changePassword, subscribePlan, confirmStripeSession,
  purchasePayPerView, getFooterData,
} from '../../../lib/api'
import { sign } from '../../../lib/session.server'
import { first } from '../../../lib/db'

// Stable public REST surface for the mobile app.
// Web pages call these same server functions through TanStack Start's hashed
// /_serverFn transport; this route exposes them under durable /api/mobile/*
// paths so the app is unaffected by build-hash changes.

type Ctx = { request: Request }

function json(data: any, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init?.headers ?? {}) },
  })
}

function segs(ctx: Ctx): string[] {
  const url = new URL(ctx.request.url)
  return url.pathname.replace(/^\/api\/mobile\/?/, '').split('/').filter(Boolean)
}

function num(v: string | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function withSessionToken(res: any) {
  if (res?.ok && res?.user?.id != null) {
    const token = await sign({ uid: res.user.id, email: res.user.email, name: res.user.name ?? '' })
    return { ...res, sessionToken: token }
  }
  return res
}

async function handleGet(ctx: Ctx): Promise<Response> {
  const [head, second] = segs(ctx)
  const url = new URL(ctx.request.url)
  const q = url.searchParams

  switch (head) {
    case 'health': return json({ ok: true, service: 'halobox-mobile-api' })
    case 'home': {
      const [dash, homeAds, continuing] = await Promise.all([getDashboard(), getHomeAds(), getContinueWatching()])
      return json({ ...(dash as any), homeAds, continuing })
    }
    case 'movies': return json(await getMovies())
    case 'tv-shows': return json(await getTvShows())
    case 'teachings': return json(await getTeachings())
    case 'videos': return json(await getVideos())
    case 'live-tv': return json(await getLiveTvHome())
    case 'live-channels': return json(await getLiveChannels())
    case 'trending': return json(await getTrending())
    case 'coming-soon': return json(await getComingSoon())
    case 'genres': return json(await getGenres())
    case 'genres-page': return json(await getGenresPage())
    case 'genre': return json(await getGenreContent({ data: num(q.get('id') ?? undefined) }))
    case 'cast':
      if (second) return json(await getCastDetail({ data: num(second) }))
      return json(await getCastCrewList())
    case 'movie':
    case 'title': return json(await getMovie({ data: num(second) }))
    case 'tv-show':
    case 'teaching': return json(await getTvShow({ data: num(second) }))
    case 'video': return json(await getVideo({ data: num(second) }))
    case 'episode': {
      const episode = await first(`SELECT * FROM episodes WHERE id = ? AND deleted_at IS NULL`, num(second))
      if (!episode) return json(null)
      const lib = await first(`SELECT val FROM settings WHERE name = 'bunny_library_id'`).catch(() => null)
      return json({ episode, bunnyLibraryId: (lib as any)?.val ? String((lib as any).val) : null })
    }
    case 'channel': return json(await getChannel({ data: num(second) }))
    case 'search': return json(await searchContent({ data: q.get('q') ?? '' }))
    case 'faq': return json(await getFaqs())
    case 'page': return json(await getPage({ data: q.get('slug') ?? '' }))
    case 'plans': return json(await getPlansPage())
    case 'checkout-info': return json(await getCheckoutInfo())
    case 'coupon':
      return json(await validateCoupon({ data: { code: q.get('code') ?? '', amount: num(q.get('amount') ?? undefined) } }))
    case 'session': return json(await getSessionUser())
    case 'watchlist': return json(await getWatchlist())
    case 'continue-watching': return json(await getContinueWatching())
    case 'account': return json(await getAccountData())
    case 'profiles': return json(await getProfiles())
    case 'payment-history': return json(await getPaymentHistory())
    case 'rent-history': return json(await getRentHistory())
    case 'notifications': return json(await getNotificationsFeed())
    case 'recommendations': return json(await getRecommendations())
    case 'social-config': return json(await getSocialConfig())
    case 'reviews': return json(await getReviews({ data: num(q.get('id') ?? undefined) }))
    case 'footer': return json(await getFooterData())
    default: return json({ ok: false, error: `Unknown endpoint: ${head ?? '(root)'}` }, { status: 404 })
  }
}

async function handlePost(ctx: Ctx): Promise<Response> {
  const [head, second] = segs(ctx)
  let body: any = {}
  try {
    body = await ctx.request.json()
  } catch {
    return json({ ok: false, error: 'Expected a JSON body.' }, { status: 400 })
  }

  switch (head) {
    case 'auth':
      switch (second) {
        case 'login': {
          if (!body?.email || !body?.password) return json({ ok: false, error: 'Email and password are required.' }, { status: 400 })
          return json(await withSessionToken(await login({ data: body })))
        }
        case 'register': {
          if (!body?.email || !body?.password) return json({ ok: false, error: 'Email and password are required.' }, { status: 400 })
          return json(await withSessionToken(await register({ data: body })))
        }
        case 'logout': return json(await logout())
        case 'change-password': {
          if (!body?.current || !body?.next) return json({ ok: false, error: 'Current and new password are required.' }, { status: 400 })
          return json(await changePassword({ data: body }))
        }
        default: return json({ ok: false, error: 'Unknown auth action.' }, { status: 404 })
      }
    case 'otp':
      switch (second) {
        case 'request': return json(await requestOtp({ data: body }))
        case 'verify': return json(await withSessionToken(await verifyOtp({ data: body })))
        default: return json({ ok: false, error: 'Unknown otp action.' }, { status: 404 })
      }
    case 'watchlist':
      if (second === 'toggle') return json(await toggleWatchlist({ data: body }))
      break
    case 'reviews':
      if (second === 'submit') return json(await submitReview({ data: body }))
      break
    case 'profiles':
      switch (second) {
        case 'add': return json(await addProfile({ data: body }))
        case 'update': return json(await updateProfile({ data: body }))
        case 'delete': return json(await deleteProfile({ data: body }))
        default: break
      }
      break
    case 'subscribe': return json(await subscribePlan({ data: body }))
    case 'stripe':
      if (second === 'confirm') return json(await confirmStripeSession({ data: body }))
      break
    case 'ppv':
      if (second === 'purchase') return json(await purchasePayPerView({ data: body }))
      break
    default: break
  }
  return json({ ok: false, error: `Unknown endpoint: ${head ?? '(root)'}` }, { status: 404 })
}

export const Route = createFileRoute('/api/mobile/$')({
  server: {
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
})
