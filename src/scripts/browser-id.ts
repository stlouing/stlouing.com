const ID_KEY = 'stl_browser_id'

export function browserId(): string {
  try {
    const existing = window.localStorage.getItem(ID_KEY)
    if (existing) {
      return existing
    }

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
