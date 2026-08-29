// Readers' Verdict — a per-restaurant 👍/👎 poll backed by Supabase (PostgREST).
// A browser identifies itself with a random voter_id kept in localStorage, so it votes
// once per place (re-votable, upserted server-side), the tally is live, and an optional
// private note (name + comment) can be attached. No third-party SDK — just fetch against
// the anon REST API, which is safe because the table is RLS-locked behind cast_vote().

import { browserId } from './browser-id'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

// All reader state lives under ONE localStorage key: a stable browser id plus a
// per-slug record (vote, whether a note was left, whether the note form was
// collapsed). One object instead of three keys per place.
const STORE_KEY = 'stl_reader'

type Counts = { likes: number; dislikes: number }

type Choice = 'like' | 'dislike'

// One place's remembered state; absent fields mean "no". Purely a client-side
// convenience (the vote also lives server-side under the voter id) — the collapse
// flag never leaves the browser.
type PlaceState = {
  vote?: Choice
  noted?: boolean
  collapsed?: boolean
}

type ReaderStore = {
  voterId?: string
  places?: Record<string, PlaceState>
}

export function initReadersVerdict(): void {
  // Nothing to wire when the site was built without Supabase creds — the component
  // renders nothing in that case, but guard anyway so a stray root is a no-op.
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
  const note = root.querySelector<HTMLElement>('[data-note]')
  const voteStatus = root.querySelector<HTMLElement>('[data-vote-status]')
  const noteForm = root.querySelector<HTMLFormElement>('[data-note-form]')
  const noteTrigger = root.querySelector<HTMLButtonElement>('[data-note-trigger]')
  const noteClose = root.querySelector<HTMLButtonElement>('[data-note-close]')
  const nameInput = root.querySelector<HTMLInputElement>('[data-note-name]')
  const commentInput = root.querySelector<HTMLTextAreaElement>('[data-note-comment]')
  const honeypot = root.querySelector<HTMLInputElement>('[data-note-hp]')
  const noteStatus = root.querySelector<HTMLElement>('[data-note-status]')

  if (!likeButton || !dislikeButton) {
    return
  }

  // The browser's remembered choice for this place (drives the active state + "you voted").
  let choice = readChoice(slug)
  let counts: Counts = { likes: 0, dislikes: 0 }
  // Whether we've shown real server counts yet, and whether a vote this session already
  // produced the authoritative tally (so a late initial fetch mustn't clobber it).
  let loaded = false
  let votedThisSession = false

  // Paint the active side of the pill, the counts (never a bare "0"), and the pre-vote
  // nudge. Counts stay blank (the `:empty` rule hides them) until a server read lands.
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

    // The nudge is hidden once this browser has voted.
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

  // One vote each: casting locks this browser in. Optimistically flips + disables the
  // buttons, then trusts the tallies the server returns.
  const vote = async (next: Choice): Promise<void> => {
    if (choice) {
      // Already voted — locked in.
      return
    }

    choice = next
    writeChoice(slug, next)
    setStatus(voteStatus, '')
    lockButtons()
    render()
    revealNote(note)
    // A fresh vote opens the note expanded, inviting a comment.
    setCollapsed(false)

    try {
      counts = await castVote({ slug, liked: next === 'like' })
      votedThisSession = true
      loaded = true
      render()
    } catch {
      // Never reached the server — roll back so a transient failure stays retryable.
      choice = null
      clearChoice(slug)
      hideNote(note)
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

  // Toggle the note between its full form and the compact "Leave a comment" trigger.
  // The collapsed choice is remembered in localStorage, so it sticks across reloads.
  const setCollapsed = (collapsed: boolean): void => {
    if (noteForm) {
      noteForm.hidden = collapsed
    }
    if (noteTrigger) {
      noteTrigger.hidden = !collapsed
    }
  }

  noteForm?.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault()
    void submitNote()
  })

  noteClose?.addEventListener('click', () => {
    writeCollapsed(slug)
    setCollapsed(true)
  })

  noteTrigger?.addEventListener('click', () => {
    clearCollapsed(slug)
    setCollapsed(false)
    nameInput?.focus()
  })

  const submitNote = async (): Promise<void> => {
    // Honeypot: a real person never fills the hidden field. Pretend success, do nothing.
    if (honeypot?.value) {
      setStatus(noteStatus, 'Thanks!')

      return
    }

    const name = nameInput?.value.trim() ?? ''
    const comment = commentInput?.value.trim() ?? ''

    if (!name && !comment) {
      setStatus(noteStatus, '')

      return
    }

    // The name is optional; an unnamed note is attributed to "Anonymous" (which
    // also satisfies the server's name-required-with-comment rule). Once saved, the
    // reader is done — the note area collapses away (no confirmation line).
    try {
      await addNote({ slug, name: name || 'Anonymous', comment: comment || null })
      writeNoted(slug)
      hideNote(note)
    } catch {
      setStatus(noteStatus, "Couldn't save that — try again.")
    }
  }

  // Wire up: enable the buttons only if this browser hasn't voted yet; a returning voter
  // stays locked in. The note form shows only for a voter who hasn't left one yet. Then
  // load live counts.
  if (choice) {
    if (!readNoted(slug)) {
      revealNote(note)
      // Honor the reader's remembered collapse choice for this place.
      setCollapsed(readCollapsed(slug))
    }
  } else {
    likeButton.disabled = false
    dislikeButton.disabled = false
  }
  render()

  void fetchCounts(slug)
    .then((live) => {
      // A vote already gave us the authoritative tally — don't clobber it with a read
      // that was in flight before the vote landed.
      if (votedThisSession) {
        return
      }

      counts = live
      loaded = true
      render()
    })
    .catch(() => {
      // Offline / creds wrong — keep the zeroed shell rather than erroring in the reader's face.
    })
}

