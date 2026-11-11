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
import { getStoreProducts, getStoreCart, updateStoreCart, quoteStoreCheckout, startStoreCheckout } from '../../../lib/store'
import { first } from '../../../lib/db'
import { getBibleBooks, getBibleChapter } from '../../../lib/bible'
import { BIBLE_VERSIONS } from '../../../lib/bibleProvider'

// Stable public REST surface for the mobile app.
// Web pages call these same server functions through TanStack Start's hashed
// /_serverFn transport; this route exposes them under durable /api/mobile/*
// paths so the app is unaffected by build-hash changes.

type Ctx = { request: Request }

function json(data: any, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      // Public content API: the app sends the session token explicitly as a
      // Cookie header (no ambient credentials), so a wildcard origin is safe
      // and lets the web preview (localhost) and future web builds call it.
      'access-control-allow-origin': '*',
      ...(init?.headers ?? {}),
    },
  })
}

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, cookie, authorization',
      'access-control-max-age': '86400',
    },
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
  if (res?.ok && typeof res?.token === 'string') {
    return { ...res, sessionToken: res.token }
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
    case 'stream': {
      // /api/mobile/stream/<movie|teaching|tv-show|video|episode>/<id>
      // Entitlement-checked playback payload. Gating is inherited from the
      // detail server functions (they strip playback fields when the viewer
      // is not entitled) — never re-implemented here.
      const type = second ?? ''
      const id = num(segs(ctx)[2])
      if (!id) return json({ ok: false, error: 'Missing content id' }, { status: 400 })
      let content: any = null
      let libraryId: string | null = null
      if (type === 'movie') {
        const d: any = await getMovie({ data: id })
        content = d?.movie
        libraryId = d?.bunnyLibraryId ?? null
      } else if (type === 'teaching' || type === 'tv-show' || type === 'tvshow') {
        const d: any = await getTvShow({ data: id })
        content = d?.show
        libraryId = d?.bunnyLibraryId ?? null
      } else if (type === 'video') {
        const d: any = await getVideo({ data: id })
        content = d?.video
        libraryId = d?.bunnyLibraryId ?? null
      } else if (type === 'episode') {
        const ep: any = await first(`SELECT * FROM episodes WHERE id = ? AND deleted_at IS NULL`, id)
        if (ep?.entertainment_id) {
          const d: any = await getTvShow({ data: Number(ep.entertainment_id) }).catch(() => null)
          libraryId = d?.bunnyLibraryId ?? null
          // Parent gating applies: paid parent without purchase hides sources.
          const denied = (d?.show?.movie_access === 'paid' && !d?.myPurchase) || d?.show?.hasSubscriptionAccess === false
          content = denied ? { ...ep, video_url_input: null, bunny_video_url: null, movie_access: 'paid' } : ep
        } else {
          content = ep
        }
        if (!libraryId) {
          const lib = await first(`SELECT val FROM settings WHERE name = 'bunny_library_id'`).catch(() => null)
          libraryId = (lib as any)?.val ? String((lib as any).val) : null
        }
      } else {
        return json({ ok: false, error: `Unknown stream type: ${type}` }, { status: 404 })
      }
      if (!content) return json({ ok: false, error: 'Content not found' }, { status: 404 })

      const directUrl = typeof content.video_url_input === 'string' && /\.(mp4|webm|ogg|m4v|m3u8)(?:[?#]|$)/i.test(content.video_url_input.trim())
        ? content.video_url_input.trim()
        : null
      const videoId = typeof content.bunny_video_url === 'string' && content.bunny_video_url.trim() ? content.bunny_video_url.trim() : null
      const paid = content.movie_access === 'paid' || content.access === 'paid'
      // Paid content whose sources were stripped by gating is locked.
      const locked = paid && !directUrl && !videoId

      const zoneRow = await first(`SELECT val FROM settings WHERE name = 'bunny_pull_zone'`).catch(() => null)
      const pullZone = (zoneRow as any)?.val
        ? String((zoneRow as any).val).replace(/^https?:\/\//, '').replace(/\/+$/, '')
        : null
      let hls = !locked && videoId && pullZone ? `https://${pullZone}/${videoId}/playlist.m3u8` : null
      let seekSheetBase = !locked && videoId && pullZone ? `https://${pullZone}/${videoId}/` : null
      // Most titles already store the Bunny playlist as their direct URL —
      // derive the HLS contract from it when no pull-zone setting exists.
      if (!locked && !hls && directUrl && /:\/\/[^/]*\.b-cdn\.net\/[a-f0-9-]+\/playlist\.m3u8(?:[?#]|$)/i.test(directUrl)) {
        hls = directUrl
        seekSheetBase = directUrl.split('/playlist.m3u8')[0] + '/'
      }
      const embed = !locked && videoId && libraryId
        ? `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}`
        : null
      const provider = locked ? null : hls ? 'bunny-hls' : directUrl ? 'direct' : embed ? 'bunny-embed' : null
      return json({
        locked,
        provider,
        libraryId: locked ? null : libraryId,
        videoId: locked ? null : videoId,
        hls,
        seekSheetBase,
        embed,
        directUrl: locked ? null : directUrl,
        subtitles: [],
        title: content.name ?? null,
        duration: content.duration ?? null,
        poster: content.thumbnail_url ?? content.poster_url ?? null,
      })
    }
    case 'channel': return json(await getChannel({ data: num(second) }))
    case 'search': return json(await searchContent({ data: q.get('q') ?? '' }))
    case 'faq': return json(await getFaqs())
    case 'page': return json(await getPage({ data: q.get('slug') ?? '' }))
    case 'plans': return json(await getPlansPage())
    case 'checkout-info': return json(await getCheckoutInfo({ data: { planId: num(q.get('planId') ?? undefined) } }))
    case 'coupon':
      return json(await validateCoupon({ data: { code: q.get('code') ?? '', planId: num(q.get('planId') ?? undefined) } }))
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
    case 'bible': {
      // Scripture is immutable per translation, so successful responses are
      // safe to cache at the edge for a week and on-device indefinitely.
      const [, sub] = segs(ctx)
      const immutable = { 'cache-control': 'public, max-age=86400, s-maxage=604800, immutable' }
      try {
        if (sub === 'versions') return json({ versions: BIBLE_VERSIONS }, { headers: immutable })
        if (sub === 'books') {
          const res: any = await getBibleBooks({ data: { version: q.get('version') ?? '' } })
          return json(res, { status: res.error ? 502 : 200, headers: res.error ? {} : immutable })
        }
        if (sub === 'chapter') {
          const res: any = await getBibleChapter({ data: { version: q.get('version') ?? '', book: q.get('book') ?? '', chapter: num(q.get('chapter') ?? undefined) } })
          return json(res, { status: res.error ? 502 : 200, headers: res.error ? {} : immutable })
        }
        return json({ ok: false, error: 'Expected /bible/versions, /bible/books or /bible/chapter.' }, { status: 404 })
      } catch {
        return json({ ok: false, error: 'Invalid Bible request. Check version, book and chapter.' }, { status: 400 })
      }
    }
    case 'stream': {
      // GET /api/mobile/stream/<movie|teaching|video|episode>/<id>
      // Entitlement-checked playback payload for the native (expo-video)
      // player. Gating is delegated to the detail loaders so this can never
      // leak a URL the detail endpoint would have stripped.
      const [, type, rawId] = segs(ctx)
      const id = num(rawId)
      if (!type || !id) return json({ ok: false, error: 'Expected /stream/<movie|teaching|video|episode>/<id>.' }, { status: 400 })
      // Native HLS needs the library's pull-zone host (Stream → API in the
      // Bunny dashboard); admins set it as the `bunny_pull_zone` setting.
      // Without it we still return embed + direct URLs as fallbacks.
      const pullZone = await first<any>(`SELECT val FROM settings WHERE name = 'bunny_pull_zone' AND deleted_at IS NULL`).then(row => String(row?.val ?? '').trim()).catch(() => '')
      const pullHost = /^[a-z0-9-]+\.b-cdn\.net$/i.test(pullZone) ? pullZone : null
      const shape = (item: any, libraryId: string | null) => {
        if (!item) return null
        const videoId = typeof item.bunny_video_url === 'string' && item.bunny_video_url.trim() ? item.bunny_video_url.trim() : null
        const directUrl = typeof item.video_url_input === 'string' && /^https:\/\//i.test(item.video_url_input) ? item.video_url_input : null
        const base = { title: item.name ?? '', duration: item.duration ?? null, poster: item.thumbnail_url ?? item.poster_url ?? null }
        if (!videoId && !directUrl) return { ...base, locked: true }
        return {
          ...base,
          locked: false,
          provider: videoId && libraryId ? 'bunny' : 'direct',
          libraryId: videoId ? libraryId : null,
          videoId,
          hls: videoId && pullHost ? `https://${pullHost}/${videoId}/playlist.m3u8` : null,
          seekSheetBase: videoId && pullHost ? `https://${pullHost}/${videoId}/seek/` : null,
          embed: videoId && libraryId ? `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}` : null,
          directUrl,
          subtitles: item.enable_subtitle && typeof item.subtitle_file === 'string' && item.subtitle_file
            ? [{ url: item.subtitle_file, language: String(item.subtitle_language || 'en') }]
            : [],
        }
      }
      if (type === 'movie' || type === 'sermon' || type === 'title') {
        const data: any = await getMovie({ data: id }).catch(() => null)
        const payload = shape(data?.movie, data?.bunnyLibraryId ?? null)
        return payload ? json(payload) : json({ ok: false, error: 'Not found.' }, { status: 404 })
      }
      if (type === 'teaching' || type === 'tv-show' || type === 'show') {
        const data: any = await getTvShow({ data: id }).catch(() => null)
        const payload = shape(data?.show, data?.bunnyLibraryId ?? null)
        return payload ? json(payload) : json({ ok: false, error: 'Not found.' }, { status: 404 })
      }
      if (type === 'video') {
        const data: any = await getVideo({ data: id }).catch(() => null)
        const payload = shape(data?.video, data?.bunnyLibraryId ?? null)
        return payload ? json(payload) : json({ ok: false, error: 'Not found.' }, { status: 404 })
      }
      if (type === 'episode') {
        const episode: any = await first(`SELECT * FROM episodes WHERE id = ? AND deleted_at IS NULL`, id)
        if (!episode) return json({ ok: false, error: 'Not found.' }, { status: 404 })
        const data: any = await getTvShow({ data: episode.entertainment_id }).catch(() => null)
        // Gate through the parent's episode list; if gating stripped this
        // episode (locked), report it locked rather than leaking the raw row.
        const gated = (data?.episodes ?? []).find((e: any) => e.id === episode.id)
        const payload = shape(gated ?? { name: episode.name, thumbnail_url: episode.thumbnail_url, poster_url: episode.poster_url, duration: episode.duration }, data?.bunnyLibraryId ?? null)
        return json(payload)
      }
      return json({ ok: false, error: `Unknown stream type: ${type}` }, { status: 404 })
    }
    case 'shop':
      if (second === 'products') return json(await getStoreProducts())
      if (second === 'cart') return json(await getStoreCart())
      return json({ ok: false, error: `Unknown endpoint: shop/${second ?? ''}` }, { status: 404 })
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
    case 'shop':
      switch (second) {
        case 'cart': return json(await updateStoreCart({ data: body }))
        case 'quote': return json(await quoteStoreCheckout({ data: body }))
        case 'checkout': return json(await startStoreCheckout({ data: body }))
        default: return json({ ok: false, error: 'Unknown shop action.' }, { status: 404 })
      }
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
      OPTIONS: handleOptions,
    },
  },
})
