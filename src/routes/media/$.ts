import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

export const Route = createFileRoute('/media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = (params as any)._splat ?? (params as any)['*']
        if (!key) return new Response('not found', { status: 404 })
        const obj = await (env as any).MEDIA.get(key)
        if (!obj) return new Response('not found', { status: 404 })
        return new Response(obj.body, {
          headers: {
            'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
            'cache-control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
