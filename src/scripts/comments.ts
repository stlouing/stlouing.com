import { SITE_NAME } from '../../site.config.mjs'
import { browserId } from './browser-id'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const STORE_KEY = 'stl_comments'
const PAGE_SIZE = 20

const LINK_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|biz|xyz|top|site|online|shop|club|io|ru)\b)/i

type CommentEntry = {
  id: number
  name: string
  message: string
  created_at: string
  author_reply: string | null
  author_reply_at: string | null
  total: number
}

const AUTHOR_FLEUR =
  '<svg class="feed-fleur" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 192" fill="currentColor" aria-hidden="true"><use href="#fleur-glyph"/></svg>'

type CommentsStore = { name?: string }

export function initComments(): void {
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

  const anchorLink = document.querySelector<HTMLElement>('[data-comments-link]')
  const anchorLabel = document.querySelector<HTMLElement>('[data-comments-link-label]')
  const anchorCellValue = document.querySelector<HTMLElement>('[data-comments-cell-value]')

  anchorLink?.addEventListener('click', () => {
    const pageElement = document.documentElement
    pageElement.style.scrollBehavior = 'auto'
    window.requestAnimationFrame(() => {
      pageElement.style.scrollBehavior = ''
    })
  })

  const rememberedName = loadStore().name
  if (nameInput && rememberedName && !nameInput.value) {
    nameInput.value = rememberedName
  }

  let shown = 0
  let total = 0

  const renderCount = (): void => {
    if (countLabel) {
      countLabel.textContent = total === 0 ? '' : total === 1 ? '1 comment' : `${total} comments`
    }
    if (anchorLabel) {
      anchorLabel.textContent =
        total === 0 ? 'Comments' : total === 1 ? '1 comment' : `${total} comments`
    }
    if (anchorCellValue) {
      anchorCellValue.textContent =
        total === 0 ? 'Leave a comment' : total === 1 ? '1 comment' : `${total} comments`
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

  void loadPage()
    .then(() => {
      root.hidden = false
      if (anchorLink) {
        anchorLink.hidden = false
      }
    })
    .catch(() => {})

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

      entriesList.prepend(
        buildEntry({
          id: 0,
          name,
          message,
          created_at: new Date().toISOString(),
          author_reply: null,
          author_reply_at: null,
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

function buildEntry(entry: CommentEntry): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'feed-entry'

  const commenter = document.createElement('p')
  commenter.className = 'feed-byline'

  const nameLabel = document.createElement('span')
  nameLabel.className = 'feed-name title-serif'
  nameLabel.textContent = entry.name
  commenter.append(nameLabel)

  commenter.append(buildDate(entry.created_at))

  item.append(commenter)

  const message = document.createElement('p')
  message.className = 'feed-message excerpt'
  message.textContent = entry.message
  item.append(message)

  if (entry.author_reply) {
    item.append(buildReply(entry.author_reply, entry.author_reply_at))
  }

  return item
}

function buildDate(isoDate: string): HTMLSpanElement {
  const date = document.createElement('span')
  date.className = 'feed-date'
  date.textContent = formatPostedDate(isoDate)

  return date
}

function buildReply(replyMessage: string, replyDate: string | null): HTMLDivElement {
  const reply = document.createElement('div')
  reply.className = 'feed-reply'

  const author = document.createElement('p')
  author.className = 'feed-byline'
  author.innerHTML = AUTHOR_FLEUR

  const authorName = document.createElement('span')
  authorName.className = 'feed-name title-serif'
  authorName.textContent = SITE_NAME
  author.append(authorName)

  if (replyDate) {
    author.append(buildDate(replyDate))
  }

  reply.append(author)

  const message = document.createElement('p')
  message.className = 'feed-message excerpt'
  message.textContent = replyMessage
  reply.append(message)

  return reply
}

function formatPostedDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function fetchEntries(kind: string, slug: string, offset: number): Promise<CommentEntry[]> {
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

function authHeaders(): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY }
}

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
  } catch {}
}
