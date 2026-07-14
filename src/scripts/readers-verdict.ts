// Readers' Verdict — a per-restaurant 👍/👎 poll backed by Supabase (PostgREST).
// A browser identifies itself with a random voter_id kept in localStorage, so it votes
// once per place (re-votable, upserted server-side), the tally is live, and an optional
// private note (name + comment) can be attached. No third-party SDK — just fetch against
// the anon REST API, which is safe because the table is RLS-locked behind cast_vote().

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

// localStorage keys: one stable browser id, plus a remembered choice per slug (the FE's
// only way to show "you voted" — there's no reliable server-side "is it you" without login).
const VOTER_ID_KEY = 'stl_voter_id'
const VOTE_CHOICE_PREFIX = 'stl_vote_'
const NOTE_DONE_PREFIX = 'stl_noted_'

type Counts = { likes: number; dislikes: number }

type Choice = 'like' | 'dislike'

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

  const buttonsWrap = root.querySelector<HTMLElement>('.rv-buttons')
  const votedMessage = root.querySelector<HTMLElement>('[data-voted]')
  const likeButton = root.querySelector<HTMLButtonElement>('[data-vote="like"]')
  const dislikeButton = root.querySelector<HTMLButtonElement>('[data-vote="dislike"]')
  const likeCount = root.querySelector<HTMLElement>('[data-count-like]')
  const dislikeCount = root.querySelector<HTMLElement>('[data-count-dislike]')
  const barFill = root.querySelector<HTMLElement>('[data-bar-fill]')
  const question = root.querySelector<HTMLElement>('.vb-question')
  const defaultQuestion = question?.textContent?.trim() ?? ''
  const votedQuestion = question?.dataset.votedQuestion ?? ''
  const summary = root.querySelector<HTMLElement>('[data-summary]')
  const note = root.querySelector<HTMLElement>('[data-note]')
  const voteStatus = root.querySelector<HTMLElement>('[data-vote-status]')
  const noteForm = root.querySelector<HTMLFormElement>('[data-note-form]')
  const nameInput = root.querySelector<HTMLInputElement>('[data-note-name]')
  const commentInput = root.querySelector<HTMLTextAreaElement>('[data-note-comment]')
  const honeypot = root.querySelector<HTMLInputElement>('[data-note-hp]')
  const noteStatus = root.querySelector<HTMLElement>('[data-note-status]')
  const noteThanks = root.querySelector<HTMLElement>('[data-note-thanks]')
  // The top-of-page teaser (a page-level element, outside this root). Its CTA invites a
  // vote by default, but should point to the results once this browser has voted.
  const teaserCta = document.querySelector<HTMLElement>('[data-teaser-cta]')
  const teaserDefaultCta = teaserCta?.textContent?.trim() ?? ''

  if (!likeButton || !dislikeButton || !barFill || !summary) {
    return
  }

  // The browser's remembered choice for this place (drives the active state + "you voted").
  let choice = readChoice(slug)
  let counts: Counts = { likes: 0, dislikes: 0 }
  // Whether we've shown real server counts yet, and whether a vote this session already
  // produced the authoritative tally (so a late initial fetch mustn't clobber it).
  let loaded = false
  let votedThisSession = false

  // Paint the current numbers, bar, active button, and summary line.
  const render = (): void => {
    const total = counts.likes + counts.dislikes
    const likePercent = total > 0 ? Math.round((counts.likes / total) * 100) : 0

    if (likeCount) {
      likeCount.textContent = String(counts.likes)
    }

    if (dislikeCount) {
      dislikeCount.textContent = String(counts.dislikes)
    }

    barFill.style.width = `${likePercent}%`
    likeButton.classList.toggle('is-active', choice === 'like')
    dislikeButton.classList.toggle('is-active', choice === 'dislike')
    likeButton.setAttribute('aria-pressed', String(choice === 'like'))
    dislikeButton.setAttribute('aria-pressed', String(choice === 'dislike'))

    let segments: string[]
    if (!loaded) {
      segments = [`Readers' Review`]
    } else if (total === 0) {
      segments = [`Readers' Review`, 'be the first to vote']
    } else {
      const votes = total === 1 ? '1 vote' : `${total} votes`
      segments = [`Readers Review`, `${likePercent}% liked it`, votes]
    }

    // Each ·-part is its own span so flex-wrap on the container keeps parts whole.
    summary.replaceChildren(
      ...segments.map((segment, index) => {
        const span = document.createElement('span')
        span.textContent = index === 0 ? segment : `· ${segment}`

        return span
      }),
    )

    // Keep the top-of-page teaser CTA in step with the vote state.
    if (teaserCta) {
      teaserCta.textContent = choice ? (teaserCta.dataset.votedText ?? teaserDefaultCta) : teaserDefaultCta
    }

    // The question becomes a statement once they've answered it.
    if (question && votedQuestion) {
      question.textContent = choice ? votedQuestion : defaultQuestion
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
      setStatus(voteStatus, "Couldn't record your vote — try again.")
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

  // The optional note appears after voting (revealNote).
  noteForm?.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault()
    void submitNote()
  })

  const submitNote = async (): Promise<void> => {
    // Honeypot: a real person never fills the hidden field. Pretend success, do nothing.
    if (honeypot?.value) {
      setStatus(noteStatus, 'Thanks!')

      return
    }

    const name = nameInput?.value.trim() ?? ''
    const comment = commentInput?.value.trim() ?? ''

    // Name is required only when a comment is present (mirrors the server rule).
    if (comment && !name) {
      setStatus(noteStatus, 'Add your name to leave a comment.')
      nameInput?.focus()

      return
    }

    if (!name && !comment) {
      setStatus(noteStatus, '')

      return
    }

    try {
      await addNote({ slug, name: name || null, comment: comment || null })
      writeNoted(slug)
      clearNoteForm()
      showNoteThanks()
    } catch {
      setStatus(noteStatus, "Couldn't save that — try again.")
    }
  }

  // Once a note is saved the reader is done: swap the form for the thank-you, and swap
  // the (locked) buttons for a plain statement so they don't read as still-clickable.
  // Called on submit and on reload for a returning voter who already noted.
  const showNoteThanks = (): void => {
    if (noteForm) {
      noteForm.hidden = true
    }
    if (noteThanks) {
      noteThanks.hidden = false
    }
    if (choice && buttonsWrap && votedMessage) {
      votedMessage.textContent = choice === 'like' ? 'You liked it. Thanks for voting!' : "You didn't like it. Thanks for voting!"
      votedMessage.hidden = false
      buttonsWrap.hidden = true
    }
  }

  const clearNoteForm = (): void => {
    if (commentInput) {
      commentInput.value = ''
    }
    if (nameInput) {
      nameInput.value = ''
    }
    setStatus(noteStatus, '')
  }

  // Wire up: enable the buttons only if this browser hasn't voted yet; a returning voter
  // stays locked in. Then load live counts and restore the remembered state.
  if (choice) {
    revealNote(note)
    if (readNoted(slug)) {
      showNoteThanks()
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

// A stable per-browser id. Kept behind try/catch so private-mode storage denial can't
// break voting outright (a fresh id per call just means the server treats it as new).
function voterId(): string {
  const existing = safeGet(VOTER_ID_KEY)
  if (existing) {
    return existing
  }

  const created = crypto.randomUUID()
  safeSet(VOTER_ID_KEY, created)

  return created
}

function readChoice(slug: string): Choice | null {
  const stored = safeGet(VOTE_CHOICE_PREFIX + slug)

  return stored === 'like' || stored === 'dislike' ? stored : null
}

function writeChoice(slug: string, choice: Choice): void {
  safeSet(VOTE_CHOICE_PREFIX + slug, choice)
}

function clearChoice(slug: string): void {
  safeRemove(VOTE_CHOICE_PREFIX + slug)
}

function readNoted(slug: string): boolean {
  return safeGet(NOTE_DONE_PREFIX + slug) === '1'
}

function writeNoted(slug: string): void {
  safeSet(NOTE_DONE_PREFIX + slug, '1')
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

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage blocked — nothing to remove.
  }
}
