import { all } from './db'
import { parseHeroDesign } from './hero-design'

export const HERO_PLACEMENTS = ['home', 'movie', 'tv_show', 'teaching', 'video'] as const
/** Only published designs activate the new hero authoring flow. No paid media URLs leave this query. */
export async function loadConfiguredHeroes(placement: string, child = false): Promise<any[]> {
  if (!HERO_PLACEMENTS.includes(placement as any)) throw new Error('Unknown hero placement.')
  const rows = await all<any>(`
    SELECT b.id AS banner_id, b.type_id AS id, b.type, b.file_url AS banner_image, b.poster_url AS banner_phone,
      d.design_json, COALESCE(e.name,v.name) AS name, COALESCE(e.slug,v.slug) AS slug,
      COALESCE(e.description,v.description) AS description, COALESCE(e.poster_url,v.poster_url) AS poster_url,
      COALESCE(e.thumbnail_url,v.thumbnail_url) AS thumbnail_url, COALESCE(e.release_date,v.release_date) AS release_date,
      COALESCE(e.duration,v.duration) AS duration, COALESCE(e.movie_access,v.access) AS movie_access,
      COALESCE(e.trailer_url,v.trailer_url) AS trailer_url, e.bunny_trailer_url,
      CASE WHEN COALESCE(e.movie_access,v.access) = 'free' THEN COALESCE(e.video_url_input,v.video_url_input) ELSE NULL END AS video_url_input
    FROM banners b JOIN banner_designs d ON d.banner_id=b.id
    LEFT JOIN entertainments e ON b.type != 'video' AND e.id=b.type_id AND e.type=b.type AND e.status=1 AND e.deleted_at IS NULL
    LEFT JOIN videos v ON b.type='video' AND v.id=b.type_id AND v.status=1 AND v.deleted_at IS NULL
    WHERE b.status=1 AND b.deleted_at IS NULL AND b.banner_for=? AND (e.id IS NOT NULL OR v.id IS NOT NULL)
      AND (?=0 OR COALESCE(e.is_restricted,v.is_restricted,0)=0)
    ORDER BY b.id LIMIT 10`, placement, child ? 1 : 0)
  return rows.map(({ design_json, banner_image, banner_phone, ...item }) => ({
    ...item, thumbnail_url: banner_image || item.thumbnail_url, poster_url: banner_phone || item.poster_url,
    hero_design: parseHeroDesign(design_json),
  }))
}
