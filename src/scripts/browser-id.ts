// One stable anonymous id per browser, shared by every Supabase-backed feature
// (readers-verdict votes, guestbook signatures, whatever comes next) so the
// same visitor is one identity across tables. Kept behind try/catch so
// private-mode storage denial can't break the features — a fresh id per call
// just means the server treats the browser as new.

const ID_KEY = 'stl_browser_id'

export function browserId(): string {
  try {
    const existing = window.localStorage.getItem(ID_KEY)
    if (existing) {
      return existing
    }

    // Browsers that voted before the id was unified keep their reader identity.
    const created = legacyVoterId() ?? crypto.randomUUID()
    window.localStorage.setItem(ID_KEY, created)

    return created
  } catch {
    return crypto.randomUUID()
  }
}

function legacyVoterId(): string | null {
  try {
    const raw = window.localStorage.getItem('stl_reader')
    const voterId = raw ? (JSON.parse(raw) as { voterId?: unknown }).voterId : undefined

    return typeof voterId === 'string' && voterId.length > 0 ? voterId : null
  } catch {
    return null
  }
}
