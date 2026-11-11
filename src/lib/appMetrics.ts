import { createServerFn } from '@tanstack/react-start'
import { all, first } from './db'
import { getActiveViewer } from './viewer.server'

async function requireAdmin() {
  const viewer = await getActiveViewer()
  if (!viewer || !(await first(`SELECT id FROM users WHERE id=? AND user_type='admin' AND status=1 AND deleted_at IS NULL`, viewer.userId))) {
    throw new Error('Administrator access required.')
  }
}

// Admin app metrics (ticket 11): every number comes from real app_events rows
// ingested via /api/mobile/events. Empty state before any data exists.
export const getAppMetrics = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const [totals, daily, topTitles] = await Promise.all([
    all<any>(`SELECT name, COUNT(*) AS events, COUNT(DISTINCT install_id) AS installs
      FROM app_events WHERE created_at >= datetime('now','-7 days') GROUP BY name ORDER BY events DESC`),
    all<any>(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS events
      FROM app_events WHERE created_at >= datetime('now','-14 days') GROUP BY day ORDER BY day ASC`),
    all<any>(`SELECT json_extract(payload, '$.content_type') AS content_type,
        json_extract(payload, '$.content_id') AS content_id, COUNT(*) AS plays
      FROM app_events WHERE name = 'play_start' AND created_at >= datetime('now','-30 days')
      GROUP BY content_type, content_id ORDER BY plays DESC LIMIT 10`),
  ])
  // Resolve content names for the top-played titles.
  const titles = [] as { name: string; type: string; plays: number }[]
  for (const row of topTitles) {
    let name = `${row.content_type} #${row.content_id}`
    if (row.content_type === 'video') {
      const v = await first<any>(`SELECT name FROM videos WHERE id = ?`, Number(row.content_id)).catch(() => null)
      if (v?.name) name = v.name
    } else if (row.content_type === 'episode') {
      const e = await first<any>(`SELECT name FROM episodes WHERE id = ?`, Number(row.content_id)).catch(() => null)
      if (e?.name) name = e.name
    } else {
      const c = await first<any>(`SELECT name FROM entertainments WHERE id = ?`, Number(row.content_id)).catch(() => null)
      if (c?.name) name = c.name
    }
    titles.push({ name, type: row.content_type, plays: Number(row.plays) })
  }
  return { totals, daily, titles }
})
