// Reader Favorites — the /best/ sidebar box ranking places by readers' 👍 votes.
// Same shape as readers-verdict.ts: no SDK, fetch against the anon REST API,
// which only exposes the aggregate get_reader_ratings() definer function.
// The page bakes a slug → title map into a JSON script tag so vote slugs can be
// named without another request; slugs that no longer resolve are skipped.

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const DEFAULT_MAX_ROWS = 10

// Likes only — dislikes never factor into this ranking.
type ReaderRating = {
  slug: string
  likes: number
}

// Lucide thumbs-up, matching the ReadersVerdict poll button icon.
const THUMBS_UP_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>'

export function initReaderFavorites(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return
  }

  const box = document.querySelector<HTMLElement>('[data-reader-favorites]')
  const list = box?.querySelector<HTMLElement>('[data-favorites-list]')
  if (!box || !list) {
    return
  }

  const titles = readPlaceTitles()

  // The box caps its own list via data-max-rows (the /best panel shows more
  // than the page sidebar).
  const maxRows = Number(box.dataset.maxRows) || DEFAULT_MAX_ROWS

  const render = (ratings: ReaderRating[]): void => {
    const named = ratings.filter((rating) => Boolean(titles[rating.slug])).slice(0, maxRows)

    for (const rating of named) {
      list.append(buildRow(rating, titles[rating.slug]))
    }

    const emptyLine = box.querySelector<HTMLElement>('[data-favorites-empty]')
    if (emptyLine) {
      emptyLine.hidden = named.length > 0
    }
    box.hidden = false
  }

  void fetchReaderRatings()
    .then(render)
    .catch(() => {
      // Offline / RPC missing — the box simply stays hidden; the page is
      // complete without it.
    })
}

function readPlaceTitles(): Record<string, string> {
  const tag = document.querySelector<HTMLScriptElement>('script[data-place-titles]')
  if (!tag?.textContent) {
    return {}
  }

  try {
    const parsed = JSON.parse(tag.textContent) as Record<string, string>

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// One ranked row: the place name linking to its page, and the like tally. Name
// comes from build-time data; the count is a number — nothing here is
// reader-authored, but keep to createElement/textContent anyway.
function buildRow(rating: ReaderRating, title: string): HTMLLIElement {
  const item = document.createElement('li')

  const nameLink = document.createElement('a')
  nameLink.href = `/food/${rating.slug}/`
  nameLink.textContent = title
  item.append(nameLink)

  const count = document.createElement('span')
  count.className = 'fav-count'
  count.innerHTML = THUMBS_UP_SVG
  count.append(String(rating.likes))
  item.append(count)

  return item
}

async function fetchReaderRatings(): Promise<ReaderRating[]> {
  // get_reader_ratings is a STABLE definer function, so it's callable over a
  // cacheable GET. Rows arrive already sorted by likes.
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_reader_ratings`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  })

  if (!response.ok) {
    throw new Error(`get_reader_ratings responded ${response.status}`)
  }

  return (await response.json()) as ReaderRating[]
}
