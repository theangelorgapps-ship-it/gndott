import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { ImagePipelineError, ownedAvifObject } from '../../lib/imageProcessing.server'
import { externalArtwork } from '../../lib/externalArtwork.server'

export const Route = createFileRoute('/media/$')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const key = (params as any)._splat ?? (params as any)['*']
        if (!key) return new Response('not found', { status: 404 })
        let obj
        try {
          obj = key === 'external'
            ? await externalArtwork(new URL(request.url).searchParams.get('url') ?? '', env)
            : await ownedAvifObject(key, env)
        } catch (error) { return new Response('Image unavailable', {status:503,headers:{'cache-control':'no-store','x-image-error':error instanceof ImagePipelineError ? error.stage : 'processing'}}) }
        if (!obj) return new Response('not found', { status: 404 })
        return new Response(obj.body, {
          headers: {
            'content-type': 'image/avif',
            'cache-control': 'public, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
            etag: obj.httpEtag ?? `"${obj.etag}"`,
          },
        })
      },
    },
  },
})
