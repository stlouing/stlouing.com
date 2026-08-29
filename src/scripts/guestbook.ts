// Guestbook — the sign-the-book page, backed by Supabase (PostgREST). Same shape
// as readers-verdict.ts: no third-party SDK, just fetch against the anon REST API,
// which is safe because the table is RLS-locked behind SECURITY DEFINER functions.
// Entries are public and render immediately; the server rate-limits and validates.

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const STORE_KEY = 'stl_guestbook'
const PAGE_SIZE = 20

// Mirrors the server's no-links rule (sign_guestbook rejects URLs) so an honest
// signer gets a clear message instead of a generic failure. Keep the two
// patterns in sync — the SQL function is the real enforcement.
const LINK_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|biz|xyz|top|site|online|shop|club|io|ru)\b)/i

type GuestbookEntry = {
  id: number
  name: string
  message: string
  created_at: string
  total: number
}

type GuestbookStore = {
  signerId?: string
}

export function initGuestbook(): void {
  // Nothing to wire when the site was built without Supabase creds — the page
  // renders a fallback line in that case, but guard anyway so a stray root is a no-op.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return
  }

  const root = document.querySelector<HTMLElement>('[data-guestbook]')
  if (!root) {
    return
  }

  setupGuestbook(root)
}

function setupGuestbook(root: HTMLElement): void {
  const entriesList = root.querySelector<HTMLElement>('[data-entries]')
  const emptyLine = root.querySelector<HTMLElement>('[data-empty]')
  const countLabel = root.querySelector<HTMLElement>('[data-count]')
  const olderButton = root.querySelector<HTMLButtonElement>('[data-older]')
  const loadStatus = root.querySelector<HTMLElement>('[data-load-status]')

  const form = root.querySelector<HTMLFormElement>('[data-sign-form]')
  const nameInput = root.querySelector<HTMLInputElement>('[data-sign-name]')
  const messageInput = root.querySelector<HTMLTextAreaElement>('[data-sign-message]')
  const honeypot = root.querySelector<HTMLInputElement>('[data-sign-hp]')
  const submitButton = root.querySelector<HTMLButtonElement>('[data-sign-submit]')
  const signStatus = root.querySelector<HTMLElement>('[data-sign-status]')

  if (!entriesList) {
    return
  }

  // How many entries the list currently shows, and the server's total — together
  // they drive the count line and whether "Show older" has anything left to fetch.
  let shown = 0
  let total = 0

  const renderCount = (): void => {
    if (countLabel) {
      countLabel.textContent =
        total === 0 ? '' : total === 1 ? '1 message' : `${total} messages`
    }
    if (emptyLine) {
      emptyLine.hidden = total > 0
    }
    if (olderButton) {
      olderButton.hidden = shown >= total
    }
  }

  const appendEntries = (entries: GuestbookEntry[]): void => {
    for (const entry of entries) {
      entriesList.append(buildEntry(entry))
    }
    shown += entries.length
  }

  const loadPage = async (): Promise<void> => {
    const entries = await fetchEntries(shown)

    if (entries.length > 0) {
      total = entries[0].total
    } else if (shown === 0) {
      total = 0
    }

    appendEntries(entries)
    renderCount()
  }

  // First page. On failure keep the shell quiet except for one muted line.
  void loadPage().catch(() => {
    setStatus(loadStatus, "Couldn't load the guestbook.")
  })

  olderButton?.addEventListener('click', () => {
    olderButton.disabled = true
    void loadPage()
      .catch(() => {
        setStatus(loadStatus, "Couldn't load older entries.")
      })
      .finally(() => {
        olderButton.disabled = false
      })
  })

  form?.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault()
    void sign()
  })

  const sign = async (): Promise<void> => {
    // Honeypot: a real person never fills the hidden field. Pretend success, do nothing.
    if (honeypot?.value) {
      setStatus(signStatus, 'Thanks for signing!')

      return
    }

    const name = nameInput?.value.trim() ?? ''
    const message = messageInput?.value.trim() ?? ''

    if (!name || !message) {
      setStatus(signStatus, 'Please enter your name and message.')

      return
    }

    if (LINK_PATTERN.test(`${name} ${message}`)) {
      setStatus(signStatus, "Links can't be posted in the guestbook.")

      return
    }

    if (submitButton) {
      submitButton.disabled = true
    }
    setStatus(signStatus, 'Signing…')

    try {
      await signGuestbook({ name, message })

      // The server accepted it — show it at the top right away rather than re-fetching.
      entriesList.prepend(
        buildEntry({
          id: 0,
          name,
          message,
          created_at: new Date().toISOString(),
          total: 0,
        }),
      )
      shown += 1
      total += 1
      renderCount()
      form?.reset()
      setStatus(signStatus, 'Thanks for signing!')
    } catch {
      setStatus(signStatus, "Couldn't sign. Try again later!")
    } finally {
      if (submitButton) {
        submitButton.disabled = false
      }
    }
  }
}

// One <li> per signature, built with createElement/textContent only — entry text is
// reader-supplied and must never pass through innerHTML.
function buildEntry(entry: GuestbookEntry): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'gb-entry'

  const date = document.createElement('p')
  date.className = 'gb-date eyebrow'
  date.textContent = formatSignedDate(entry.created_at)
  item.append(date)

  const signer = document.createElement('p')
  signer.className = 'gb-signer'

  const nameLabel = document.createElement('span')
  nameLabel.className = 'gb-name title-serif'
  nameLabel.textContent = entry.name
  signer.append(nameLabel)

  item.append(signer)

  const message = document.createElement('p')
  message.className = 'gb-message'
  message.textContent = entry.message
  item.append(message)

  return item
}

// Guestbook timestamps are real instants, not date-only frontmatter, so unlike the
// shared formatDate they render in the reader's own zone (a UTC pin would show
// "tomorrow" for an evening signature in St. Louis).
function formatSignedDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function fetchEntries(offset: number): Promise<GuestbookEntry[]> {
  // get_guestbook is a STABLE definer function, so it's callable over a cacheable GET.
  const url = `${SUPABASE_URL}/rest/v1/rpc/get_guestbook?p_limit=${PAGE_SIZE}&p_offset=${offset}`
  const response = await fetch(url, { headers: authHeaders() })

  if (!response.ok) {
    throw new Error(`get_guestbook responded ${response.status}`)
  }

  return (await response.json()) as GuestbookEntry[]
}

async function signGuestbook(input: { name: string; message: string }): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sign_guestbook`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_name: input.name,
      p_message: input.message,
      p_signer_id: signerId(),
    }),
  })

  if (!response.ok) {
    throw new Error(`sign_guestbook responded ${response.status}`)
  }
}

// Anonymous access rides in the `apikey` header only (see readers-verdict.ts for
// why there's no Bearer Authorization header).
function authHeaders(): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY }
}

// A stable per-browser id, kept in its own store so this module stays independent
// of the readers-verdict one. Storage denial just means a fresh id per call, which
// the server simply treats as a new signer.
function signerId(): string {
  const store = loadStore()
  if (store.signerId) {
    return store.signerId
  }

  const created = crypto.randomUUID()
  store.signerId = created
  saveStore(store)

  return created
}

function loadStore(): GuestbookStore {
  const raw = safeGet(STORE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as GuestbookStore

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveStore(store: GuestbookStore): void {
  safeSet(STORE_KEY, JSON.stringify(store))
}

function setStatus(element: HTMLElement | null, message: string): void {
  if (element) {
    element.textContent = message
  }
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked (private mode / disabled) — nothing to persist.
  }
}
