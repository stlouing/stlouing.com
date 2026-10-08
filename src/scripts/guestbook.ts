import { browserId } from './browser-id'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const STORE_KEY = 'stl_guestbook'
const PAGE_SIZE = 20

const LINK_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|biz|xyz|top|site|online|shop|club|io|ru)\b)/i

type GuestbookEntry = {
  id: number
  name: string
  message: string
  created_at: string
  total: number
}

type GuestbookStore = { signed?: boolean }

export function initGuestbook(): void {
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

  const signPanel = root.querySelector<HTMLElement>('[data-sign-panel]')
  const form = root.querySelector<HTMLFormElement>('[data-sign-form]')
  const nameInput = root.querySelector<HTMLInputElement>('[data-sign-name]')
  const messageInput = root.querySelector<HTMLTextAreaElement>('[data-sign-message]')
  const honeypot = root.querySelector<HTMLInputElement>('[data-sign-hp]')
  const submitButton = root.querySelector<HTMLButtonElement>('[data-sign-submit]')
  const signStatus = root.querySelector<HTMLElement>('[data-sign-status]')
  const signedNote = root.querySelector<HTMLElement>('[data-signed-note]')

  if (!entriesList) {
    return
  }

  if (loadStore().signed && signPanel) {
    signPanel.hidden = true
  }

  const markSigned = (): void => {
    const store = loadStore()
    store.signed = true
    saveStore(store)

    if (form) {
      form.hidden = true
    }
    if (signedNote) {
      signedNote.hidden = false
    }
  }

  let shown = 0
  let total = 0

  const renderCount = (): void => {
    if (countLabel) {
      countLabel.textContent = total === 0 ? '' : total === 1 ? '1 message' : `${total} messages`
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
    if (honeypot?.value) {
      markSigned()

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

      entriesList.prepend(
        buildEntry({ id: 0, name, message, created_at: new Date().toISOString(), total: 0 }),
      )
      shown += 1
      total += 1
      renderCount()
      markSigned()
    } catch {
      setStatus(signStatus, "Couldn't sign. Try again later!")
    } finally {
      if (submitButton) {
        submitButton.disabled = false
      }
    }
  }
}

function buildEntry(entry: GuestbookEntry): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'feed-entry'

  const date = document.createElement('p')
  date.className = 'feed-date eyebrow'
  date.textContent = formatSignedDate(entry.created_at)
  item.append(date)

  const signer = document.createElement('p')
  signer.className = 'feed-byline'

  const nameLabel = document.createElement('span')
  nameLabel.className = 'feed-name title-serif'
  nameLabel.textContent = entry.name
  signer.append(nameLabel)

  item.append(signer)

  const message = document.createElement('p')
  message.className = 'feed-message excerpt'
  message.textContent = entry.message
  item.append(message)

  return item
}

function formatSignedDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function fetchEntries(offset: number): Promise<GuestbookEntry[]> {
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
    body: JSON.stringify({ p_name: input.name, p_message: input.message, p_signer_id: signerId() }),
  })

  if (!response.ok) {
    throw new Error(`sign_guestbook responded ${response.status}`)
  }
}

function authHeaders(): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY }
}

function signerId(): string {
  return browserId()
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
  } catch {}
}
