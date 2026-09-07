// Comments — per-page reader comments on topic, food, and neighborhood pages,
// backed by Supabase (PostgREST). Same shape as guestbook.ts: no third-party
// SDK, just fetch against the anon REST API, which is safe because the table is
// RLS-locked behind SECURITY DEFINER functions. Comments are public and render
// immediately; the server rate-limits and validates. Pages are keyed by
// (kind, slug) because topic ids, food ids, and neighborhood slugs are separate
// namespaces that can collide.

import { browserId } from './browser-id'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const STORE_KEY = 'stl_comments'
const PAGE_SIZE = 20

// Mirrors the server's no-links rule (add_comment rejects URLs) so an honest
// commenter gets a clear message instead of a generic failure. Keep the two
// patterns in sync — the SQL function (scripts/db/comments.sql, in the private
// parent folder) is the real enforcement.
const LINK_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|biz|xyz|top|site|online|shop|club|io|ru)\b)/i

type CommentEntry = {
  id: number
  name: string
  message: string
  created_at: string
  total: number
}

type CommentsStore = {
  // The commenter's name, remembered after a successful post so the field is
  // prefilled next time. Multiple comments per browser are allowed — a comment
  // thread is a conversation, so there is no guestbook-style one-post gate.
  name?: string
}

export function initComments(): void {
  // Nothing to wire when the site was built without Supabase creds — the
  // component renders nothing in that case, but guard anyway so a stray root
  // is a no-op.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return
  }

  const roots = [...document.querySelectorAll<HTMLElement>('[data-comments]')]
  for (const root of roots) {
    setupComments(root)
  }
}

function setupComments(root: HTMLElement): void {
  const kind = root.dataset.kind
  const slug = root.dataset.slug
  if (!kind || !slug) {
    return
  }

  const entriesList = root.querySelector<HTMLElement>('[data-entries]')
  const emptyLine = root.querySelector<HTMLElement>('[data-empty]')
  const countLabel = root.querySelector<HTMLElement>('[data-count]')
  const olderButton = root.querySelector<HTMLButtonElement>('[data-older]')
  const loadStatus = root.querySelector<HTMLElement>('[data-load-status]')

  const form = root.querySelector<HTMLFormElement>('[data-form]')
  const nameInput = root.querySelector<HTMLInputElement>('[data-name]')
  const messageInput = root.querySelector<HTMLTextAreaElement>('[data-message]')
  const honeypot = root.querySelector<HTMLInputElement>('[data-hp]')
  const submitButton = root.querySelector<HTMLButtonElement>('[data-submit]')
  const formStatus = root.querySelector<HTMLElement>('[data-form-status]')

  if (!entriesList) {
    return
  }

  // The masthead's "Comments" anchor pill (topic pages only; one comments
  // section per page, so a document-wide query is safe). Ships hidden and is
  // revealed with the section; its label carries the live count.
  const anchorLink = document.querySelector<HTMLElement>('[data-comments-link]')
  const anchorLabel = document.querySelector<HTMLElement>('[data-comments-link-label]')

  // Jump, don't glide: the site's global `scroll-behavior: smooth` animates
  // anchor jumps, and on a long article the ride to the foot of the page is
  // slow enough that browsers abandon it partway. Suspend smooth scrolling for
  // this one click — the browser then jumps instantly, with the hash, :target,
  // and scroll-margin behavior all intact.
  anchorLink?.addEventListener('click', () => {
    const pageElement = document.documentElement
    pageElement.style.scrollBehavior = 'auto'
    window.requestAnimationFrame(() => {
      pageElement.style.scrollBehavior = ''
    })
  })

  // A returning commenter gets their name back.
  const rememberedName = loadStore().name
  if (nameInput && rememberedName && !nameInput.value) {
    nameInput.value = rememberedName
  }

  // How many comments the list currently shows, and the server's total —
  // together they drive the count line and whether "Show older" has anything
  // left to fetch.
  let shown = 0
  let total = 0

  const renderCount = (): void => {
    if (countLabel) {
      countLabel.textContent =
        total === 0 ? '' : total === 1 ? '1 comment' : `${total} comments`
    }
    if (anchorLabel) {
      anchorLabel.textContent =
        total === 0 ? 'Comments' : total === 1 ? '1 comment' : `${total} comments`
    }
    if (emptyLine) {
      emptyLine.hidden = total > 0
    }
    if (olderButton) {
      olderButton.hidden = shown >= total
    }
  }

  const appendEntries = (entries: CommentEntry[]): void => {
    for (const entry of entries) {
      entriesList.append(buildEntry(entry))
    }
    shown += entries.length
  }

  const loadPage = async (): Promise<void> => {
    const entries = await fetchEntries(kind, slug, shown)

    if (entries.length > 0) {
      total = entries[0].total
    } else if (shown === 0) {
      total = 0
    }

    appendEntries(entries)
    renderCount()
  }

  // First page. The whole section ships hidden and only reveals once the read
  // works, so a build deployed before the SQL exists (or an offline visit)
  // shows nothing rather than an error line on every page of the site.
  void loadPage()
    .then(() => {
      root.hidden = false
      if (anchorLink) {
        anchorLink.hidden = false
      }
    })
    .catch(() => {
      // RPC missing / offline — the section (and the anchor pill) stays hidden.
    })

  olderButton?.addEventListener('click', () => {
    olderButton.disabled = true
    void loadPage()
      .catch(() => {
        setStatus(loadStatus, "Couldn't load older comments.")
      })
      .finally(() => {
        olderButton.disabled = false
      })
  })

  form?.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault()
    void post()
  })

  const post = async (): Promise<void> => {
    // Honeypot: a real person never fills the hidden field. Pretend success, do nothing.
    if (honeypot?.value) {
      if (messageInput) {
        messageInput.value = ''
      }
      setStatus(formStatus, 'Posted!')

      return
    }

    const name = nameInput?.value.trim() ?? ''
    const message = messageInput?.value.trim() ?? ''

    if (!name || !message) {
      setStatus(formStatus, 'Please enter your name and comment.')

      return
    }

    if (LINK_PATTERN.test(`${name} ${message}`)) {
      setStatus(formStatus, "Links can't be posted in comments.")

      return
    }

    if (submitButton) {
      submitButton.disabled = true
    }
    setStatus(formStatus, 'Posting…')

    try {
      await addComment({ kind, slug, name, message })

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

      const store = loadStore()
      store.name = name
      saveStore(store)

      if (messageInput) {
        messageInput.value = ''
      }
      setStatus(formStatus, 'Posted!')
    } catch {
      setStatus(formStatus, "Couldn't post. Try again later!")
    } finally {
      if (submitButton) {
        submitButton.disabled = false
      }
    }
  }
}

