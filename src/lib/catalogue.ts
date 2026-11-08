import { createServerFn } from '@tanstack/react-start'
import type { Content } from './api'
import { all, first } from './db'
import { getActiveViewer } from './viewer.server'
import { catalogueCategories, catalogueYears, type CatalogueCategory } from './catalogueFilters'

export type CatalogueKind = 'sermons' | 'shows' | 'teachings' | 'series'
export type CatalogueTitle = Content & {
  categories: CatalogueCategory[]
  genre_names: string
  trailer_url: string | null
  bunny_video_url: string | null
  bunny_trailer_url: string | null
  video_url_input: string | null
  video_upload_type: string | null
}

const types = { sermons: 'movie', shows: 'tvshow', teachings: 'teaching', series: 'tvshow' } as const

export const getCatalogue = createServerFn({ method: 'GET' })
  .validator((kind: CatalogueKind): CatalogueKind => {
    if (!Object.prototype.hasOwnProperty.call(types, kind)) throw new Error('Choose a valid catalogue.')
    return kind
  })
  .handler(async ({ data: kind }) => {
    const viewer = await getActiveViewer()
    const profile = viewer?.profileId ? await first<{ is_child_profile: number }>(
      'SELECT is_child_profile FROM user_multi_profiles WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      viewer.profileId, viewer.userId,
    ) : null
    const child = profile?.is_child_profile ? 1 : 0
    // Series is the episodic subset of Shows, not a new/invented content type.
    const rows = await all<Omit<CatalogueTitle, 'categories' | 'genre_names'> & { categories_json: string }>(
      `SELECT e.id, e.name, e.slug, e.description, e.type, e.poster_url, e.thumbnail_url,
        e.release_date, e.IMDb_rating, e.duration, e.language, e.movie_access, e.content_rating,
        e.trailer_url, e.bunny_video_url, e.bunny_trailer_url, e.video_url_input, e.video_upload_type,
        (SELECT json_group_array(json_object('id', category.id, 'name', category.name))
          FROM (SELECT DISTINCT g.id, g.name FROM genres g
            JOIN entertainment_gener_mapping m ON m.genre_id = g.id
            WHERE m.entertainment_id = e.id AND m.deleted_at IS NULL
              AND g.status = 1 AND g.deleted_at IS NULL AND TRIM(COALESCE(g.name, '')) != '') category
        ) AS categories_json
       FROM entertainments e
       WHERE e.type = ? AND e.status = 1 AND e.deleted_at IS NULL AND TRIM(COALESCE(e.name, '')) != ''
         AND (? = 0 OR COALESCE(e.is_restricted, 0) = 0)
         AND (? = 0 OR EXISTS (
           SELECT 1 FROM episodes ep JOIN seasons s ON s.id = ep.season_id AND s.entertainment_id = e.id
           WHERE ep.entertainment_id = e.id AND ep.status = 1 AND ep.deleted_at IS NULL
             AND s.status = 1 AND s.deleted_at IS NULL AND (? = 0 OR COALESCE(ep.is_restricted, 0) = 0)
         ))
       ORDER BY e.name COLLATE NOCASE, e.id`,
      types[kind], child, kind === 'series' ? 1 : 0, child,
    )
    const items: CatalogueTitle[] = rows.map(({ categories_json, ...item }) => {
      const categories = catalogueCategories([{ categories: JSON.parse(categories_json || '[]') as CatalogueCategory[] }])
      return { ...item, categories, genre_names: categories.map(category => category.name).join(',') }
    })
    // Facets come from the entire visible catalogue, never just the first page or current results.
    return { items, categories: catalogueCategories(items), years: catalogueYears(items) }
  })
