import { browserId } from './browser-id'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const STORE_KEY = 'stl_reader'

type Counts = { likes: number; dislikes: number }

type Choice = 'like' | 'dislike'

type PlaceState = { vote?: Choice }

type ReaderStore = { voterId?: string; places?: Record<string, PlaceState> }

export function initReadersVerdict(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return
  }

  const roots = [...document.querySelectorAll<HTMLElement>('[data-readers-verdict]')]
  for (const root of roots) {
    setupWidget(root)
  }
}

function setupWidget(root: HTMLElement): void {
  const slug = root.dataset.slug
  if (!slug) {
    return
  }

  const likeButton = root.querySelector<HTMLButtonElement>('[data-vote="like"]')
  const dislikeButton = root.querySelector<HTMLButtonElement>('[data-vote="dislike"]')
  const likeCount = root.querySelector<HTMLElement>('[data-count-like]')
  const dislikeCount = root.querySelector<HTMLElement>('[data-count-dislike]')
  const cta = root.querySelector<HTMLElement>('[data-cta]')
  const voteStatus = root.querySelector<HTMLElement>('[data-vote-status]')

  if (!likeButton || !dislikeButton) {
    return
  }

  let choice = readChoice(slug)
  let counts: Counts = { likes: 0, dislikes: 0 }
  let loaded = false
  let votedThisSession = false

  const render = (): void => {
    likeButton.classList.toggle('is-active', choice === 'like')
    dislikeButton.classList.toggle('is-active', choice === 'dislike')
    likeButton.setAttribute('aria-pressed', String(choice === 'like'))
    dislikeButton.setAttribute('aria-pressed', String(choice === 'dislike'))

    if (likeCount) {
      likeCount.textContent = loaded && counts.likes > 0 ? String(counts.likes) : ''
    }
    if (dislikeCount) {
      dislikeCount.textContent = loaded && counts.dislikes > 0 ? String(counts.dislikes) : ''
    }

    if (cta) {
      if (choice) {
        cta.hidden = true
      } else {
        cta.hidden = false
        const total = counts.likes + counts.dislikes
        cta.textContent =
          loaded && total === 0
            ? 'Been here? What did you think?'
            : 'Been here? What did you think?'
      }
    }
  }

  const vote = async (next: Choice): Promise<void> => {
    if (choice) {
      return
    }

    choice = next
    writeChoice(slug, next)
    setStatus(voteStatus, '')
    lockButtons()
    render()

    try {
      counts = await castVote({ slug, liked: next === 'like' })
      votedThisSession = true
      loaded = true
      render()
    } catch {
      choice = null
      clearChoice(slug)
      likeButton.disabled = false
      dislikeButton.disabled = false
      render()
      setStatus(voteStatus, "Couldn't record your vote, please try again.")
    }
  }

  const lockButtons = (): void => {
    likeButton.disabled = true
    dislikeButton.disabled = true
  }

  likeButton.addEventListener('click', () => {
    void vote('like')
  })
  dislikeButton.addEventListener('click', () => {
    void vote('dislike')
  })

  if (!choice) {
    likeButton.disabled = false
    dislikeButton.disabled = false
  }
  render()

  void fetchCounts(slug)
    .then((live) => {
      if (votedThisSession) {
        return
      }

      counts = live
      loaded = true
      render()
    })
    .catch(() => {})
}

async function fetchCounts(slug: string): Promise<Counts> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/get_counts?p_slug=${encodeURIComponent(slug)}`
  const response = await fetch(url, { headers: authHeaders() })

  if (!response.ok) {
    throw new Error(`get_counts responded ${response.status}`)
  }

  const rows = (await response.json()) as Array<{ likes: number | null; dislikes: number | null }>

  return toCounts(rows[0])
}

async function castVote(input: { slug: string; liked: boolean }): Promise<Counts> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cast_vote`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: input.slug, p_liked: input.liked, p_voter_id: voterId() }),
  })

  if (!response.ok) {
    throw new Error(`cast_vote responded ${response.status}`)
  }

  const rows = (await response.json()) as Array<{ likes: number | null; dislikes: number | null }>

  return toCounts(rows[0])
}

function authHeaders(): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY }
}

function toCounts(row: { likes: number | null; dislikes: number | null } | undefined): Counts {
  return { likes: Number(row?.likes ?? 0), dislikes: Number(row?.dislikes ?? 0) }
}

function loadStore(): ReaderStore {
  const raw = safeGet(STORE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as ReaderStore

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveStore(store: ReaderStore): void {
  safeSet(STORE_KEY, JSON.stringify(store))
}

function readPlace(slug: string): PlaceState {
  return loadStore().places?.[slug] ?? {}
}

function patchPlace(slug: string, patch: PlaceState): void {
  const store = loadStore()
  const places = store.places ?? {}
  const next: PlaceState = { ...places[slug], ...patch }

  if (!next.vote) {
    delete next.vote
  }

  if (Object.keys(next).length > 0) {
    places[slug] = next
  } else {
    delete places[slug]
  }

  store.places = places
  saveStore(store)
}

function voterId(): string {
  return browserId()
}

function readChoice(slug: string): Choice | null {
  const vote = readPlace(slug).vote

  return vote === 'like' || vote === 'dislike' ? vote : null
}

function writeChoice(slug: string, choice: Choice): void {
  patchPlace(slug, { vote: choice })
}

function clearChoice(slug: string): void {
  patchPlace(slug, { vote: undefined })
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
