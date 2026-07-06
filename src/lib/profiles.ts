import Dexie from 'dexie'

/**
 * Local profiles: each profile owns a separate IndexedDB database, so all
 * data (workouts, food, recipes, settings…) is fully isolated per person.
 * The registry lives in localStorage because the active profile must be
 * known synchronously, before the Dexie singleton is constructed.
 */

export interface Profile {
  id: string
  name: string
  color: string
  createdAt: number
}

const PROFILES_KEY = 'liftlog.profiles'
const ACTIVE_KEY = 'liftlog.activeProfile'

/** avatar colors, rotating through the categorical palette */
export const PROFILE_COLORS = ['#3987e5', '#1baf7a', '#eda100', '#9085e9', '#e66767', '#d55181', '#d95926']

export function dbName(profileId: string): string {
  // 'default' keeps the original database name so existing installs migrate for free
  return profileId === 'default' ? 'liftlog' : `liftlog-${profileId}`
}

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (raw) {
      const list = JSON.parse(raw) as Profile[]
      if (Array.isArray(list) && list.length > 0) return list
    }
  } catch {
    // corrupted registry — fall through and reseed
  }
  const first: Profile = { id: 'default', name: 'Me', color: PROFILE_COLORS[0], createdAt: Date.now() }
  saveProfiles([first])
  return [first]
}

function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export function getActiveProfile(): Profile {
  const profiles = loadProfiles()
  const id = localStorage.getItem(ACTIVE_KEY)
  return profiles.find((p) => p.id === id) ?? profiles[0]
}

export function renameProfile(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  saveProfiles(loadProfiles().map((p) => (p.id === id ? { ...p, name: trimmed } : p)))
}

export function createProfile(name: string): void {
  const profiles = loadProfiles()
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: name.trim() || `Profile ${profiles.length + 1}`,
    color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
    createdAt: Date.now(),
  }
  saveProfiles([...profiles, profile])
  localStorage.setItem(ACTIVE_KEY, profile.id)
  reloadToHome()
}

export function switchProfile(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id)
  reloadToHome()
}

/** land on the dashboard after a profile change (reload alone would keep the current hash route) */
function reloadToHome(): void {
  location.hash = '#/'
  location.reload()
}

/** Deletes the profile AND its database. Refuses to delete the last profile. */
export async function deleteProfile(id: string): Promise<void> {
  const profiles = loadProfiles()
  if (profiles.length <= 1) return
  await Dexie.delete(dbName(id))
  const remaining = profiles.filter((p) => p.id !== id)
  saveProfiles(remaining)
  if (!remaining.some((p) => p.id === localStorage.getItem(ACTIVE_KEY))) {
    localStorage.setItem(ACTIVE_KEY, remaining[0].id)
    reloadToHome()
  }
}