async function fetchCounts(slug: string): Promise<Counts> {
  // get_counts is a STABLE definer function, so it's callable over a cacheable GET.
  const url = `${SUPABASE_URL}/rest/v1/rpc/get_counts?p_slug=${encodeURIComponent(slug)}`
  const response = await fetch(url, { headers: authHeaders() })

  if (!response.ok) {
    throw new Error(`get_counts responded ${response.status}`)
  }

  const rows = (await response.json()) as Array<{ likes: number | null; dislikes: number | null }>

  return toCounts(rows[0])
}

// A vote: create-or-switch the caller's row. Returns the fresh tallies.
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

// Attach (or clear) the private note on the caller's existing vote. The server UPDATEs
// in place and refuses when there's no vote yet — so a note can only follow a vote, and
// it never touches the tally.
async function addNote(input: {
  slug: string
  name: string | null
  comment: string | null
}): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_note`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_slug: input.slug,
      p_voter_id: voterId(),
      p_name: input.name,
      p_comment: input.comment,
    }),
  })

  if (!response.ok) {
    throw new Error(`add_note responded ${response.status}`)
  }
}

// Anonymous access rides in the `apikey` header only. This works for both the newer
// sb_publishable_… key (which isn't a JWT, so it must NOT go in a Bearer Authorization
// header) and the legacy anon JWT. PostgREST falls back to the anon role when there's no
// user token, which is exactly what our SECURITY DEFINER functions are granted to.
function authHeaders(): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY }
}

function toCounts(row: { likes: number | null; dislikes: number | null } | undefined): Counts {
  return { likes: Number(row?.likes ?? 0), dislikes: Number(row?.dislikes ?? 0) }
}

// --- The single-object store (STORE_KEY) --------------------------------------

function loadStore(): ReaderStore {
  const raw = safeGet(STORE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as ReaderStore

    // Only a plain object is a valid store; anything else (null, array, scalar
    // from external tampering) resets to empty so writes still persist.
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

// Merge a patch into one place's record. Falsy fields are pruned so the object
// stays tidy, and a place that empties out is dropped entirely.
function patchPlace(slug: string, patch: PlaceState): void {
  const store = loadStore()
  const places = store.places ?? {}
  const next: PlaceState = { ...places[slug], ...patch }

  if (!next.vote) {
    delete next.vote
  }
  if (!next.noted) {
    delete next.noted
  }
  if (!next.collapsed) {
    delete next.collapsed
  }

  if (Object.keys(next).length > 0) {
    places[slug] = next
  } else {
    delete places[slug]
  }

  store.places = places
  saveStore(store)
}

// The shared per-browser id (see browser-id.ts); the store's legacy voterId
// field is adopted by it, so pre-unification voters keep their identity.
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

function readNoted(slug: string): boolean {
  return readPlace(slug).noted === true
}

function writeNoted(slug: string): void {
  patchPlace(slug, { noted: true })
}

function readCollapsed(slug: string): boolean {
  return readPlace(slug).collapsed === true
}

function writeCollapsed(slug: string): void {
  patchPlace(slug, { collapsed: true })
}

function clearCollapsed(slug: string): void {
  patchPlace(slug, { collapsed: false })
}

function revealNote(note: HTMLElement | null): void {
  if (note) {
    note.hidden = false
  }
}

function hideNote(note: HTMLElement | null): void {
  if (note) {
    note.hidden = true
  }
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

