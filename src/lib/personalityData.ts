export type Personality = {
  id: number
  name: string
  file_url?: string | null
  designation?: string | null
  type?: string | null
  bio?: string | null
  dob?: string | null
  place_of_birth?: string | null
}

export type PersonalityLink = { provider: string; url: string }
export type TitleLocation = { id: number; name: string; file_url?: string | null; description?: string | null; address?: string | null }
export type PersonalityDetail = { person: Personality; works: any[]; links: PersonalityLink[] }

const SOCIAL_HOSTS: Record<string, string[]> = {
  facebook: ['facebook.com', 'www.facebook.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
}

/** Only explicit public links are displayed. Never derive an account from a name. */
export function safePersonalityLink(link: PersonalityLink): string | null {
  try {
    const url = new URL(link.url)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (link.provider === 'website' || SOCIAL_HOSTS[link.provider]?.includes(url.hostname)) return url.href
  } catch { /* Invalid stored URLs are not navigation targets. */ }
  return null
}

export function personalityRole(person: Personality): string | null {
  return person.designation?.trim() || (person.type === 'director' ? 'Director' : null)
}

export function personalityBirthDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || date > new Date()) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}
