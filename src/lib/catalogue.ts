import { loadConfiguredHeroes } from './heroes.server'
import { createServerFn } from '@tanstack/react-start'
import type { Content } from './api'
import { all } from './db'
import { buildCatalogueRecommendations } from './recommendations'
import { isChildViewer, loadRecommendationSignals } from './recommendations.server'
import { getActiveViewer } from './viewer.server'
import { catalogueCategories, catalogueYears, type CatalogueCategory } from './catalogueFilters'

export type CatalogueKind = 'sermons' | 'shows' | 'teachings' | 'series' | 'videos'
export type CatalogueTitle = Content & {
  categories: CatalogueCategory[]
  genre_names: string
  trailer_url: string | null
  bunny_video_url: string | null
  bunny_trailer_url: string | null
  video_url_input: string | null
  video_upload_type: string | null
}

const types = { sermons: 'movie', shows: 'tvshow', teachings: 'teaching', series: 'tvshow', videos: 'video' } as const

export const getCatalogue = createServerFn({ method: 'GET' })
  .validator((kind: CatalogueKind): CatalogueKind => {
    if (!Object.prototype.hasOwnProperty.call(types, kind)) throw new Error('Choose a valid catalogue.')
    return kind
  })
  .handler(async ({ data: kind }) => {
    const viewer = await getActiveViewer()
    const child = await isChildViewer(viewer) ? 1 : 0
    // Series is the episodic subset of Shows, not a new/invented content type.
    type CatalogueRow = Omit<CatalogueTitle, 'categories' | 'genre_names'> & { categories_json: string; total_views?: number; created_at?: string; updated_at?: string }
    const rows = kind === 'videos' ? await all<CatalogueRow>(
      `SELECT v.id, v.name, v.slug, v.description, 'video' AS type, v.poster_url, v.thumbnail_url,
        v.release_date, v.IMDb_rating, v.duration, NULL AS language, v.access AS movie_access, v.content_rating,
        v.trailer_url, NULL AS bunny_video_url, NULL AS bunny_trailer_url, CASE WHEN v.access = 'free' THEN v.video_url_input ELSE NULL END AS video_url_input, v.video_upload_type,
        (SELECT json_group_array(json_object('id', category.id, 'name', category.name))
          FROM (SELECT DISTINCT g.id, g.name FROM genres g
            JOIN video_gener_mappings m ON m.genre_id = g.id
            WHERE m.video_id = v.id AND m.deleted_at IS NULL
              AND g.status = 1 AND g.deleted_at IS NULL AND TRIM(COALESCE(g.name, '')) != '') category
        ) AS categories_json
       FROM videos v
       WHERE v.status = 1 AND v.deleted_at IS NULL AND TRIM(COALESCE(v.name, '')) != ''
         AND (? = 0 OR COALESCE(v.is_restricted, 0) = 0)
       ORDER BY v.name COLLATE NOCASE, v.id`, child,
    ) : await all<CatalogueRow>(
      `SELECT e.id, e.name, e.slug, e.description, e.type, e.poster_url, e.thumbnail_url,
        e.release_date, e.IMDb_rating, e.duration, e.language, e.movie_access, e.content_rating,
        e.total_views, e.created_at, e.updated_at,
        e.trailer_url, NULL AS bunny_video_url, e.bunny_trailer_url, CASE WHEN e.movie_access = 'free' THEN e.video_url_input ELSE NULL END AS video_url_input, e.video_upload_type,
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
    const candidates = rows.map(({ categories_json, ...item }) => {
      const categories = catalogueCategories([{ categories: JSON.parse(categories_json || '[]') as CatalogueCategory[] }])
      return { ...item, categories, genre_names: categories.map(category => category.name).join(',') }
    })
    const signals = kind === 'sermons' || kind === 'teachings'
      ? await loadRecommendationSignals(viewer, !!child) : null
    const ranked = signals ? buildCatalogueRecommendations(candidates, signals.history, { saved: signals.saved }) : null
    // Return ordering, never profile history, preference weights or private ranking metadata.
    const publicTitle = ({ total_views: _views, created_at: _created, updated_at: _updated, ...item }: typeof candidates[number]): CatalogueTitle => item
    const items = (ranked?.items ?? candidates).map(publicTitle)
    const suggestions = ranked?.suggestions.map(publicTitle) ?? []
    // Facets come from the entire visible catalogue, never just the first page or current results.
    const configured = await loadConfiguredHeroes(kind === 'shows' || kind === 'series' ? 'tv_show' : types[kind], !!child)
    const heroes = configured.filter(hero => items.some(item => item.id === hero.id && item.type === hero.type))
    return { items, heroes, suggestions, personalized: ranked?.personalized ?? false, categories: catalogueCategories(items), years: catalogueYears(items) }
  })
