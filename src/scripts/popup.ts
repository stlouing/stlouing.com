import { fleurFills, ratingLabel, type FleurFill } from '../lib/rating'
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface PopupChip {
  label: string
  filterSet?: string
  filterValue?: string
}

export interface PopupConfig {
  title: string
  link?: string
  external?: boolean
  photo?: string
  rating?: number
  showRating?: boolean
  chips?: PopupChip[]
  addressLines?: string[]
  directionsHref?: string
  websiteHref?: string
  tagline?: string
  excerpt?: string
  category?: string
  icon?: string
  swatchColor?: string
  voteSlug?: string
  viewMore?: boolean
}

function templateIconNode(selector: string): Node | undefined {
  const template = document.querySelector<HTMLTemplateElement>('template[data-badge-icons]')
  const icon = template?.content.querySelector(`${selector} .icon`)

  return icon?.cloneNode(true)
}

export function badgeIconNode(category: string, icon?: string): Node | undefined {
  return (
    (icon ? templateIconNode(`[data-icon="${icon}"]`) : undefined) ??
    templateIconNode(`[data-category="${category}"]`)
  )
}

function swatchNode(color: string, icon?: Node): HTMLSpanElement {
  const swatch = document.createElement('span')
  swatch.className = 'map-legend-swatch'
  swatch.style.setProperty('--badge-color', color)
  swatch.setAttribute('aria-hidden', 'true')
  if (icon) {
    swatch.append(icon)
  }

  return swatch
}

export function categorySwatchNode(category: string, iconName?: string): HTMLSpanElement {
  return swatchNode(`var(--color-spot-${category})`, badgeIconNode(category, iconName))
}

function categorySwatchHtml(category: string, iconName?: string): string {
  return categorySwatchNode(category, iconName).outerHTML
}

function readerVoteHtml(slug: string, title: string): string {
  const template = document.querySelector<HTMLTemplateElement>(
    'template[data-reader-vote-template]',
  )
  const widget = template?.content.querySelector<HTMLElement>('[data-reader-vote]')
  if (!widget) {
    return ''
  }

  const copy = widget.cloneNode(true) as HTMLElement
  copy.dataset.slug = slug
  copy.setAttribute('aria-label', `Rate ${title}`)

  return copy.outerHTML
}

function chipHtml(chip: PopupChip): string {
  const inner = escapeHtml(chip.label)
  if (chip.filterSet) {
    const value = escapeHtml(chip.filterValue ?? chip.label)
    return `<button type="button" class="list-meta eyebrow eyebrow--muted" data-filter-set="${escapeHtml(chip.filterSet)}" data-filter-value="${value}">${inner}</button>`
  }

  return `<span class="eyebrow eyebrow--muted">${inner}</span>`
}

const DIRECTIONS_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" /><path d="M9 4v13" /><path d="M15 7v13" /></svg>`

const EXTERNAL_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>`

function fleurGlyph(className: string): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 192" fill="currentColor" aria-hidden="true"><use href="#fleur-glyph"/></svg>`
}

function fleurHtml(fill: FleurFill): string {
  if (fill === 'half') {
    return `<span class="rating-half">${fleurGlyph('rating-fleur')}${fleurGlyph('rating-fleur is-filled')}</span>`
  }

  return fleurGlyph(fill === 'full' ? 'rating-fleur is-filled' : 'rating-fleur')
}

export function buildPopupHtml(config: PopupConfig): string {
  const {
    title,
    link = '',
    external = false,
    photo = '',
    rating,
    showRating = false,
    chips = [],
    addressLines = [],
    directionsHref = '',
    websiteHref = '',
    tagline = '',
    excerpt = '',
    category = '',
    icon,
    swatchColor = '',
    voteSlug = '',
    viewMore = true,
  } = config

  const photoHtml = photo
    ? `<div class="popup-photo" style="background-image: url('${escapeHtml(photo)}')" aria-hidden="true"></div>`
    : ''

  const targetAttrs = external ? ' target="_blank" rel="noopener"' : ''
  const titleHtml = link
    ? `<h2><a class="title-serif title-link" href="${link}"${targetAttrs}>${escapeHtml(title)}</a></h2>`
    : `<h2><span class="title-serif">${escapeHtml(title)}</span></h2>`

  const ratingHtml =
    rating !== undefined || showRating
      ? `<span class="rating" role="img" aria-label="${ratingLabel(rating)}">${fleurFills(rating)
          .map(fleurHtml)
          .join('')}</span>`
      : ''

  const metaInner = chips
    .map(chipHtml)
    .join('<span class="eyebrow-divider" aria-hidden="true"></span>')
  const swatchHtml = category
    ? categorySwatchHtml(category, icon)
    : swatchColor
      ? swatchNode(swatchColor, icon ? templateIconNode(`[data-icon="${icon}"]`) : undefined)
          .outerHTML
      : ''
  const metaHtml =
    metaInner || swatchHtml
      ? `<div class="popup-meta list-eyebrow">${swatchHtml}${metaInner}</div>`
      : ''

  const addressHtml = addressLines.length
    ? `<span class="popup-address">${addressLines.map(escapeHtml).join('<br>')}</span>`
    : ''

  const taglineHtml = tagline
    ? `<p class="popup-tagline description">${escapeHtml(tagline)}</p>`
    : ''

  const excerptHtml = excerpt ? `<p class="popup-excerpt excerpt">${escapeHtml(excerpt)}</p>` : ''

  const votesHtml = voteSlug ? readerVoteHtml(voteSlug, title) : ''

  const moreHtml =
    link && viewMore ? `<a class="btn btn-dark" href="${link}"${targetAttrs}>View more</a>` : ''

  const websiteHtml = websiteHref
    ? `<a class="btn btn-outline" href="${escapeHtml(websiteHref)}" target="_blank" rel="noopener">Website${EXTERNAL_ICON}</a>`
    : ''

  const directionsHtml = directionsHref
    ? `<a class="btn btn-outline" href="${directionsHref}" target="_blank" rel="noopener">Directions${DIRECTIONS_ICON}</a>`
    : ''

  const footerHtml =
    moreHtml || websiteHtml || directionsHtml
      ? `<div class="action-buttons">${moreHtml}${websiteHtml}${directionsHtml}</div>`
      : ''

  return `<div class="popup-scroll">${photoHtml}${ratingHtml}${metaHtml}${titleHtml}${taglineHtml}${addressHtml}${excerptHtml}${footerHtml}${votesHtml}</div>`
}
