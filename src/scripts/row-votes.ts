import {
  castVote,
  clearChoice,
  readChoice,
  readChoices,
  writeChoice,
  type Choice,
} from './reader-votes'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const STATUS_DURATION_MS = 3000

type ReaderScore = { slug: string; score: number }

export function initRowVotes(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return
  }

  const rows = [...document.querySelectorAll<HTMLElement>('tr[data-slug]')]
  const status = document.querySelector<HTMLElement>('[data-row-vote-status]')
  const rowsBySlug = new Map(rows.map((row) => [row.dataset.slug ?? '', row]))
  const votedThisSession = new Set<string>()
  let statusTimer: number | undefined

  const announce = (message: string): void => {
    if (!status) {
      return
    }

    window.clearTimeout(statusTimer)
    status.textContent = message
    statusTimer = window.setTimeout(() => {
      status.textContent = ''
    }, STATUS_DURATION_MS)
  }

  const choices = readChoices()
  for (const row of rows) {
    renderChoice(row, choices[row.dataset.slug ?? ''] ?? null)
    setBusy(row, false)
  }

  const vote = async (row: HTMLElement, choice: Choice): Promise<void> => {
    const slug = row.dataset.slug
    const previous = slug ? readChoice(slug) : null
    if (!slug || previous === choice) {
      return
    }

    votedThisSession.add(slug)
    writeChoice(slug, choice)
    renderChoice(row, choice)
    setBusy(row, true)

    try {
      const counts = await castVote({ slug, liked: choice === 'like' })
      renderScore(row, counts.likes - counts.dislikes)
      announce(`${choice === 'like' ? 'Voted up' : 'Voted down'} ${placeName(row)}`)
    } catch {
      votedThisSession.delete(slug)
      if (previous) {
        writeChoice(slug, previous)
      } else {
        clearChoice(slug)
      }
      renderChoice(row, previous)
      announce("Couldn't record your vote, please try again.")
    } finally {
      setBusy(row, false)
    }
  }

  rows[0]?.parentElement?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-row-vote]')
    const row = button?.closest<HTMLElement>('tr[data-slug]')
    if (button && row) {
      void vote(row, button.dataset.rowVote as Choice)
    }
  })

  void fetchReaderScores()
    .then((scores) => {
      for (const { slug, score } of scores) {
        const row = rowsBySlug.get(slug)
        if (row && !votedThisSession.has(slug)) {
          renderScore(row, Number(score))
        }
      }
      resortByScore()
    })
    .catch(() => {})
}

function voteButtons(row: HTMLElement): NodeListOf<HTMLButtonElement> {
  return row.querySelectorAll<HTMLButtonElement>('[data-row-vote]')
}

function renderChoice(row: HTMLElement, choice: Choice | null): void {
  for (const button of voteButtons(row)) {
    const isChosen = button.dataset.rowVote === choice
    button.classList.toggle('is-active', isChosen)
    button.setAttribute('aria-pressed', String(isChosen))
  }
}

function setBusy(row: HTMLElement, isBusy: boolean): void {
  for (const button of voteButtons(row)) {
    button.disabled = isBusy
  }
}

function placeName(row: HTMLElement): string {
  return row.querySelector('a')?.textContent?.trim() ?? ''
}

function renderScore(row: HTMLElement, score: number): void {
  const shownScore = Math.max(score, 0)
  row.dataset.sortScore = String(shownScore)
  const label = row.querySelector<HTMLElement>('[data-row-score]')
  if (label) {
    label.textContent = String(shownScore)
    label.classList.toggle('has-votes', shownScore > 0)
  }
}

function resortByScore(): void {
  const sort = document.querySelector<HTMLSelectElement>('[data-filter-sort]')
  if (sort?.value.startsWith('score:')) {
    sort.dispatchEvent(new Event('change'))
  }
}

async function fetchReaderScores(): Promise<ReaderScore[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_reader_scores`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  })

  if (!response.ok) {
    throw new Error(`get_reader_scores responded ${response.status}`)
  }

  return (await response.json()) as ReaderScore[]
}
