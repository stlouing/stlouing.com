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
  verdict?: { key: string; label: string }
  showRating?: boolean
  chips?: PopupChip[]
  addressLines?: string[]
  directionsHref?: string
  tagline?: string
  excerpt?: string
}

function chipHtml(chip: PopupChip): string {
  const inner = escapeHtml(chip.label)
  if (chip.filterSet) {
    const value = escapeHtml(chip.filterValue ?? chip.label)
    return `<button type="button" class="list-meta eyebrow eyebrow--muted" data-filter-set="${escapeHtml(chip.filterSet)}" data-filter-value="${value}">${inner}</button>`
  }

  return `<span class="eyebrow eyebrow--muted">${inner}</span>`
}

const DIRECTIONS_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" class="icon" aria-hidden="true"><path d="M21 11V3h-8v2h4v2h-2v2h-2v2h-2v2H9v2h2v-2h2v-2h2V9h2V7h2v4h2zM11 5H3v16h16v-8h-2v6H5V7h6V5z" fill="currentColor"/></svg>`

function fleurGlyph(className: string): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 192" fill="currentColor" aria-hidden="true"><use href="#fleur-glyph"/></svg>`
}

const RATING_FILLED: Record<string, number> = { 'not-for-me': 1, neutral: 2, liked: 3, loved: 4 }
const RATING_TOTAL = 4

export function buildPopupHtml(config: PopupConfig): string {
  const {
    title,
    link = '',
    external = false,
    photo = '',
    verdict,
    showRating = false,
    chips = [],
    addressLines = [],
    directionsHref = '',
    tagline = '',
    excerpt = '',
  } = config

  const photoHtml = photo
    ? `<div class="popup-photo" style="background-image: url('${escapeHtml(photo)}')" aria-hidden="true"></div>`
    : ''

  const targetAttrs = external ? ' target="_blank" rel="noopener"' : ''
  const titleHtml = link
    ? `<h2><a class="title-serif title-link" href="${link}"${targetAttrs}>${escapeHtml(title)}</a></h2>`
    : `<h2><span class="title-serif">${escapeHtml(title)}</span></h2>`

  const filled = verdict ? (RATING_FILLED[verdict.key] ?? 0) : 0
  const ratingLabel = verdict
    ? `Rating: ${escapeHtml(verdict.label)}, ${filled} of ${RATING_TOTAL}`
    : 'Not yet rated'
  const ratingHtml =
    verdict || showRating
      ? `<span class="rating" role="img" aria-label="${ratingLabel}">${Array.from(
          { length: RATING_TOTAL },
          (_unused, index) =>
            fleurGlyph(index < filled ? 'rating-fleur is-filled' : 'rating-fleur'),
        ).join('')}</span>`
      : ''

  const metaInner = chips
    .map(chipHtml)
    .join('<span class="eyebrow-divider" aria-hidden="true"></span>')
  const metaHtml = metaInner ? `<div class="popup-meta list-eyebrow">${metaInner}</div>` : ''

  const addressHtml = addressLines.length
    ? `<span class="popup-address">${addressLines.map(escapeHtml).join('<br>')}</span>`
    : ''

  const taglineHtml = tagline
    ? `<p class="popup-tagline description">${escapeHtml(tagline)}</p>`
    : ''

  const excerptHtml = excerpt ? `<p class="popup-excerpt excerpt">${escapeHtml(excerpt)}</p>` : ''

  const moreHtml = link ? `<a class="btn btn-dark" href="${link}"${targetAttrs}>View more</a>` : ''

  const directionsHtml = directionsHref
    ? `<a class="btn btn-outline" href="${directionsHref}" target="_blank" rel="noopener">Directions${DIRECTIONS_ICON}</a>`
    : ''

  const footerHtml =
    moreHtml || directionsHtml
      ? `<div class="popup-actions">${moreHtml}${directionsHtml}</div>`
      : ''

  return `<div class="popup-scroll">${photoHtml}${ratingHtml}${metaHtml}${titleHtml}${taglineHtml}${addressHtml}${excerptHtml}${footerHtml}</div>`
}
