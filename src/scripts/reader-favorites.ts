const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

const DEFAULT_MAX_ROWS = 10

type ReaderRating = { slug: string; likes: number }

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
    .catch(() => {})
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

function buildRow(rating: ReaderRating, title: string): HTMLLIElement {
  const item = document.createElement('li')

  const nameLink = document.createElement('a')
  nameLink.className = 'title-link'
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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_reader_ratings`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  })

  if (!response.ok) {
    throw new Error(`get_reader_ratings responded ${response.status}`)
  }

  return (await response.json()) as ReaderRating[]
}
