import { cuisineLabel } from '../lib/cuisine'

interface Preview {
  title: string
  excerpt: string
  cuisine?: string[]
  neighborhood?: string
  tags?: string[]
  description?: string
  photo?: string
}

const HOVER_DELAY = 500
const HIDE_GRACE = 50

export function initWikilinkPreviews(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a.wikilink[data-wikilink]')]
  if (links.length === 0) {
    return
  }
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
  card.className = 'wikilink-card card card--lg'
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

    if (preview.photo) {
      const photo = document.createElement('img')
      photo.className = 'card-media'
      photo.src = preview.photo
      photo.alt = ''
      card.appendChild(photo)
    }

    const metaParts = [
      ...(preview.cuisine ?? []).map((cuisine) => cuisineLabel(cuisine)),
      ...(preview.neighborhood ? [preview.neighborhood] : []),
      ...(preview.tags ?? []),
    ]
    if (metaParts.length > 0) {
      const meta = document.createElement('div')
      meta.className = 'card-meta eyebrow eyebrow--muted'
      metaParts.forEach((part, partIndex) => {
        if (partIndex > 0) {
          const divider = document.createElement('span')
          divider.className = 'eyebrow-divider'
          divider.setAttribute('aria-hidden', 'true')
          meta.appendChild(divider)
        }
        const label = document.createElement('span')
        label.textContent = part
        meta.appendChild(label)
      })
      card.appendChild(meta)
    }

    const title = document.createElement('div')
    title.className = 'title-serif'
    title.textContent = preview.title
    card.appendChild(title)

    if (preview.description) {
      const description = document.createElement('p')
      description.className = 'card-description description'
      description.textContent = preview.description
      card.appendChild(description)
    }

    if (preview.excerpt) {
      const body = document.createElement('p')
      body.className = 'card-excerpt excerpt'
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

  card.addEventListener('mouseenter', () => window.clearTimeout(hideTimer))
  card.addEventListener('mouseleave', scheduleHide)
  window.addEventListener('scroll', hide, { passive: true })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hide()
    }
  })
}
