// Shared builder for the two map popups (food markers + neighborhood boundaries).

// Escape text before it goes into a popup's innerHTML.
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface PopupChip {
  // Visible label; escaped before insertion.
  label: string
  // When set, the chip is an interactive filter <button> (data-filter-set/value);
  // otherwise it's a static <span> (e.g. the neighborhood popup's area chip).
  filterSet?: string
  filterValue?: string
}

export interface PopupConfig {
  // Title text + the shared target for the title link and "View more". Without
  // a link the title renders as plain text and "View more" is omitted.
  title: string
  link?: string
  // Open the title link + "View more" in a new tab (an off-site spot page).
  external?: boolean
  // A photo banner atop the popup (an entry with a picture): rendered as a
  // centered cover background, full width, fixed height (--popup-photo-height).
  photo?: string
  // Food only: the place's rating, shown as four fleur-de-lis leading the chip
  // row, matching the list rows. `key` is the verdict (not-for-me/neutral/liked/
  // loved) that sets how many of the four glyphs are filled; `label` is its word,
  // carried into the rating's aria-label.
  verdict?: { key: string; label: string }
  // Food only: render the rating row even without a verdict — all four fleurs
  // faded, aria-label "Not yet rated" — matching Rating.astro in the list rows.
  // Neighborhood popups leave it unset and show no rating.
  showRating?: boolean
  // Chip row under the title (cuisine + neighborhood pin, or a single area chip).
  chips?: PopupChip[]
  // Food only: address lines, rendered under the title.
  addressLines?: string[]
  // Food only: the place's Google Maps link, rendered as a "Directions"
  // button beside "View more" in the popup's footer row.
  directionsHref?: string
  // A one-line tagline (the entry's description), in the shared description voice.
  tagline?: string
  // A short writeup teaser, clamped to a few lines by the popup CSS.
  excerpt?: string
}

// The cuisine / neighborhood / region meta in the shared eyebrow voice. A
// filterable value stays an interactive <button> (data-filter-set/value).
function chipHtml(chip: PopupChip): string {
  const inner = escapeHtml(chip.label)
  if (chip.filterSet) {
    const value = escapeHtml(chip.filterValue ?? chip.label)
    return `<button type="button" class="list-meta eyebrow eyebrow--muted" data-filter-set="${escapeHtml(chip.filterSet)}" data-filter-value="${value}">${inner}</button>`
  }

  return `<span class="eyebrow eyebrow--muted">${inner}</span>`
}

// Pixelarticons `external-link` (MIT) — the outbound arrow on the popup's
// "Directions" button. currentColor fill so it follows the button's text color.
const DIRECTIONS_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" class="icon" aria-hidden="true"><path d="M21 11V3h-8v2h4v2h-2v2h-2v2h-2v2H9v2h2v-2h2v-2h2V9h2V7h2v4h2zM11 5H3v16h16v-8h-2v6H5V7h6V5z" fill="currentColor"/></svg>`

// The St. Louis fleur-de-lis emblem, referencing the #fleur-glyph symbol
// BaseLayout embeds once. currentColor fills it, so the popup rating CSS colors
// the filled glyphs gold and fades the rest. `className` sets `is-filled`.
function fleurGlyph(className: string): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 192" fill="currentColor" aria-hidden="true"><use href="#fleur-glyph"/></svg>`
}

// Filled fleur-de-lis count per verdict, out of four — matches Rating.astro.
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

  // The rating, matching Rating.astro: four fleur-de-lis, filled to the verdict's
  // level (not-for-me = 1 … loved = 4), all four faded when unrated. The label
  // rides along as an aria-label.
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

  // Joined with the hairline tick the list eyebrows use; the list-eyebrow
  // class picks up the shared divider styling.
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

  // Order mirrors the list rows: the photo banner, rating, the eyebrow, then the
  // serif title with the description, address and excerpt below, and the footer
  // button row ("View more" + "Directions") last. The .popup-scroll wrapper caps
  // the popup's height on short viewports and scrolls internally (the close
  // button, a sibling, stays pinned).
  return `<div class="popup-scroll">${photoHtml}${ratingHtml}${metaHtml}${titleHtml}${taglineHtml}${addressHtml}${excerptHtml}${footerHtml}</div>`
}
