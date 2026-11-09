import { createFileRoute } from '@tanstack/react-router'
import { loadConfiguredHeroes, HERO_PLACEMENTS } from '../../lib/heroes.server'
export const Route = createFileRoute('/api/heroes')({ server: { handlers: { GET: async ({ request }) => {
  const placement = new URL(request.url).searchParams.get('placement') || 'home'
  if (!HERO_PLACEMENTS.includes(placement as any)) return Response.json({ error: 'Unknown placement.' }, { status: 400 })
  const items = await loadConfiguredHeroes(placement, true)
  return Response.json({ version: 1, placement, items }, { headers: { 'Cache-Control': 'public, max-age=30', 'X-Content-Type-Options': 'nosniff' } })
} } } })
