import { all, first } from './db'
import { safePersonalityLink, type Personality, type PersonalityDetail, type PersonalityLink, type TitleLocation } from './personalityData'

// Keep the exclusion even when a location is unpublished or deleted. Its legacy
// source record is retained for audit and must never reappear as a personality.
const PUBLIC_PERSON = `c.status = 1 AND c.deleted_at IS NULL AND NOT EXISTS
  (SELECT 1 FROM locations l WHERE l.source_cast_crew_id = c.id)`

export async function loadPersonalities(limit = 500): Promise<Personality[]> {
  return all<Personality>(`SELECT c.id, c.name, c.file_url, c.designation, c.type FROM cast_crew c
    WHERE ${PUBLIC_PERSON} ORDER BY CASE
      WHEN c.name LIKE '%Uebert Angel%' THEN 0
      WHEN c.name LIKE '%Neviah%' THEN 1
      ELSE 2
    END, c.id LIMIT ?`, Math.min(500, Math.max(1, limit)))
}

export async function loadPersonalityDetail(id: number): Promise<PersonalityDetail | null> {
  if (!Number.isSafeInteger(id) || id < 1) return null
  const person = await first<Personality>(`SELECT c.id, c.name, c.file_url, c.type, c.bio, c.place_of_birth, c.dob, c.designation
    FROM cast_crew c WHERE c.id = ? AND ${PUBLIC_PERSON}`, id)
  if (!person) return null
  const [works, links] = await Promise.all([
    all(`SELECT DISTINCT e.id, e.name, e.type, e.poster_url, e.IMDb_rating
      FROM entertainment_talent_mapping m JOIN entertainments e ON e.id = m.entertainment_id
      WHERE m.talent_id = ? AND m.deleted_at IS NULL AND e.status = 1 AND e.deleted_at IS NULL ORDER BY e.id DESC LIMIT 24`, id),
    all<PersonalityLink>(`SELECT provider, url FROM personality_social_links WHERE personality_id = ? ORDER BY provider`, id),
  ])
  return { person, works, links: links.filter(link => safePersonalityLink(link)) }
}

export async function loadTitlePeople(entertainmentId: number): Promise<Personality[]> {
  return all<Personality>(`SELECT DISTINCT c.id, c.name, c.type, c.file_url, c.designation FROM cast_crew c
    JOIN entertainment_talent_mapping m ON m.talent_id = c.id
    WHERE m.entertainment_id = ? AND m.deleted_at IS NULL AND ${PUBLIC_PERSON} ORDER BY c.id LIMIT 50`, entertainmentId)
}

export async function loadTitleLocations(contentType: 'entertainment' | 'video' | 'episode', contentId: number): Promise<TitleLocation[]> {
  return all<TitleLocation>(`SELECT l.id, l.name, l.file_url, l.description, l.address FROM locations l
    JOIN content_location_mapping m ON m.location_id = l.id
    WHERE m.content_type = ? AND m.content_id = ? AND l.status = 1 AND l.deleted_at IS NULL ORDER BY l.name`, contentType, contentId)
}
