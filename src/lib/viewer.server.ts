import { all, first } from './db'
import { getSession, setSessionCookie } from './session.server'

export type ActiveViewer = {
  userId: number
  profileId: number | null
  profileName: string | null
  avatar?: string | null
}

export type ViewerProfile = {
  id: number
  name: string
  avatar: string | null
  is_child_profile: number
}

function validId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

async function authenticatedSession() {
  const session = await getSession()
  if (!session || !validId(session.uid)) return null
  const user = await first<{ id: number }>(
    `SELECT id FROM users WHERE id = ? AND deleted_at IS NULL AND status = 1 AND COALESCE(is_banned, 0) = 0`,
    session.uid,
  )
  return user ? session : null
}

async function ownedProfile(userId: number, profileId: number) {
  return first<ViewerProfile>(
    `SELECT id, name, avatar, is_child_profile FROM user_multi_profiles WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    profileId, userId,
  )
}

/** No implicit fallback: an absent/stale profile must be selected before personalized reads/writes. */
export async function getActiveViewer(): Promise<ActiveViewer | null> {
  const session = await authenticatedSession()
  if (!session) return null
  const profile = validId(session.pid) ? await ownedProfile(session.uid, session.pid) : null
  return { userId: session.uid, profileId: profile?.id ?? null, profileName: profile?.name ?? null, avatar: profile?.avatar ?? null }
}

export async function readViewerState(): Promise<{ viewer: ActiveViewer; profiles: ViewerProfile[] } | null> {
  const viewer = await getActiveViewer()
  if (!viewer) return null
  const profiles = await all<ViewerProfile>(
    `SELECT id, name, avatar, is_child_profile FROM user_multi_profiles WHERE user_id = ? AND deleted_at IS NULL ORDER BY id ASC`,
    viewer.userId,
  )
  return { viewer, profiles }
}

export async function selectOwnedViewerProfile(profileId: unknown) {
  const session = await authenticatedSession()
  if (!session) return { ok: false as const, needsAuth: true, error: 'Sign in again to choose a profile.' }
  if (!validId(profileId)) return { ok: false as const, error: 'Choose a valid profile.' }
  const profile = await ownedProfile(session.uid, profileId)
  if (!profile) return { ok: false as const, error: 'This profile is no longer available. Refresh your profiles and try again.' }
  await setSessionCookie({ ...session, pid: profile.id })
  return { ok: true as const, viewer: { userId: session.uid as number, profileId: profile.id, profileName: profile.name } }
}