// One <li> per comment, built with createElement/textContent only — comment text
// is reader-supplied and must never pass through innerHTML.
function buildEntry(entry: CommentEntry): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'cm-entry'

  const date = document.createElement('p')
  date.className = 'cm-date eyebrow'
  date.textContent = formatPostedDate(entry.created_at)
  item.append(date)

  const commenter = document.createElement('p')
  commenter.className = 'cm-commenter'

  const nameLabel = document.createElement('span')
  nameLabel.className = 'cm-name title-serif'
  nameLabel.textContent = entry.name
  commenter.append(nameLabel)

  item.append(commenter)

  const message = document.createElement('p')
  message.className = 'cm-message'
  message.textContent = entry.message
  item.append(message)

  return item
}

// Comment timestamps are real instants, not date-only frontmatter, so unlike the
// shared formatDate they render in the reader's own zone (a UTC pin would show
// "tomorrow" for an evening comment in St. Louis).
function formatPostedDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function fetchEntries(kind: string, slug: string, offset: number): Promise<CommentEntry[]> {
  // get_comments is a STABLE definer function, so it's callable over a cacheable GET.
  const url =
    `${SUPABASE_URL}/rest/v1/rpc/get_comments` +
    `?p_kind=${encodeURIComponent(kind)}&p_slug=${encodeURIComponent(slug)}` +
    `&p_limit=${PAGE_SIZE}&p_offset=${offset}`
  const response = await fetch(url, { headers: authHeaders() })

  if (!response.ok) {
    throw new Error(`get_comments responded ${response.status}`)
  }

  return (await response.json()) as CommentEntry[]
}

async function addComment(input: {
  kind: string
  slug: string
  name: string
  message: string
}): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_comment`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_kind: input.kind,
      p_slug: input.slug,
      p_name: input.name,
      p_message: input.message,
      p_commenter_id: commenterId(),
    }),
  })

  if (!response.ok) {
    throw new Error(`add_comment responded ${response.status}`)
  }
}

// Anonymous access rides in the `apikey` header only (see readers-verdict.ts for
// why there's no Bearer Authorization header).
function authHeaders(): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY }
}

// The shared per-browser id (see browser-id.ts).
function commenterId(): string {
  return browserId()
}

function loadStore(): CommentsStore {
  const raw = safeGet(STORE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as CommentsStore

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveStore(store: CommentsStore): void {
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
