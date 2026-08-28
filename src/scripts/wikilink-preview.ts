// Wikipedia-style hovercards for resolved `[[wikilinks]]` (marked `a.wikilink`
// with a `data-wikilink` id by remark-wikilink). Desktop only: on hover/focus
// for ~1s, fetch the shared preview map once and show a small title + excerpt
// card near the link. Touch / coarse-pointer devices just follow the link.

import { cuisineLabel } from "../lib/cuisine"

interface Preview {
  title: string
  excerpt: string
  // Food only: cuisine chips + neighborhood.
  cuisine?: string[]
  neighborhood?: string
  // Food, topics + neighborhoods: the curated tagline, shown in the accent color.
  description?: string
  // Entries with a photo: a card-sized rendition shown atop the card.
  photo?: string
}

const HOVER_DELAY = 500
const HIDE_GRACE = 50

export function initWikilinkPreviews(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a.wikilink[data-wikilink]')]
  if (links.length === 0) {
    return
  }
  // Pointer-based devices only; touch just navigates on tap.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return
  }

  let previews: Record<string, Preview> | null = null
  let loading: Promise<Record<string, Preview>> | null = null
  function load(): Promise<Record<string, Preview>> {
    if (!loading) {
      loading = fetch(`${import.meta.env.BASE_URL}wikilink-previews.json`)
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({}))
        .then((data) => (previews = data as Record<string, Preview>))
    }

    return loading
  }

  const card = document.createElement('div')
  card.className = 'wikilink-card'
  card.setAttribute('role', 'tooltip')
  document.body.appendChild(card)

  let current: HTMLAnchorElement | null = null
  let showTimer = 0
  let hideTimer = 0

  function place(link: HTMLAnchorElement): void {
    const rect = link.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const margin = 8
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - cardRect.width - margin))
    // Below by default; flip above when there isn't room and there is above.
    const below = rect.bottom + 6
    const above = rect.top - cardRect.height - 6
    const top =
      below + cardRect.height > window.innerHeight - margin && above > margin ? above : below
    card.style.left = `${left + window.scrollX}px`
    card.style.top = `${top + window.scrollY}px`
  }

  async function show(link: HTMLAnchorElement): Promise<void> {
    const data = await load()
    const preview = data[link.dataset.wikilink ?? '']
    if (!preview || current !== link) {
      return
    }
    card.textContent = ''

    // Entry photo atop the card. The box height is fixed in CSS, so the card
    // doesn't reflow when the image finishes loading.
    if (preview.photo) {
      const photo = document.createElement('img')
      photo.className = 'wikilink-card-photo'
      photo.src = preview.photo
      photo.alt = ''
      card.appendChild(photo)
    }

    const title = document.createElement('div')
    title.className = 'wikilink-card-title'
    title.textContent = preview.title
    card.appendChild(title)

    // Topic tagline, in the accent color.
    if (preview.description) {
      const description = document.createElement('p')
      description.className = 'wikilink-card-description'
      description.textContent = preview.description
      card.appendChild(description)
    }

    // Food metadata: cuisine chips + the neighborhood.
    if (preview.cuisine?.length || preview.neighborhood) {
      const meta = document.createElement('div')
      meta.className = 'wikilink-card-meta'
      preview.cuisine?.forEach((cuisine) => {
        const chip = document.createElement('span')
        chip.className = 'chip'
        chip.textContent = cuisineLabel(cuisine)
        meta.appendChild(chip)
      })
      if (preview.neighborhood) {
        const neighborhood = document.createElement('span')
        neighborhood.className = 'wikilink-card-neighborhood'
        neighborhood.textContent = preview.neighborhood
        meta.appendChild(neighborhood)
      }
      card.appendChild(meta)
    }

    if (preview.excerpt) {
      const body = document.createElement('p')
      body.className = 'wikilink-card-excerpt'
      body.textContent = preview.excerpt
      card.appendChild(body)
    }
    place(link)
    card.classList.add('is-visible')
  }

  function hide(): void {
    card.classList.remove('is-visible')
    current = null
  }

  function scheduleShow(link: HTMLAnchorElement): void {
    current = link
    window.clearTimeout(hideTimer)
    window.clearTimeout(showTimer)
    showTimer = window.setTimeout(() => show(link), HOVER_DELAY)
  }

  function scheduleHide(): void {
    window.clearTimeout(showTimer)
    hideTimer = window.setTimeout(hide, HIDE_GRACE)
  }

  for (const link of links) {
    link.addEventListener('mouseenter', () => scheduleShow(link))
    link.addEventListener('mouseleave', scheduleHide)
    link.addEventListener('focus', () => scheduleShow(link))
    link.addEventListener('blur', scheduleHide)
  }

  // Moving onto the card keeps it open (so the excerpt is readable).
  card.addEventListener('mouseenter', () => window.clearTimeout(hideTimer))
  card.addEventListener('mouseleave', scheduleHide)
  window.addEventListener('scroll', hide, { passive: true })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hide()
    }
  })
}
