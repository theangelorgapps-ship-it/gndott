import { createFileRoute } from '@tanstack/react-router'

// OAuth return point for the native app. The Better Auth callback has already
// set the session cookie by the time the browser lands here; hand the token to
// the app via its deep-link scheme (never to any other origin).
export const Route = createFileRoute('/auth/mobile-complete')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const cookie = request.headers.get('cookie') ?? ''
        const match = cookie.match(/(?:__Secure-)?halobox-viewer\.session_token=([^;]+)/)
        if (match?.[1]) {
          return Response.redirect(`halobox://auth?token=${encodeURIComponent(match[1])}`, 302)
        }
        return Response.redirect('https://halobox.tv/login?mobile=1', 302)
      },
    },
  },
})
